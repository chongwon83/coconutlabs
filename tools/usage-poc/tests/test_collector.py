"""TDD suite for the CoconutLabs collector (handoff §21 task 1).

Fixtures are SYNTHETIC JSONL built in tmp_path — no real session log is
ever copied. Each synthetic line deliberately carries a content/text field
holding the sentinel SECRET_CONTENT_LEAK so the negative test (test 6) can
prove the collector never echoes message content into its output.
"""

import json
from datetime import datetime, timezone
from pathlib import Path

import pytest

UTC = timezone.utc

from coconut_collector import collect as collect_mod
from coconut_collector.collect import build_envelope
from coconut_collector.hashing import project_hash
from coconut_collector.parsers import (find_logs, load_pricing, match_model,
                                       parse_claude, parse_codex)

SECRET = "SECRET_CONTENT_LEAK"
SALT = "0" * 64  # fixed device salt -> deterministic projectHash in tests


# --- synthetic fixture builders ------------------------------------------

def _claude_line(model: str, ts: str, ntok: int) -> str:
    """One assistant line. Carries a content field that must never leak."""
    return json.dumps({
        "timestamp": ts,
        "type": "assistant",
        "message": {
            "model": model,
            "content": [{"type": "text", "text": SECRET}],
            "usage": {
                "input_tokens": ntok,
                "output_tokens": ntok // 2,
                "cache_read_input_tokens": 10,
                "cache_creation": {
                    "ephemeral_5m_input_tokens": 5,
                    "ephemeral_1h_input_tokens": 2,
                },
            },
        },
    })


def write_claude_log(root: Path, slug: str, model: str,
                     ts: str = "2026-05-19T10:00:00Z", ntok: int = 100) -> Path:
    """Claude log: project slug is the parent directory name."""
    d = root / slug
    d.mkdir(parents=True, exist_ok=True)
    p = d / "session.jsonl"
    p.write_text(_claude_line(model, ts, ntok) + "\n", encoding="utf-8")
    return p


def write_codex_log(root: Path, name: str, cwd: str, model: str,
                     ts: str = "2026-05-19T11:00:00Z") -> Path:
    """Codex log: project slug is taken from the session-meta `cwd`."""
    meta = json.dumps({
        "timestamp": ts,
        "payload": {"type": "session_meta", "cwd": cwd, "model": model,
                    "instructions": SECRET},
    })
    tc = json.dumps({
        "timestamp": "2026-05-19T11:05:00Z",
        "payload": {"type": "token_count", "info": {"total_token_usage": {
            "input_tokens": 200, "cached_input_tokens": 40,
            "output_tokens": 80}}},
    })
    p = root / f"rollout-{name}.jsonl"
    p.write_text(meta + "\n" + tc + "\n", encoding="utf-8")
    return p


# --- test 1: parse_claude returns timestamp + slug -----------------------

def test_parse_claude_returns_timestamp_and_slug(tmp_path):
    p = write_claude_log(tmp_path, "my-project", "claude-opus-4-7")
    sp = parse_claude(p)
    assert sp.tool == "claude"
    assert sp.model == "claude-opus-4-7"
    assert sp.timestamp == "2026-05-19T10:00:00Z"
    assert sp.project_slug == "my-project"
    assert sp.tokens["input"] == 100
    assert sp.tokens["cache_write_5m"] == 5
    assert sp.tokens["cache_write_1h"] == 2


# --- test 2: parse_codex returns timestamp + slug ------------------------

def test_parse_codex_returns_timestamp_and_slug(tmp_path):
    p = write_codex_log(tmp_path, "abc", "/Users/x/secret-project", "gpt-5.5")
    sp = parse_codex(p)
    assert sp.tool == "codex"
    assert sp.model == "gpt-5.5"
    assert sp.timestamp == "2026-05-19T11:00:00Z"
    assert sp.project_slug == "/Users/x/secret-project"
    # input_tokens includes cached as a subset -> split, no double-bill
    assert sp.tokens["input"] == 160
    assert sp.tokens["cached_input"] == 40
    assert sp.tokens["output"] == 80


# --- test 3: project_hash is salted + 12 hex -----------------------------

def test_project_hash_salted_and_12_hex():
    h = project_hash("/Users/x/secret-project", SALT)
    assert len(h) == 12
    assert all(c in "0123456789abcdef" for c in h)
    # same slug + same salt -> stable
    assert h == project_hash("/Users/x/secret-project", SALT)
    # different salt -> different hash (salt actually participates)
    assert h != project_hash("/Users/x/secret-project", "f" * 64)
    # different slug -> different hash
    assert h != project_hash("/Users/x/other", SALT)


