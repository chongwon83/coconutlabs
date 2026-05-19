"""parsers.py — log parsing primitives shared by estimate_cost.py and collect.py.

The PoC entrypoint estimate_cost.py imports load_pricing / match_model /
detect_tool / find_logs / cost_breakdown / parse_claude / parse_codex from
here. collect.py imports the same primitives to build a Burn Summary.

SECURITY: parse_claude / parse_codex extract ONLY whitelisted numeric token
keys, the session timestamp, the model name, and a project-path slug. The
slug is hash input only and is never emitted. content / message.content /
payload text fields are never read or serialized.
"""

import json
import re
from dataclasses import dataclass
from pathlib import Path

# model-pricing.json sits one directory up (usage-poc/), not inside the package.
PRICING_PATH = Path(__file__).parent.parent / "model-pricing.json"

# A model identifier is a short token like 'claude-opus-4-7'. Anything with
# path separators, whitespace, or quotes is rejected so a corrupted/adversarial
# log cannot smuggle a path or secret into the whitelisted `model` field.
_MODEL_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,79}")


def _safe_model(raw: object) -> str | None:
    """Return raw only if it looks like a model id, else None.

    fullmatch (not match) is required: Python's `$` also matches just before
    a trailing newline, so `match` would accept 'model\\n'.
    """
    if isinstance(raw, str) and _MODEL_RE.fullmatch(raw):
        return raw
    return None


def _as_int(v: object) -> int:
    """Coerce a token field to a non-negative int; 0 if not a clean int.

    Guards against a malformed log carrying a string/float/bool where a
    token count is expected (bool is rejected despite subclassing int).
    """
    if isinstance(v, bool):
        return 0
    return v if isinstance(v, int) and v >= 0 else 0


@dataclass
class SessionParse:
    """One parsed session log.

    tool:         "claude" | "codex" (PoC-internal naming).
    model:        provider model identifier, "unknown" if none seen.
    tokens:       token-count dict — keys differ by tool, identical to the
                  PoC's historical `tok` dict so estimate_cost.py output
                  stays byte-identical.
    timestamp:    ISO 8601 string of the session, or None.
    project_slug: path-derived project identifier. HASH INPUT ONLY — callers
                  must never emit this raw.
    """

    tool: str
    model: str
    tokens: dict
    timestamp: str | None
    project_slug: str


def load_pricing() -> dict:
    """Load the model pricing table."""
    try:
        with open(PRICING_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        raise RuntimeError(f"cannot load pricing table: {e}") from e


def match_model(provider_table: dict, model: str) -> tuple[dict, str]:
    """Prefix-match a model name to a pricing row (longest prefix wins).

    A key's prefix must match at a hyphen boundary, so 'claude-opus-4-x'
    matches 'claude-opus-4-7' but not 'claude-opus-40'. Longest-prefix-wins
    removes order-dependency. Unmatched -> _default + 'low' confidence.
    """
    candidates = []
    for key, row in provider_table.items():
        if key == "_default":
            continue
        prefix = key[:-2] if key.endswith("-x") else key
        if model == prefix or model.startswith(prefix + "-"):
            candidates.append((len(prefix), row))
    if candidates:
        candidates.sort(key=lambda c: c[0], reverse=True)
        return candidates[0][1], "high"
    return provider_table.get("_default", {}), "low"


def detect_tool(path: Path) -> str:
    """Auto-detect claude vs codex from the log file path."""
    p = str(path)
    if ".codex" in p or path.name.startswith("rollout-"):
        return "codex"
    if ".claude" in p or "/projects/" in p:
        return "claude"
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            if '"token_count"' in line:
                return "codex"
            if '"type":"assistant"' in line or '"type": "assistant"' in line:
                return "claude"
    raise ValueError("cannot auto-detect tool; pass --tool")


def parse_claude(path: Path) -> SessionParse:
    """Sum per-message usage across all assistant lines (per-message billing).

    project_slug is the parent directory name under ~/.claude/projects/
    (a path slug); timestamp is the first line-level timestamp seen.
    """
    model = "unknown"
    timestamp: str | None = None
    tok = {"input": 0, "output": 0, "cache_read": 0,
           "cache_write_5m": 0, "cache_write_1h": 0}
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            if timestamp is None:
                ts = obj.get("timestamp")
                if isinstance(ts, str):
                    timestamp = ts
            msg = obj.get("message")
            if obj.get("type") != "assistant" or not isinstance(msg, dict):
                continue
            usage = msg.get("usage")
            if not isinstance(usage, dict):
                continue
            # _safe_model rejects '<synthetic>' (those lines carry a usage
            # dict but 0 tokens) along with any non-model-shaped string.
            m = _safe_model(msg.get("model"))
            if m:
                model = m
            cc = usage.get("cache_creation")
            if not isinstance(cc, dict):
                cc = {}
            tok["input"] += _as_int(usage.get("input_tokens"))
            tok["output"] += _as_int(usage.get("output_tokens"))
            tok["cache_read"] += _as_int(usage.get("cache_read_input_tokens"))
            tok["cache_write_5m"] += _as_int(cc.get("ephemeral_5m_input_tokens"))
            tok["cache_write_1h"] += _as_int(cc.get("ephemeral_1h_input_tokens"))
    return SessionParse("claude", model, tok, timestamp, path.parent.name)


def parse_codex(path: Path) -> SessionParse:
    """Take the final token_count event (total_token_usage is cumulative).

    project_slug is taken from the session-meta payload's `cwd` — read ONLY
    as salted-hash input, never emitted. timestamp is the first line-level
    timestamp seen.
    """
    model = "unknown"
    timestamp: str | None = None
    cwd = ""
    final = None
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            if timestamp is None:
                ts = obj.get("timestamp")
                if isinstance(ts, str):
                    timestamp = ts
            payload = obj.get("payload")
            if not isinstance(payload, dict):
                continue
            if not cwd and isinstance(payload.get("cwd"), str):
                cwd = payload["cwd"]
            m = _safe_model(payload.get("model"))
            if m:
                model = m
            if payload.get("type") == "token_count":
                ttu = (payload.get("info") or {}).get("total_token_usage")
                if isinstance(ttu, dict):
                    final = ttu
    if final is None:
        raise ValueError(f"no token_count event in {path.name}")
    cached = _as_int(final.get("cached_input_tokens"))
    # input_tokens includes cached_input_tokens as a subset -> split, no double-bill.
    tok = {"input": max(_as_int(final.get("input_tokens")) - cached, 0),
           "cached_input": cached,
           "output": _as_int(final.get("output_tokens"))}
    return SessionParse("codex", model, tok, timestamp, cwd)


def cost_breakdown(tok: dict, price: dict) -> dict:
    """tokens x price / 1e6 per category."""
    return {cat: tok[cat] * price.get(cat, 0) / 1_000_000
            for cat in tok if cat in price}


CLAUDE_LOG_GLOB = ("~/.claude/projects", "*/*.jsonl")
CODEX_LOG_GLOB = ("~/.codex/sessions", "*/*/*/rollout-*.jsonl")


def find_logs(tool: str) -> list[Path]:
    """Glob all local session logs for a tool (standard install paths)."""
    base, pattern = CLAUDE_LOG_GLOB if tool == "claude" else CODEX_LOG_GLOB
    return sorted(Path(base).expanduser().glob(pattern))
