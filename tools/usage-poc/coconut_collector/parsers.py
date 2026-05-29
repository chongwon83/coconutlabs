"""parsers.py — log parsing primitives shared by estimate_cost.py and collect.py.

The PoC entrypoint estimate_cost.py imports load_pricing / match_model /
detect_tool / find_logs / cost_breakdown / parse_claude / parse_codex from
here. collect.py imports the same primitives to build a Burn Summary.

SECURITY: parse_claude / parse_codex extract ONLY whitelisted numeric token
keys, the session timestamp, the model name, and a salted project hash. The
raw path slug is used only as hash input inside the parsers and is NEVER
emitted. content / message.content / payload text fields are never read or
serialized. SessionParse carries only the 12-hex projectHash — callers cannot
accidentally emit a raw slug because the field does not exist.
"""

import json
import re
from importlib.resources import files
from dataclasses import dataclass
from pathlib import Path

from .hashing import project_hash

# A model identifier is a short token like 'claude-opus-4-7'. Anything with
# path separators, whitespace, or quotes is rejected so a corrupted/adversarial
# log cannot smuggle a path or secret into the whitelisted `model` field.
_MODEL_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,79}")

# Provider-prefix allowlist. Mirrors TS `KNOWN_MODEL_PREFIXES` in
# web/lib/client/burn/parsers.ts so the Python and browser collectors agree
# on which model strings can be carried as-is vs. coerced to 'unknown'.
# Match policy: `raw == prefix` or `raw.startswith(prefix + "-")` — the
# hyphen boundary blocks 'claude-opus-5' (allow) vs. 'claude-opus5' (deny)
# style smuggling. Unknown families (e.g. 'gemini-3-pro') downgrade to
# 'unknown', which `match_model` then prices via `_default` + 'low'.
_KNOWN_MODEL_PREFIXES = frozenset({
    "claude-opus",
    "claude-sonnet",
    "claude-haiku",
    "gpt",
    "o3",
    "o4",
})


def _safe_model(raw: object) -> str | None:
    """Return raw only if it looks like a model id AND matches an allowed
    provider-family prefix, else None.

    Two-stage gate:
      1. shape gate (_MODEL_RE.fullmatch) — rejects paths, whitespace, quotes
      2. family gate (_KNOWN_MODEL_PREFIXES) — rejects unknown providers so
         a tampered log cannot inject an unfamiliar 'model' string

    fullmatch (not match) is required: Python's `$` also matches just before
    a trailing newline, so `match` would accept 'model\\n'.
    """
    if not isinstance(raw, str) or not _MODEL_RE.fullmatch(raw):
        return None
    for prefix in _KNOWN_MODEL_PREFIXES:
        if raw == prefix or raw.startswith(prefix + "-"):
            return raw
    return None


# Matches JS Number.MAX_SAFE_INTEGER (2^53-1) so Python and browser runtimes
# agree on the maximum token value — a log carrying a larger int coerces to 0.
_MAX_SAFE_INT = (1 << 53) - 1


def _as_int(v: object) -> int:
    """Coerce a token field to a non-negative int ≤ MAX_SAFE_INTEGER; 0 otherwise.

    Guards against a malformed log carrying a string/float/bool where a
    token count is expected (bool is rejected despite subclassing int).
    Values above 2^53-1 are rejected to match JS Number.MAX_SAFE_INTEGER
    and prevent cross-runtime parity failures.
    """
    if isinstance(v, bool):
        return 0
    if isinstance(v, int) and 0 <= v <= _MAX_SAFE_INT:
        return v
    return 0


@dataclass
class SessionParse:
    """One parsed session log.

    tool:         "claude" | "codex" (PoC-internal naming).
    model:        provider model identifier, "unknown" if none seen.
    tokens:       token-count dict — keys differ by tool, identical to the
                  PoC's historical `tok` dict so estimate_cost.py output
                  stays byte-identical.
    timestamp:    ISO 8601 string of the session, or None.
    project_hash: 12-hex salted hash of the raw path slug. The raw slug is
                  consumed inside parse_claude/parse_codex and NEVER stored
                  here — callers cannot accidentally emit it.
    cwd:          raw working directory of the session, or None when the log
                  carries none. Used ONLY locally by gitcount to resolve repo
                  roots — it is NEVER written into an uploaded envelope.
    """

    tool: str
    model: str
    tokens: dict
    timestamp: str | None
    project_hash: str
    cwd: str | None = None


def load_pricing() -> dict:
    """Load the model pricing table (bundled inside the package)."""
    try:
        data = files("coconut_collector").joinpath("model-pricing.json").read_text("utf-8")
        return json.loads(data)
    except (FileNotFoundError, json.JSONDecodeError, Exception) as e:
        raise RuntimeError(f"cannot load pricing table: {e}") from e


