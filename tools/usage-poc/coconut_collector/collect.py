"""collect.py — build a Burn Summary envelope from local session logs.

Groups parsed sessions by (tool, model, projectHash) and emits an envelope
conforming to web/tools/usage-poc/burn-summary.schema.json.

SECURITY: output carries ONLY the 9 uploadable fields (handoff §8). Project
path slugs are consumed by project_hash() and never emitted; content fields
are never read.
"""

import json
import re
from datetime import datetime, timedelta, timezone

from .hashing import load_or_create_salt, project_hash
from .parsers import (cost_breakdown, find_logs, load_pricing, match_model,
                      parse_claude, parse_codex)

# PoC-internal tool name -> Burn Summary `tool` enum.
_TOOL_NAME = {"claude": "claude-code", "codex": "codex"}
_DAY_RE = re.compile(r"^(\d{4}-\d{2}-\d{2})")

# Selectable leaderboard windows. 'all' disables filtering (local audit only).
_PERIODS = ("day", "week", "month", "year", "all")


def _utc_day(timestamp: str | None) -> str | None:
    """Extract a 'YYYY-MM-DD' UTC day from an ISO-8601 timestamp."""
    if not timestamp:
        return None
    m = _DAY_RE.match(timestamp)
    return m.group(1) if m else None


def _parse_instant(timestamp: str | None) -> datetime | None:
    """Parse an ISO-8601 session timestamp into an aware UTC datetime.

    'Z' is normalised to '+00:00'; naive timestamps are assumed UTC.
    Returns None when the timestamp is missing or unparseable.
    """
    if not timestamp:
        return None
    try:
        dt = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _calendar_window(period: str,
                     now: datetime) -> tuple[datetime, datetime] | None:
    """Return the [since, until) UTC calendar bucket for `now`.

    'all' returns None (no filtering). Buckets are calendar-aligned, not
    rolling: day/month/year snap to the bucket containing `now`. 'week' is
    the LAST COMPLETED ISO week (prior Monday..this Monday), not the
    in-progress one — so a Monday and a Sunday importer compete over the
    same fully-elapsed 7 days.
    """
    if period == "all":
        return None
    day0 = now.astimezone(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0)
    if period == "day":
        return day0, day0 + timedelta(days=1)
    if period == "week":
        this_monday = day0 - timedelta(days=day0.weekday())
        return this_monday - timedelta(weeks=1), this_monday
    if period == "month":
        since = day0.replace(day=1)
        if since.month == 12:
            until = since.replace(year=since.year + 1, month=1)
        else:
            until = since.replace(month=since.month + 1)
        return since, until
    if period == "year":
        since = day0.replace(month=1, day=1)
        return since, since.replace(year=since.year + 1)
    raise ValueError(f"unknown period: {period!r}")


def _in_window(sp, window: tuple[datetime, datetime] | None) -> bool:
    """Whether session `sp` belongs to `window` (attributed by start time).

    None window means no filtering. A session whose timestamp cannot be
    parsed is excluded when a window is active — it cannot prove membership.
    """
    if window is None:
        return True
    instant = _parse_instant(sp.timestamp)
    if instant is None:
        return False
    since, until = window
    return since <= instant < until


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


def collect(pricing: dict, salt: str, period: str = "all",
            now: datetime | None = None) -> dict:
    """Scan every local session log and aggregate into grouped rows.

    Each log file is one session. Files that fail to parse or carry zero
    tokens are skipped. When `period` is not 'all', sessions are filtered
    to the calendar window containing `now` (defaults to the current UTC
    instant); a session is attributed by its first-line start timestamp.
    """
    if now is None:
        now = datetime.now(timezone.utc)
    window = _calendar_window(period, now)
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
            if not _in_window(sp, window):
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
                   generated_at: str | None = None,
                   period: str = "week") -> dict:
    """Assemble the Burn Summary envelope (schemaVersion 2).

    `period` selects the calendar window (day/week/month/year/all). The
    window end and `generatedAt` are anchored to the same instant. Raises
    ValueError when `period` is unknown or no sessions fall in the window.
    """
    if period not in _PERIODS:
        raise ValueError(f"unknown period: {period!r}")
    if generated_at is None:
        now = datetime.now(timezone.utc)
        generated_at = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    else:
        now = _parse_instant(generated_at)
        if now is None:
            raise ValueError(f"invalid generatedAt: {generated_at!r}")
        # Re-derive from the parsed instant so an offset/fractional-second
        # input still serialises as schema-valid second-precision UTC 'Z'.
        generated_at = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    fallback_day = generated_at[:10]
    groups = collect(pricing, salt, period=period, now=now)
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
    if not rows:
        raise ValueError(f"no sessions in period '{period}'")
    window = _calendar_window(period, now)
    if window is None:
        since_iso = until_iso = None
    else:
        since_iso = window[0].strftime("%Y-%m-%dT%H:%M:%SZ")
        until_iso = window[1].strftime("%Y-%m-%dT%H:%M:%SZ")
    return {
        "schemaVersion": "2",
        "generatedAt": generated_at,
        "periodWindow": {
            "period": period,
            "since": since_iso,
            "until": until_iso,
        },
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
    pw = envelope.get("periodWindow")
    if pw:
        span = (f"{pw['since']} .. {pw['until']}"
                if pw["since"] else "(unfiltered)")
        print(f"  period:         {pw['period']}  [{span}]")
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
