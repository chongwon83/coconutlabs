"""TDD suite for the CoconutLabs collector (handoff §21 task 1).

Fixtures are SYNTHETIC JSONL built in tmp_path — no real session log is
ever copied. Each synthetic line deliberately carries a content/text field
holding the sentinel SECRET_CONTENT_LEAK so the negative test (test 6) can
prove the collector never echoes message content into its output.
"""

import json
import os
import subprocess
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


# --- test 1: parse_claude returns timestamp + project_hash ---------------

def test_parse_claude_returns_timestamp_and_slug(tmp_path):
    # Use a meaningful path so the hash covers a real slug value.
    projects_root = tmp_path / "projects"
    p = write_claude_log(projects_root, "my-project", "claude-opus-4-7")
    sp = parse_claude(p, SALT)
    assert sp.tool == "claude"
    assert sp.model == "claude-opus-4-7"
    assert sp.timestamp == "2026-05-19T10:00:00Z"
    # raw slug must NOT be present as a field
    assert not hasattr(sp, "project_slug")
    # project_hash must be the 12-hex salted hash of the parent dir name
    assert sp.project_hash == project_hash("my-project", SALT)
    assert len(sp.project_hash) == 12
    assert all(c in "0123456789abcdef" for c in sp.project_hash)
    assert sp.tokens["input"] == 100
    assert sp.tokens["cache_write_5m"] == 5
    assert sp.tokens["cache_write_1h"] == 2


# --- test 2: parse_codex returns timestamp + project_hash ----------------

def test_parse_codex_returns_timestamp_and_slug(tmp_path):
    p = write_codex_log(tmp_path, "abc", "/Users/x/secret-project", "gpt-5.5")
    sp = parse_codex(p, SALT)
    assert sp.tool == "codex"
    assert sp.model == "gpt-5.5"
    assert sp.timestamp == "2026-05-19T11:00:00Z"
    # raw slug must NOT be present as a field
    assert not hasattr(sp, "project_slug")
    # project_hash must be the 12-hex salted hash of the cwd
    assert sp.project_hash == project_hash("/Users/x/secret-project", SALT)
    assert len(sp.project_hash) == 12
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

    def fake_find_logs(tool, scan_root=None):
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

    def fake_find_logs(tool, scan_root=None):
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

    def fake_find_logs(tool, scan_root=None):
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

    def fake_find_logs(tool, scan_root=None):
        return [cl] if tool == "claude" else [cx]

    monkeypatch.setattr(estimate_cost, "find_logs", fake_find_logs)
    result = estimate_cost.build_aggregate_result(load_pricing())

    # independent ground truth straight from the parsers
    claude_tok = sum(parse_claude(cl, SALT).tokens.values())
    codex_tok = sum(parse_codex(cx, SALT).tokens.values())
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


# --- match_model: current-gen pricing + wildcard confidence --------------

def test_match_model_opus_pricing_and_confidence():
    """Regression for the legacy-rate over-charge bug.

    Before the fix, an unlisted Opus minor (e.g. claude-opus-4-8) matched the
    bare 'claude-opus-4' legacy key at HIGH confidence -> $15 input, a 3x
    over-charge vs. the real $5 current-Opus rate. The fix lists 4-8 explicitly
    and adds a 'claude-opus-4-x' current-gen wildcard, so a not-yet-listed
    future minor prices at the $5 tier but reports LOW (Estimated) confidence.
    """
    claude = load_pricing()["claude"]

    # Explicit current version -> $5 input, high confidence.
    row, conf = match_model(claude, "claude-opus-4-8")
    assert row["input"] == 5
    assert conf == "high"

    # Dated build of a listed version -> still the specific key, high.
    row, conf = match_model(claude, "claude-opus-4-7-20260101")
    assert row["input"] == 5
    assert conf == "high"

    # Not-yet-listed future minor -> current-gen wildcard: $5 tier, LOW conf
    # (the regression: must NOT be $15, must NOT be high confidence).
    row, conf = match_model(claude, "claude-opus-4-9")
    assert row["input"] == 5
    assert conf == "low"

    # Legacy minors stay $15 at high confidence (explicit keys win the tie).
    for legacy in ("claude-opus-4-1", "claude-opus-4-0"):
        row, conf = match_model(claude, legacy)
        assert row["input"] == 15, legacy
        assert conf == "high", legacy

    # The Opus 4.0 GA snapshot id has no '-0', so only the explicit pin keeps
    # it at $15 high — without it the wildcard would undercharge it at $5 and
    # inflate VES (codex round-1 HIGH).
    row, conf = match_model(claude, "claude-opus-4-20250514")
    assert row["input"] == 15
    assert conf == "high"

    # Bare 'claude-opus-4' is NOT a real Anthropic model id (the 4.0 alias is
    # claude-opus-4-0). If one ever appears it resolves via the wildcard to the
    # current $5 tier at LOW/Estimated confidence — an accepted, flagged guess,
    # never a silent high-confidence charge.
    row, conf = match_model(claude, "claude-opus-4")
    assert row["input"] == 5
    assert conf == "low"


