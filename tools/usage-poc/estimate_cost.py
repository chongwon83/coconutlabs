#!/usr/bin/env python3
"""estimate_cost.py — CoconutLabs Usage PoC cost estimator.

Reads a Claude Code or Codex CLI session JSONL log and estimates USD cost
from token counts x model pricing (the "Estimated" verification tier).

SECURITY: parsing a JSONL line necessarily materializes the whole record,
but this script only ever *extracts* whitelisted numeric token keys and
*outputs* aggregates — it never reads, serializes, or emits
content / message.content / payload text fields. Output is the same
whitelist the real collector would upload. --all mode globs the standard
log directories (~/.claude/projects, ~/.codex/sessions); the same
whitelist applies to every file.

Usage:
    ./estimate_cost.py <log-file> [--tool claude|codex] [--json]
    ./estimate_cost.py --all [--json]   # aggregate every local session
"""

import json
import sys
from pathlib import Path

PRICING_PATH = Path(__file__).parent / "model-pricing.json"


def load_pricing() -> dict:
    """Load the model pricing table."""
    try:
        with open(PRICING_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"Error: cannot load pricing table: {e}", file=sys.stderr)
        sys.exit(1)


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
    # Fallback: sniff first matching line.
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            if '"token_count"' in line:
                return "codex"
            if '"type":"assistant"' in line or '"type": "assistant"' in line:
                return "claude"
    print("Error: cannot auto-detect tool; pass --tool", file=sys.stderr)
    sys.exit(1)


def parse_claude(path: Path) -> tuple[str, dict]:
    """Sum per-message usage across all assistant lines (per-message billing)."""
    model = "unknown"
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
            msg = obj.get("message")
            if obj.get("type") != "assistant" or not isinstance(msg, dict):
                continue
            usage = msg.get("usage")
            if not isinstance(usage, dict):
                continue
            # <synthetic> lines carry a usage dict but 0 tokens; never let
            # one overwrite the real model or the file's whole token sum
            # gets mis-attributed to a bogus '<synthetic>' group.
            m = msg.get("model")
            if m and m != "<synthetic>":
                model = m
            cc = usage.get("cache_creation") or {}
            tok["input"] += usage.get("input_tokens", 0)
            tok["output"] += usage.get("output_tokens", 0)
            tok["cache_read"] += usage.get("cache_read_input_tokens", 0)
            tok["cache_write_5m"] += cc.get("ephemeral_5m_input_tokens", 0)
            tok["cache_write_1h"] += cc.get("ephemeral_1h_input_tokens", 0)
    return model, tok


def parse_codex(path: Path) -> tuple[str, dict]:
    """Take the final token_count event (total_token_usage is cumulative)."""
    model = "unknown"
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
            payload = obj.get("payload")
            if not isinstance(payload, dict):
                continue
            if payload.get("model"):
                model = payload["model"]
            if payload.get("type") == "token_count":
                ttu = (payload.get("info") or {}).get("total_token_usage")
                if isinstance(ttu, dict):
                    final = ttu
    if final is None:
        raise ValueError(f"no token_count event in {path.name}")
    cached = final.get("cached_input_tokens", 0)
    # input_tokens includes cached_input_tokens as a subset -> split, no double-bill.
    tok = {"input": max(final.get("input_tokens", 0) - cached, 0),
           "cached_input": cached,
           "output": final.get("output_tokens", 0)}
    return model, tok


def cost_breakdown(tok: dict, price: dict) -> dict:
    """tokens x price / 1e6 per category."""
    return {cat: tok[cat] * price.get(cat, 0) / 1_000_000
            for cat in tok if cat in price}


def build_result(tool: str, path: Path, pricing: dict) -> dict:
    """Parse the log and assemble the aggregate-only result."""
    model, tok = (parse_claude(path) if tool == "claude"
                  else parse_codex(path))
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


CLAUDE_LOG_GLOB = ("~/.claude/projects", "*/*.jsonl")
CODEX_LOG_GLOB = ("~/.codex/sessions", "*/*/*/rollout-*.jsonl")


def find_logs(tool: str) -> list[Path]:
    """Glob all local session logs for a tool (standard install paths)."""
    base, pattern = CLAUDE_LOG_GLOB if tool == "claude" else CODEX_LOG_GLOB
    return sorted(Path(base).expanduser().glob(pattern))


def aggregate_sessions(pricing: dict) -> dict:
    """Sum token usage across every local session, grouped by (tool, model).

    Each log file is one session, so summing file-level totals never
    double-bills. Files that fail to parse or carry zero tokens are skipped
    and counted, never silently dropped.
    """
    groups: dict[tuple[str, str], dict] = {}
    scanned = {t: {"files": 0, "ok": 0, "skipped": 0}
               for t in ("claude", "codex")}
    for tool in ("claude", "codex"):
        parse = parse_claude if tool == "claude" else parse_codex
        for path in find_logs(tool):
            scanned[tool]["files"] += 1
            try:
                model, tok = parse(path)
            except (ValueError, OSError, json.JSONDecodeError):
                scanned[tool]["skipped"] += 1
                continue
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
