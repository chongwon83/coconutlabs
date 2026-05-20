#!/usr/bin/env python3
"""estimate_cost.py — CoconutLabs Usage PoC cost estimator.

Reads a Claude Code or Codex CLI session JSONL log and estimates USD cost
from token counts x model pricing (the "Estimated" verification tier).

This is now a thin CLI shim: the parsing primitives (load_pricing,
match_model, detect_tool, find_logs, cost_breakdown, parse_claude,
parse_codex) live in coconut_collector/parsers.py and are shared with the
collector. The aggregation + table output below are unchanged so the PoC
report stays byte-identical.

SECURITY: parsers only ever extract whitelisted numeric token keys,
timestamps, model names, and project-path slugs (hash input only) — never
content / message.content / payload text fields. Output is the same
whitelist the real collector would upload. --all mode globs the standard
log directories (~/.claude/projects, ~/.codex/sessions).

Usage:
    ./estimate_cost.py <log-file> [--tool claude|codex] [--json]
    ./estimate_cost.py --all [--json]   # aggregate every local session
"""

import json
import sys
from pathlib import Path

from coconut_collector.hashing import load_or_create_salt
from coconut_collector.parsers import cost_breakdown  # noqa: F401
from coconut_collector.parsers import (find_logs, match_model, parse_claude,
                                       parse_codex)
from coconut_collector.parsers import detect_tool as _detect_tool
from coconut_collector.parsers import load_pricing as _load_pricing


def load_pricing() -> dict:
    """Load the model pricing table (exits 1 on failure, as the PoC did)."""
    try:
        return _load_pricing()
    except RuntimeError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


def detect_tool(path: Path) -> str:
    """Auto-detect claude vs codex (exits 1 on failure, as the PoC did)."""
    try:
        return _detect_tool(path)
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


def build_result(tool: str, path: Path, pricing: dict) -> dict:
    """Parse the log and assemble the aggregate-only result."""
    salt = load_or_create_salt()
    sp = parse_claude(path, salt) if tool == "claude" else parse_codex(path, salt)
    model, tok = sp.model, sp.tokens
    price, confidence = match_model(pricing.get(tool, {}), model)
    breakdown = cost_breakdown(tok, price)
    return {
        "tool": tool,
        "model": model,
        "token_totals": tok,
        "total_tokens": sum(tok.values()),
        # round to 4 dp: json.dumps emits scientific notation for floats
        # below 1e-4, so 4 is the deepest precision that stays plain decimal.
        "estimated_cost_usd": round(sum(breakdown.values()), 4),
        "cost_breakdown_usd": {k: round(v, 4) for k, v in breakdown.items()},
        "pricing_as_of": pricing.get("_pricing_as_of", "unknown"),
        "price_confidence": confidence,
    }


def aggregate_sessions(pricing: dict) -> dict:
    """Sum token usage across every local session, grouped by (tool, model).

    Each log file is one session, so summing file-level totals never
    double-bills. Files that fail to parse or carry zero tokens are skipped
    and counted, never silently dropped.
    """
    groups: dict[tuple[str, str], dict] = {}
    scanned = {t: {"files": 0, "ok": 0, "skipped": 0}
               for t in ("claude", "codex")}
    salt = load_or_create_salt()
    for tool in ("claude", "codex"):
        parse = parse_claude if tool == "claude" else parse_codex
        for path in find_logs(tool):
            scanned[tool]["files"] += 1
            try:
                sp = parse(path, salt)
            except (ValueError, OSError, json.JSONDecodeError):
                scanned[tool]["skipped"] += 1
                continue
            model, tok = sp.model, sp.tokens
            if sum(tok.values()) == 0:
                scanned[tool]["skipped"] += 1
                continue
            scanned[tool]["ok"] += 1
            grp = groups.setdefault((tool, model), {k: 0 for k in tok})
            for k, v in tok.items():
                grp[k] = grp.get(k, 0) + v
    return {"groups": groups, "scanned": scanned}