def test_match_model_haiku_wildcard_and_default():
    """Future Haiku-4 minor prices at the $1 family tier (wildcard, low conf)
    instead of silently falling to the $3 _default; an unknown family still
    falls to _default at low confidence."""
    claude = load_pricing()["claude"]

    row, conf = match_model(claude, "claude-haiku-4-5")
    assert row["input"] == 1
    assert conf == "high"

    row, conf = match_model(claude, "claude-haiku-4-6")  # not listed
    assert row["input"] == 1
    assert conf == "low"

    # Unknown family -> _default ($3) + low.
    row, conf = match_model(claude, "gemini-3-pro")
    assert row["input"] == claude["_default"]["input"]
    assert conf == "low"


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

    def fake_find_logs(tool, scan_root=None):
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

    def fake_find_logs(tool, scan_root=None):
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
                            lambda tool, scan_root=None: paths if tool == "claude" else [])
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
                        lambda tool, scan_root=None: [p] if tool == "claude" else [])
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
                        lambda tool, scan_root=None: [old] if tool == "claude" else [])
    with pytest.raises(ValueError, match="no sessions in period 'day'"):
        build_envelope(load_pricing(), SALT,
                       generated_at="2026-05-19T12:00:00Z", period="day")


# --- test 13: schemaVersion 3 + periodWindow shape -----------------------

def test_envelope_schema_version_and_period_window(tmp_path, monkeypatch):
    cl = write_claude_log(tmp_path, "proj-a", "claude-opus-4-7",
                          ts="2026-05-19T09:00:00Z")

    monkeypatch.setattr(collect_mod, "find_logs",
                        lambda tool, scan_root=None: [cl] if tool == "claude" else [])
    # generatedAt 2026-05-26 -> last completed week [2026-05-18, 2026-05-25)
    # contains the 2026-05-19 fixture.
    env = build_envelope(load_pricing(), SALT,
                         generated_at="2026-05-26T12:00:00Z", period="week")
    assert env["schemaVersion"] == "3"
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
                        lambda tool, scan_root=None: [cl] if tool == "claude" else [])
    env = build_envelope(load_pricing(), SALT,
                         generated_at="2026-05-26T12:00:00.500+00:00",
                         period="week")
    assert env["generatedAt"] == "2026-05-26T12:00:00Z"


# --- test 15 (F6): _as_int rejects values above MAX_SAFE_INTEGER ----------

