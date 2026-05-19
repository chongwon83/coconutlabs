"""collect.py — build a Burn Summary envelope from local session logs.

Groups parsed sessions by (tool, model, projectHash) and emits an envelope
conforming to web/tools/usage-poc/burn-summary.schema.json.

SECURITY: output carries ONLY the 9 uploadable fields (handoff §8). Project
path slugs are consumed by project_hash() and never emitted; content fields
are never read.
"""

import json
import re
from datetime import datetime, timezone

from .hashing import load_or_create_salt, project_hash
from .parsers import (cost_breakdown, find_logs, load_pricing, match_model,
                      parse_claude, parse_codex)

# PoC-internal tool name -> Burn Summary `tool` enum.
_TOOL_NAME = {"claude": "claude-code", "codex": "codex"}
_DAY_RE = re.compile(r"^(\d{4}-\d{2}-\d{2})")


def _utc_day(timestamp: str | None) -> str | None:
    """Extract a 'YYYY-MM-DD' UTC day from an ISO-8601 timestamp."""
    if not timestamp:
        return None
    m = _DAY_RE.match(timestamp)
    return m.group(1) if m else None


def _schema_token_count(tool: str, tok: dict) -> dict:
    """Map a PoC tok dict to the schema's tokenCount shape."""
    if tool == "claude":
        return {
            "input": tok.get("input", 0),
            "output": tok.get("output", 0),
            "cacheRead": tok.get("cache_read", 0),
            "cacheWrite": tok.get("cache_write_5m", 0) + tok.get("cache_write_1h", 0),
            "cachedInput": 0,
        }
    return {
        "input": tok.get("input", 0),
        "output": tok.get("output", 0),
        "cacheRead": 0,
        "cacheWrite": 0,
        "cachedInput": tok.get("cached_input", 0),
    }


def _verification(price_confidence: str) -> dict:
    """Build the verification object for a device-collected, estimated row.

    Unmatched model (low confidence) downgrades the display level to
    'Estimated' — see coconutlabs-verification-model.md §0-A.
    """
    level = "Device-synced" if price_confidence == "high" else "Estimated"
    return {
        "tokenSource": "device",
        "costBasis": "estimated",
        "priceConfidence": price_confidence,
        "level": level,
    }


def collect(pricing: dict, salt: str) -> dict:
    """Scan every local session log and aggregate into grouped rows.

    Each log file is one session. Files that fail to parse or carry zero
    tokens are skipped.
    """
    groups: dict[tuple, dict] = {}
    for tool in ("claude", "codex"):
        parse = parse_claude if tool == "claude" else parse_codex
        for path in find_logs(tool):
            try:
                sp = parse(path)
            except (ValueError, OSError, json.JSONDecodeError):
                continue
            if sum(sp.tokens.values()) == 0:
                continue
            phash = project_hash(sp.project_slug, salt)
            key = (tool, sp.model, phash)
            grp = groups.get(key)
            if grp is None:
                grp = {"tokens": {k: 0 for k in sp.tokens},
                       "sessions": 0, "days": set()}
                groups[key] = grp
            for k, v in sp.tokens.items():
                grp["tokens"][k] = grp["tokens"].get(k, 0) + v
            grp["sessions"] += 1
            day = _utc_day(sp.timestamp)
            if day:
                grp["days"].add(day)
    return groups


def build_envelope(pricing: dict, salt: str,
                   generated_at: str | None = None) -> dict:
    """Assemble the Burn Summary envelope (schemaVersion 1)."""
    if generated_at is None:
        generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    fallback_day = generated_at[:10]
    groups = collect(pricing, salt)
    rows = []
    total_tokens = 0
    total_cost = 0.0
    for (tool, model, phash), grp in sorted(groups.items()):
        tok = grp["tokens"]
        price, confidence = match_model(pricing.get(tool, {}), model)
        cost = round(sum(cost_breakdown(tok, price).values()), 4)
        token_count = _schema_token_count(tool, tok)
        row_total = sum(token_count.values())
        days = sorted(grp["days"])
        rows.append({
            "tool": _TOOL_NAME[tool],
            "model": model,
            "tokenCount": token_count,
            "totalTokens": row_total,
            "estimatedCostUsd": cost,
            "timestampBucket": days[-1] if days else fallback_day,
            "sessionCount": grp["sessions"],
            "activeDays": len(days),
            "projectHash": phash,
            "verification": _verification(confidence),
        })
        total_tokens += row_total
        total_cost += cost
    return {
        "schemaVersion": "1",
        "generatedAt": generated_at,
        "rows": rows,
        "grandTotal": {
            "totalTokens": total_tokens,
            "estimatedCostUsd": round(total_cost, 4),
        },
    }


def print_table(envelope: dict) -> None:
    """Human-readable summary (aggregates only)."""
    print("=== CoconutLabs Burn Summary ===")
    print(f"  schemaVersion:  {envelope['schemaVersion']}")
    print(f"  generatedAt:    {envelope['generatedAt']}")
    print(f"  rows:           {len(envelope['rows'])}")
    print("  --- per group (tool / model / projectHash) ---")
    for r in envelope["rows"]:
        v = r["verification"]
        print(f"  [{r['tool']}] {r['model']}  {r['projectHash']}  ({v['level']})")
        print(f"    {r['totalTokens']:>15,} tokens"
              f"    ${r['estimatedCostUsd']:>12.4f}"
              f"    {r['sessionCount']} sessions / {r['activeDays']} active days")
    gt = envelope["grandTotal"]
    print("  --- grand total ---")
    print(f"    {gt['totalTokens']:>15,} tokens"
          f"    ${gt['estimatedCostUsd']:>12.4f}")