def build_aggregate_result(pricing: dict) -> dict:
    """Assemble the all-session aggregate (per-model rows + grand total)."""
    agg = aggregate_sessions(pricing)
    per_model = []
    total_cost = 0.0
    total_tokens = 0
    for (tool, model), tok in sorted(agg["groups"].items()):
        price, confidence = match_model(pricing.get(tool, {}), model)
        breakdown = cost_breakdown(tok, price)
        cost = round(sum(breakdown.values()), 4)
        per_model.append({
            "tool": tool,
            "model": model,
            "token_totals": tok,
            "total_tokens": sum(tok.values()),
            "estimated_cost_usd": cost,
            "cost_breakdown_usd": {k: round(v, 4)
                                   for k, v in breakdown.items()},
            "price_confidence": confidence,
        })
        total_cost += cost
        total_tokens += sum(tok.values())
    return {
        "mode": "aggregate",
        "pricing_as_of": pricing.get("_pricing_as_of", "unknown"),
        "scanned": agg["scanned"],
        "per_model": per_model,
        "grand_total_tokens": total_tokens,
        "grand_total_cost_usd": round(total_cost, 4),
    }


def print_table(r: dict) -> None:
    """Human-readable summary (aggregates only)."""
    print("=== CoconutLabs Usage PoC — Estimated Cost ===")
    print(f"  tool:              {r['tool']}")
    print(f"  model:             {r['model']}")
    print(f"  pricing_as_of:     {r['pricing_as_of']}")
    print(f"  price_confidence:  {r['price_confidence']}")
    print("  --- tokens ---")
    for cat, n in r["token_totals"].items():
        print(f"    {cat:<16} {n:>12,}")
    print(f"    {'TOTAL':<16} {r['total_tokens']:>12,}")
    print("  --- cost (USD) ---")
    for cat, c in r["cost_breakdown_usd"].items():
        print(f"    {cat:<16} ${c:>12.4f}")
    print(f"  estimated_cost_usd:  ${r['estimated_cost_usd']:.4f}")
    if r["price_confidence"] == "low":
        print("  WARNING: model unmatched — used _default pricing.")


def print_aggregate_table(r: dict) -> None:
    """Human-readable all-session aggregate (aggregates only)."""
    print("=== CoconutLabs Usage PoC — All-Session Aggregate ===")
    print(f"  pricing_as_of:  {r['pricing_as_of']}")
    for tool, s in r["scanned"].items():
        print(f"  scanned {tool:<7} {s['ok']}/{s['files']} files "
              f"({s['skipped']} skipped: empty or unparseable)")
    print("  --- per model ---")
    for m in r["per_model"]:
        print(f"  [{m['tool']}] {m['model']}  ({m['price_confidence']})")
        print(f"    {m['total_tokens']:>15,} tokens"
              f"    ${m['estimated_cost_usd']:>12.4f}")
    print("  --- grand total ---")
    print(f"    {r['grand_total_tokens']:>15,} tokens"
          f"    ${r['grand_total_cost_usd']:>12.4f}")
    low = [m for m in r["per_model"] if m["price_confidence"] == "low"]
    if low:
        print(f"  WARNING: {len(low)} model group(s) used _default pricing "
              f"(unmatched model name).")


def main() -> None:
    args = [a for a in sys.argv[1:]]
    as_json = "--json" in args
    args = [a for a in args if a != "--json"]
    aggregate_mode = "--all" in args
    args = [a for a in args if a != "--all"]
    tool = None
    if "--tool" in args:
        i = args.index("--tool")
        tool = args[i + 1] if i + 1 < len(args) else None
        del args[i:i + 2]
    if aggregate_mode:
        result = build_aggregate_result(load_pricing())
        if as_json:
            print(json.dumps(result, indent=2, ensure_ascii=False))
        else:
            print_aggregate_table(result)
        return
    if not args:
        print(__doc__)
        sys.exit(1)
    path = Path(args[0]).expanduser()
    if not path.is_file():
        print(f"Error: file not found: {path}", file=sys.stderr)
        sys.exit(1)
    if tool not in ("claude", "codex"):
        tool = detect_tool(path)
    try:
        result = build_result(tool, path, load_pricing())
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
    if as_json:
        print(json.dumps(result, indent=2, ensure_ascii=False))
    else:
        print_table(result)


if __name__ == "__main__":
    main()