def match_model(provider_table: dict, model: str) -> tuple[dict, str]:
    """Prefix-match a model name to a pricing row (longest prefix wins).

    A key's prefix must match at a hyphen boundary, so 'claude-opus-4-x'
    matches 'claude-opus-4-7' but not 'claude-opus-40'. Longest-prefix-wins
    removes order-dependency.

    A '-x' key is a current-generation wildcard. A wildcard-only match prices
    at the current tier but reports 'low' confidence: it is a family estimate,
    not a recognised version, so a not-yet-listed future minor is flagged
    'Estimated' rather than charged a sibling rate at high confidence. An exact
    or dated version key (longer prefix) wins the tie and stays 'high'.
    Unmatched -> _default + 'low' confidence.

    Mirrors matchModel in web/lib/client/burn/parsers.ts.
    """
    candidates = []
    for key, row in provider_table.items():
        if key == "_default":
            continue
        is_wildcard = key.endswith("-x")
        prefix = key[:-2] if is_wildcard else key
        if model == prefix or model.startswith(prefix + "-"):
            candidates.append((len(prefix), is_wildcard, row))
    if candidates:
        # Longest prefix wins; on a tie a non-wildcard (specific) key beats the
        # wildcard so an exact version never degrades to Estimated.
        candidates.sort(key=lambda c: (c[0], not c[1]), reverse=True)
        _, best_is_wildcard, best_row = candidates[0]
        return best_row, ("low" if best_is_wildcard else "high")
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


def parse_claude(path: Path, salt: str) -> SessionParse:
    """Sum per-message usage across all assistant lines (per-message billing).

    The raw slug (parent directory name under ~/.claude/projects/) is hashed
    with `salt` inline; the raw slug is NEVER stored or returned.
    timestamp is the first line-level timestamp seen.
    """
    model = "unknown"
    timestamp: str | None = None
    cwd: str | None = None
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
            # The Claude slug (parent dir name) is irreversible, so the actual
            # working directory must come from the line-level cwd field.
            if cwd is None:
                c = obj.get("cwd")
                if isinstance(c, str) and c:
                    cwd = c
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
    raw_slug = path.parent.name
    return SessionParse("claude", model, tok, timestamp,
                        project_hash(raw_slug, salt), cwd)


def parse_codex(path: Path, salt: str) -> SessionParse:
    """Take the final token_count event (total_token_usage is cumulative).

    The raw cwd from the session-meta payload is used only as salted-hash
    input and is NEVER stored or returned. timestamp is the first line-level
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
                # F7: explicit isinstance guard — `or {}` would pass a truthy
                # non-dict (list, str) through and cause AttributeError on .get().
                info = payload.get("info")
                if not isinstance(info, dict):
                    continue
                ttu = info.get("total_token_usage")
                if isinstance(ttu, dict):
                    final = ttu
    if final is None:
        raise ValueError(f"no token_count event in {path.name}")
    cached = _as_int(final.get("cached_input_tokens"))
    # input_tokens includes cached_input_tokens as a subset -> split, no double-bill.
    tok = {"input": max(_as_int(final.get("input_tokens")) - cached, 0),
           "cached_input": cached,
           "output": _as_int(final.get("output_tokens"))}
    return SessionParse("codex", model, tok, timestamp,
                        project_hash(cwd, salt), cwd or None)


def cost_breakdown(tok: dict, price: dict) -> dict:
    """tokens x price / 1e6 per category."""
    return {cat: tok[cat] * price.get(cat, 0) / 1_000_000
            for cat in tok if cat in price}


CLAUDE_LOG_GLOB = ("~/.claude/projects", "*/*.jsonl")
CODEX_LOG_GLOB = ("~/.codex/sessions", "*/*/*/rollout-*.jsonl")


def find_logs(tool: str, scan_root: Path | None = None) -> list[Path]:
    """Glob all local session logs for a tool.

    When `scan_root` is None the standard install-relative paths are used
    (``~/.claude/projects`` and ``~/.codex/sessions``). When provided, logs
    are searched under ``scan_root/.claude/projects`` and
    ``scan_root/.codex/sessions`` — useful when the user passes their home
    directory explicitly (e.g. ``coconut-collector ~/``).
    """
    if scan_root is None:
        base, pattern = CLAUDE_LOG_GLOB if tool == "claude" else CODEX_LOG_GLOB
        return sorted(Path(base).expanduser().glob(pattern))
    if tool == "claude":
        base = scan_root / ".claude" / "projects"
        pattern = "*/*.jsonl"
    else:
        base = scan_root / ".codex" / "sessions"
        pattern = "*/*/*/rollout-*.jsonl"
    return sorted(base.glob(pattern)) if base.is_dir() else []