def test_parsers_reject_oversize_int(tmp_path):
    """F6: integer above 2^53-1 must coerce to 0; boundary value (2^53-1)
    must be accepted; Codex-style int must also be capped."""
    MAX = (1 << 53) - 1

    # Claude log: huge input_tokens, normal output
    cl = tmp_path / "projects" / "raw-secret-project" / "session.jsonl"
    cl.parent.mkdir(parents=True)
    cl.write_text(
        json.dumps({
            "timestamp": "2026-05-20T00:00:00Z",
            "type": "assistant",
            "message": {
                "model": "claude-opus-4-7",
                "usage": {
                    "input_tokens": 1 << 60,   # over MAX_SAFE_INT -> 0
                    "output_tokens": 1,
                },
            },
        }) + "\n",
        encoding="utf-8",
    )
    sp = parse_claude(cl, SALT)
    assert sp.tokens["input"] == 0       # oversized -> 0
    assert sp.tokens["output"] == 1

    # Claude log: exactly MAX_SAFE_INT must pass through
    cl2 = tmp_path / "projects2" / "p2" / "session.jsonl"
    cl2.parent.mkdir(parents=True)
    cl2.write_text(
        json.dumps({
            "timestamp": "2026-05-20T00:00:01Z",
            "type": "assistant",
            "message": {
                "model": "claude-opus-4-7",
                "usage": {"input_tokens": MAX, "output_tokens": 1},
            },
        }) + "\n",
        encoding="utf-8",
    )
    sp2 = parse_claude(cl2, SALT)
    assert sp2.tokens["input"] == MAX    # exactly at boundary -> accepted

    # Codex log: over-size cached_input_tokens
    cx = tmp_path / "rollout-huge.jsonl"
    cx.write_text(
        json.dumps({
            "timestamp": "2026-05-20T00:00:02Z",
            "payload": {"type": "session_meta", "cwd": "/tmp/p", "model": "gpt-5.5"},
        }) + "\n" +
        json.dumps({
            "timestamp": "2026-05-20T00:00:03Z",
            "payload": {
                "type": "token_count",
                "info": {"total_token_usage": {
                    "input_tokens": 1 << 60,
                    "cached_input_tokens": 0,
                    "output_tokens": 5,
                }},
            },
        }) + "\n",
        encoding="utf-8",
    )
    sp3 = parse_codex(cx, SALT)
    assert sp3.tokens["input"] == 0     # oversized -> 0 (coerced before subtraction)
    assert sp3.tokens["output"] == 5


# --- test 16 (F7): non-dict payload.info does not raise AttributeError ----

def test_parsers_handle_non_dict_info(tmp_path):
    """F7: payload.info as list, string, or None must be skipped safely;
    a subsequent valid token_count event must still be picked up."""
    p = tmp_path / "rollout-badinfo.jsonl"
    p.write_text(
        # list info — must be skipped, no AttributeError
        json.dumps({
            "timestamp": "2026-05-20T00:00:00Z",
            "payload": {"type": "token_count", "info": [1, 2, 3]},
        }) + "\n" +
        # string info — must be skipped
        json.dumps({
            "timestamp": "2026-05-20T00:00:01Z",
            "payload": {"type": "token_count", "info": "oops"},
        }) + "\n" +
        # valid event with cwd — picked up as the final result
        json.dumps({
            "timestamp": "2026-05-20T00:00:02Z",
            "payload": {
                "type": "token_count",
                "model": "gpt-5.5",
                "cwd": "/Users/x/proj",
                "info": {"total_token_usage": {
                    "input_tokens": 10,
                    "cached_input_tokens": 0,
                    "output_tokens": 5,
                }},
            },
        }) + "\n",
        encoding="utf-8",
    )
    sp = parse_codex(p, SALT)   # must not raise
    assert sp.tokens["input"] == 10
    assert sp.tokens["output"] == 5


# --- test 17 (F5): SessionParse has no raw slug field ---------------------

def test_session_parse_does_not_expose_raw_slug():
    """F5: SessionParse must expose project_hash, not project_slug.
    Verified via dataclass field introspection so a future rename cannot
    silently reintroduce the raw field."""
    import dataclasses
    field_names = {f.name for f in dataclasses.fields(
        __import__("coconut_collector.parsers", fromlist=["SessionParse"]).SessionParse
    )}
    assert "project_slug" not in field_names, (
        "project_slug must not be a field — callers could accidentally emit it"
    )
    assert "project_hash" in field_names


# --- test 18 (F5): raw slug never surfaces in dataclasses.asdict values ---