# --- test 4: collect groups by (tool, model, projectHash) ----------------

def test_collect_groups_by_tool_model_projecthash(tmp_path, monkeypatch):
    # two claude sessions, SAME project + model -> must aggregate to 1 row
    a1 = write_claude_log(tmp_path, "proj-a", "claude-opus-4-7", ntok=100)
    a2 = write_claude_log(tmp_path / "second", "proj-a", "claude-opus-4-7",
                          ntok=200)
    # one claude session, DIFFERENT project -> separate row
    b1 = write_claude_log(tmp_path, "proj-b", "claude-opus-4-7", ntok=50)

    def fake_find_logs(tool):
        return [a1, a2, b1] if tool == "claude" else []

    monkeypatch.setattr(collect_mod, "find_logs", fake_find_logs)
    groups = collect_mod.collect(load_pricing(), SALT)

    # proj-a aggregates to one key, proj-b is its own -> 2 groups total
    assert len(groups) == 2
    tools_models = {(t, m) for (t, m, _) in groups}
    assert tools_models == {("claude", "claude-opus-4-7")}
    # the proj-a group summed both sessions (input 100 + 200)
    a_hash = project_hash("proj-a", SALT)
    a_grp = groups[("claude", "claude-opus-4-7", a_hash)]
    assert a_grp["tokens"]["input"] == 300
    assert a_grp["sessions"] == 2


# --- test 5: envelope validates against the JSON Schema ------------------

def test_envelope_passes_jsonschema(tmp_path, monkeypatch):
    jsonschema = pytest.importorskip("jsonschema")
    schema_path = Path(__file__).parent.parent / "burn-summary.schema.json"
    schema = json.loads(schema_path.read_text(encoding="utf-8"))

    cl = write_claude_log(tmp_path, "proj-a", "claude-opus-4-7")
    cx = write_codex_log(tmp_path, "x", "/Users/x/proj-b", "gpt-5.5")

    def fake_find_logs(tool):
        return [cl] if tool == "claude" else [cx]

    monkeypatch.setattr(collect_mod, "find_logs", fake_find_logs)
    envelope = build_envelope(load_pricing(), SALT,
                              generated_at="2026-05-19T12:00:00Z",
                              period="all")
    jsonschema.validate(envelope, schema)  # raises on failure
    assert len(envelope["rows"]) == 2
    assert envelope["grandTotal"]["totalTokens"] > 0


# --- test 6: NEGATIVE — content fields never reach the output ------------

def test_no_content_fields_in_output(tmp_path, monkeypatch):
    """The synthetic logs embed SECRET_CONTENT_LEAK in content/instructions
    fields. A serialized envelope must not contain it (handoff §8).

    generatedAt 2026-05-19 -> week = [2026-05-11, 2026-05-18); fixtures are
    dated 2026-05-12 so the 'week' branch keeps them."""
    cl = write_claude_log(tmp_path, "proj-a", "claude-opus-4-7",
                          ts="2026-05-12T10:00:00Z")
    cx = write_codex_log(tmp_path, "x", "/Users/x/proj-b", "gpt-5.5",
                         ts="2026-05-12T11:00:00Z")

    def fake_find_logs(tool):
        return [cl] if tool == "claude" else [cx]

    monkeypatch.setattr(collect_mod, "find_logs", fake_find_logs)
    for period in ("all", "week"):
        envelope = build_envelope(load_pricing(), SALT,
                                  generated_at="2026-05-19T12:00:00Z",
                                  period=period)
        blob = json.dumps(envelope, ensure_ascii=False)
        assert SECRET not in blob
        # raw project path slugs must not survive either — only the hash
        assert "/Users/x/proj-b" not in blob
        assert "proj-a" not in blob


# --- test 7: estimate_cost.py --all shim equivalence ---------------------

def test_estimate_cost_shim_equivalence(tmp_path, monkeypatch):
    """The PoC shim must aggregate the same totals the parsers produce
    directly — proof the package extraction didn't change PoC behavior."""
    import estimate_cost

    cl = write_claude_log(tmp_path, "proj-a", "claude-opus-4-7", ntok=100)
    cx = write_codex_log(tmp_path, "x", "/Users/x/proj-b", "gpt-5.5")

    def fake_find_logs(tool):
        return [cl] if tool == "claude" else [cx]

    monkeypatch.setattr(estimate_cost, "find_logs", fake_find_logs)
    result = estimate_cost.build_aggregate_result(load_pricing())

    # independent ground truth straight from the parsers
    claude_tok = sum(parse_claude(cl).tokens.values())
    codex_tok = sum(parse_codex(cx).tokens.values())
    assert result["grand_total_tokens"] == claude_tok + codex_tok
    assert {m["model"] for m in result["per_model"]} == {
        "claude-opus-4-7", "gpt-5.5"}
    assert result["scanned"]["claude"]["ok"] == 1
    assert result["scanned"]["codex"]["ok"] == 1


