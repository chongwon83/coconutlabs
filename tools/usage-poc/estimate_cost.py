#!/usr/bin/env python3
"""estimate_cost.py — CoconutLabs Usage PoC cost estimator.

Reads a Claude Code or Codex CLI session JSONL log and estimates USD cost
from token counts x model pricing (the "Estimated" verification tier).

SECURITY: parsing a JSONL line necessarily materializes the whole record,
but this script only ever *extracts* whitelisted numeric token keys and
*outputs* aggregates — it never reads, serializes, or emits
content / message.content / payload text fields. Output is the same
whitelist the real collector would upload.

Usage:
    ./estimate_cost.py <log-file> [--tool claude|codex] [--json]
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
            model = msg.get("model", model)
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
        print("Error: no token_count event found in Codex log", file=sys.stderr)
        sys.exit(1)
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
        "estimated_cost_usd": round(sum(breakdown.values()), 6),
        "cost_breakdown_usd": {k: round(v, 6) for k, v in breakdown.items()},
        "pricing_as_of": pricing.get("_pricing_as_of", "unknown"),
        "price_confidence": confidence,
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
        print(f"    {cat:<16} ${c:>12.6f}")
    print(f"  estimated_cost_usd:  ${r['estimated_cost_usd']:.6f}")
    if r["price_confidence"] == "low":
        print("  WARNING: model unmatched — used _default pricing.")


def main() -> None:
    args = [a for a in sys.argv[1:]]
    as_json = "--json" in args
    args = [a for a in args if a != "--json"]
    tool = None
    if "--tool" in args:
        i = args.index("--tool")
        tool = args[i + 1] if i + 1 < len(args) else None
        del args[i:i + 2]
    if not args:
        print(__doc__)
        sys.exit(1)
    path = Path(args[0]).expanduser()
    if not path.is_file():
        print(f"Error: file not found: {path}", file=sys.stderr)
        sys.exit(1)
    if tool not in ("claude", "codex"):
        tool = detect_tool(path)
    result = build_result(tool, path, load_pricing())
    if as_json:
        print(json.dumps(result, indent=2, ensure_ascii=False))
    else:
        print_table(result)


if __name__ == "__main__":
    main()