def test_raw_slug_not_in_asdict_values(tmp_path):
    """F5 caller-level: raw project path must not appear in any field value
    returned by the parser — only the 12-hex hash should be present."""
    import dataclasses
    projects_root = tmp_path / "projects"
    p = write_claude_log(projects_root, "raw-secret-project", "claude-opus-4-7")
    sp = parse_claude(p, SALT)
    all_values = str(dataclasses.asdict(sp))
    assert "raw-secret-project" not in all_values, (
        "raw slug must not appear in any SessionParse field"
    )
    # the hash must be present
    assert sp.project_hash in all_values


# --- test 19: CLI --help exits 0 -----------------------------------------

def test_cli_entry_point_help_exits_zero():
    """coconut_collector.__main__ must exit 0 for --help."""
    import subprocess
    import sys
    result = subprocess.run(
        [sys.executable, "-m", "coconut_collector", "--help"],
        capture_output=True, text=True,
    )
    assert result.returncode == 0
    assert "period" in result.stdout.lower()


# --- test 20: friendly error message when no sessions found ---------------

def test_friendly_error_no_sessions(tmp_path, monkeypatch):
    """When no sessions exist stderr must contain [CoconutLabs] and '→ 다음 액션:'."""
    import subprocess
    import sys
    import os
    # Use a tmp HOME where no claude/codex logs exist
    env = dict(os.environ, HOME=str(tmp_path), USERPROFILE=str(tmp_path))
    result = subprocess.run(
        [sys.executable, "-m", "coconut_collector", "--period", "week"],
        capture_output=True, text=True, env=env,
    )
    assert result.returncode != 0
    combined = result.stderr + result.stdout
    assert "[CoconutLabs]" in combined, (
        f"Error output must include [CoconutLabs] prefix. Got: {combined!r}"
    )
    assert "→ 다음 액션:" in combined, (
        f"Error output must include '→ 다음 액션:' hint. Got: {combined!r}"
    )


# --- test 16 (gitcount integration): verifiedCommits in the envelope -----

def _init_repo_with_commit(path: Path, email: str, when_iso: str) -> Path:
    """Init a repo with one commit authored by `email` at `when_iso`."""
    path.mkdir(parents=True, exist_ok=True)

    def g(*args, env=None):
        subprocess.run(["git", "-C", str(path), *args],
                       check=True, capture_output=True, text=True, env=env)

    g("init", "-q")
    g("config", "user.email", email)
    g("config", "user.name", "T")
    (path / "f.txt").write_text("x", encoding="utf-8")
    cenv = dict(os.environ,
                GIT_AUTHOR_NAME="T", GIT_AUTHOR_EMAIL=email,
                GIT_COMMITTER_NAME="T", GIT_COMMITTER_EMAIL=email,
                GIT_AUTHOR_DATE=when_iso, GIT_COMMITTER_DATE=when_iso)
    g("add", "-A")
    g("commit", "-q", "-m", "c", env=cenv)
    return path


def test_verified_commits_emitted_and_leaks_nothing(tmp_path, monkeypatch):
    """A codex session whose cwd resolves to a real repo with one in-window
    commit yields verifiedCommits == 1 — and the cwd/email never appear in
    the envelope JSON (privacy invariant I1)."""
    repo = _init_repo_with_commit(tmp_path / "repo", "dev@x.io",
                                  "2026-05-19T10:00:00+00:00")
    cx = write_codex_log(tmp_path, "s1", str(repo), "gpt-5.5",
                         ts="2026-05-19T11:00:00Z")
    monkeypatch.setattr(collect_mod, "find_logs",
                        lambda tool, scan_root=None: [cx] if tool == "codex" else [])
    monkeypatch.setattr(collect_mod, "git_author_email", lambda: "dev@x.io")
    env = build_envelope(load_pricing(), SALT,
                         generated_at="2026-05-26T12:00:00Z", period="week")
    assert env["verifiedCommits"] == 1
    blob = json.dumps(env)
    assert str(repo) not in blob
    assert "dev@x.io" not in blob