# --- guard: find_logs hits the documented standard paths -----------------

def test_find_logs_uses_standard_paths():
    """find_logs must glob the install-standard dirs (smoke check that the
    function runs and returns a list, not that any logs exist)."""
    assert isinstance(find_logs("claude"), list)
    assert isinstance(find_logs("codex"), list)
    # match_model still resolves a known model to high confidence
    pricing = load_pricing()
    _, conf = match_model(pricing.get("claude", {}), "claude-opus-4-7")
    assert conf == "high"


# --- test 8: period='week' excludes sessions outside the window ----------

def test_week_period_excludes_out_of_window(tmp_path, monkeypatch):
    """generatedAt 2026-05-19 (Tue) -> last completed week
    [2026-05-11, 2026-05-18). Two sessions inside, one in the in-progress
    week -> only the two completed-week sessions are aggregated."""
    inside1 = write_claude_log(tmp_path / "a", "proj-a", "claude-opus-4-7",
                               ts="2026-05-12T09:00:00Z", ntok=100)
    inside2 = write_claude_log(tmp_path / "b", "proj-a", "claude-opus-4-7",
                               ts="2026-05-15T09:00:00Z", ntok=200)
    outside = write_claude_log(tmp_path / "c", "proj-a", "claude-opus-4-7",
                               ts="2026-05-19T09:00:00Z", ntok=400)

    def fake_find_logs(tool):
        return [inside1, inside2, outside] if tool == "claude" else []

    monkeypatch.setattr(collect_mod, "find_logs", fake_find_logs)
    week = build_envelope(load_pricing(), SALT,
                          generated_at="2026-05-19T12:00:00Z", period="week")
    assert week["periodWindow"]["period"] == "week"
    assert week["periodWindow"]["since"] == "2026-05-11T00:00:00Z"
    assert week["periodWindow"]["until"] == "2026-05-18T00:00:00Z"
    assert sum(r["sessionCount"] for r in week["rows"]) == 2


# --- test 9: period='all' regression — same fixture, no filtering --------

def test_all_period_includes_everything(tmp_path, monkeypatch):
    s1 = write_claude_log(tmp_path / "a", "proj-a", "claude-opus-4-7",
                          ts="2026-05-18T09:00:00Z", ntok=100)
    s2 = write_claude_log(tmp_path / "b", "proj-a", "claude-opus-4-7",
                          ts="2026-05-19T09:00:00Z", ntok=200)
    s3 = write_claude_log(tmp_path / "c", "proj-a", "claude-opus-4-7",
                          ts="2026-05-10T09:00:00Z", ntok=400)

    def fake_find_logs(tool):
        return [s1, s2, s3] if tool == "claude" else []

    monkeypatch.setattr(collect_mod, "find_logs", fake_find_logs)
    allp = build_envelope(load_pricing(), SALT,
                          generated_at="2026-05-19T12:00:00Z", period="all")
    assert allp["periodWindow"] == {"period": "all", "since": None,
                                    "until": None}
    assert sum(r["sessionCount"] for r in allp["rows"]) == 3


# --- test 10: calendar bucket boundary arithmetic ------------------------

def test_calendar_window_boundaries(tmp_path, monkeypatch):
    """[since, until) is closed-open; rollover crosses month/year cleanly."""

    def in_window_count(period, now, timestamps):
        paths = [write_claude_log(tmp_path / f"{period}{i}", "p",
                                  "claude-opus-4-7", ts=ts)
                 for i, ts in enumerate(timestamps)]
        monkeypatch.setattr(collect_mod, "find_logs",
                            lambda tool: paths if tool == "claude" else [])
        groups = collect_mod.collect(load_pricing(), SALT,
                                     period=period, now=now)
        return sum(g["sessions"] for g in groups.values())

    # week: last completed week. now=Wed 2026-05-20 -> [2026-05-11,
    # 2026-05-18). since Monday 00:00:00Z included; the prior Sunday
    # 23:59:59Z and the until Monday 00:00:00Z both excluded.
    assert in_window_count("week", datetime(2026, 5, 20, 12, tzinfo=UTC),
                           ["2026-05-11T00:00:00Z",
                            "2026-05-10T23:59:59Z",
                            "2026-05-18T00:00:00Z"]) == 1
    # month: Mar 1 included, Feb 28 excluded (rollover)
    assert in_window_count("month", datetime(2026, 3, 15, 12, tzinfo=UTC),
                           ["2026-03-01T00:00:00Z",
                            "2026-02-28T23:00:00Z"]) == 1
    # year: Jan 1 included, prior Dec 31 excluded (Dec->Jan rollover)
    assert in_window_count("year", datetime(2026, 6, 1, 12, tzinfo=UTC),
                           ["2026-01-01T00:00:00Z",
                            "2025-12-31T23:00:00Z"]) == 1


# --- test 11: sessions with no timestamp ---------------------------------

def test_session_without_timestamp(tmp_path, monkeypatch):
    """A session whose log carries no line-level timestamp is excluded from
    a windowed period (cannot prove membership) but kept under 'all'."""
    line = json.dumps({
        "type": "assistant",
        "message": {
            "model": "claude-opus-4-7",
            "content": [{"type": "text", "text": SECRET}],
            "usage": {"input_tokens": 100, "output_tokens": 50,
                      "cache_read_input_tokens": 10,
                      "cache_creation": {"ephemeral_5m_input_tokens": 5,
                                         "ephemeral_1h_input_tokens": 2}},
        },
    })
    d = tmp_path / "nots"
    d.mkdir(parents=True)
    p = d / "session.jsonl"
    p.write_text(line + "\n", encoding="utf-8")

    monkeypatch.setattr(collect_mod, "find_logs",
                        lambda tool: [p] if tool == "claude" else [])
    week = collect_mod.collect(load_pricing(), SALT, period="week",
                               now=datetime(2026, 5, 19, 12, tzinfo=UTC))
    allp = collect_mod.collect(load_pricing(), SALT, period="all")
    assert len(week) == 0
    assert len(allp) == 1


# --- test 12: empty window raises ValueError -----------------------------

def test_empty_period_raises(tmp_path, monkeypatch):
    """A window with no sessions must raise rather than emit a rows=[]
    envelope that violates the schema's minItems: 1."""
    old = write_claude_log(tmp_path / "old", "proj-a", "claude-opus-4-7",
                           ts="2020-01-01T00:00:00Z")

    monkeypatch.setattr(collect_mod, "find_logs",
                        lambda tool: [old] if tool == "claude" else [])
    with pytest.raises(ValueError, match="no sessions in period 'day'"):
        build_envelope(load_pricing(), SALT,
                       generated_at="2026-05-19T12:00:00Z", period="day")


# --- test 13: schemaVersion 2 + periodWindow shape -----------------------

def test_envelope_schema_version_and_period_window(tmp_path, monkeypatch):
    cl = write_claude_log(tmp_path, "proj-a", "claude-opus-4-7",
                          ts="2026-05-19T09:00:00Z")

    monkeypatch.setattr(collect_mod, "find_logs",
                        lambda tool: [cl] if tool == "claude" else [])
    # generatedAt 2026-05-26 -> last completed week [2026-05-18, 2026-05-25)
    # contains the 2026-05-19 fixture.
    env = build_envelope(load_pricing(), SALT,
                         generated_at="2026-05-26T12:00:00Z", period="week")
    assert env["schemaVersion"] == "2"
    assert set(env["periodWindow"]) == {"period", "since", "until"}
    assert env["periodWindow"]["period"] == "week"
    assert env["periodWindow"]["since"] is not None

    with pytest.raises(ValueError, match="unknown period"):
        build_envelope(load_pricing(), SALT,
                       generated_at="2026-05-19T12:00:00Z", period="bogus")


# --- test 14: generatedAt is normalised to second-precision UTC 'Z' ------

def test_generated_at_normalised(tmp_path, monkeypatch):
    """A non-'Z' generatedAt (offset / fractional seconds) must still be
    serialised as schema-valid second-precision UTC."""
    cl = write_claude_log(tmp_path, "proj-a", "claude-opus-4-7",
                          ts="2026-05-19T09:00:00Z")

    monkeypatch.setattr(collect_mod, "find_logs",
                        lambda tool: [cl] if tool == "claude" else [])
    env = build_envelope(load_pricing(), SALT,
                         generated_at="2026-05-26T12:00:00.500+00:00",
                         period="week")
    assert env["generatedAt"] == "2026-05-26T12:00:00Z"