def test_verified_commits_omitted_when_cwd_not_a_repo(tmp_path, monkeypatch):
    """A cwd that is not inside a git repo is unknown, not zero -> field omitted."""
    plain = tmp_path / "plain"
    plain.mkdir()
    cx = write_codex_log(tmp_path, "s1", str(plain), "gpt-5.5",
                         ts="2026-05-19T11:00:00Z")
    monkeypatch.setattr(collect_mod, "find_logs",
                        lambda tool, scan_root=None: [cx] if tool == "codex" else [])
    monkeypatch.setattr(collect_mod, "git_author_email", lambda: "dev@x.io")
    env = build_envelope(load_pricing(), SALT,
                         generated_at="2026-05-26T12:00:00Z", period="week")
    assert "verifiedCommits" not in env


def test_verified_commits_omitted_when_no_cwd_signal(tmp_path, monkeypatch):
    """Claude logs carry no line-level cwd in these fixtures -> no repo signal
    -> field omitted (never 0)."""
    cl = write_claude_log(tmp_path, "proj-a", "claude-opus-4-7",
                          ts="2026-05-19T09:00:00Z")
    monkeypatch.setattr(collect_mod, "find_logs",
                        lambda tool, scan_root=None: [cl] if tool == "claude" else [])
    monkeypatch.setattr(collect_mod, "git_author_email", lambda: "dev@x.io")
    env = build_envelope(load_pricing(), SALT,
                         generated_at="2026-05-26T12:00:00Z", period="week")
    assert "verifiedCommits" not in env


def test_verified_commits_real_zero_when_inspected(tmp_path, monkeypatch):
    """Repo resolves cleanly but the operator authored no commit in the window
    -> a genuine 0 IS emitted (distinct from omission)."""
    repo = _init_repo_with_commit(tmp_path / "repo", "dev@x.io",
                                  "2026-05-01T10:00:00+00:00")  # before window
    cx = write_codex_log(tmp_path, "s1", str(repo), "gpt-5.5",
                         ts="2026-05-19T11:00:00Z")
    monkeypatch.setattr(collect_mod, "find_logs",
                        lambda tool, scan_root=None: [cx] if tool == "codex" else [])
    monkeypatch.setattr(collect_mod, "git_author_email", lambda: "dev@x.io")
    env = build_envelope(load_pricing(), SALT,
                         generated_at="2026-05-26T12:00:00Z", period="week")
    assert env["verifiedCommits"] == 0


def test_verified_commits_partial_when_a_session_lacks_cwd(
        tmp_path, monkeypatch):
    """A window mixing a cwd-bearing repo session with a token-contributing
    session that has NO cwd now emits a CONSERVATIVE count from the verifiable
    repo — the cwd-less session is skipped, not a poison.

    Reversal of codex [P1] (2026-05-28): the cwd-less session used to poison the
    numerator to omission; under the relaxed contract its work is simply
    unattributable, so the numerator counts the repo it CAN verify (a lower
    bound). Only a window with NO verifiable repo at all omits the field."""
    repo = _init_repo_with_commit(tmp_path / "repo", "dev@x.io",
                                  "2026-05-19T10:00:00+00:00")
    cx = write_codex_log(tmp_path, "s1", str(repo), "gpt-5.5",
                         ts="2026-05-19T11:00:00Z")
    # The Claude fixture carries no line-level cwd → a contributing session
    # with no repo signal (skipped, not a poison).
    cl = write_claude_log(tmp_path, "proj-a", "claude-opus-4-7",
                          ts="2026-05-20T09:00:00Z")
    monkeypatch.setattr(
        collect_mod, "find_logs",
        lambda tool, scan_root=None: [cx] if tool == "codex" else [cl])
    monkeypatch.setattr(collect_mod, "git_author_email", lambda: "dev@x.io")
    env = build_envelope(load_pricing(), SALT,
                         generated_at="2026-05-26T12:00:00Z", period="week")
    # Both sessions contributed rows; the cwd-less one is skipped, the repo counts.
    assert len(env["rows"]) == 2
    assert env["verifiedCommits"] == 1
