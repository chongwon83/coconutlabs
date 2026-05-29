import { describe, it, expect } from "vitest";
import { compareBy, type Sortable } from "@/components/hooks/useColumnSort";

// Pure comparator coverage. Focus: a zero VES renders as "Pending" (same as
// null), so it must sink to the bottom in BOTH directions instead of sorting as
// numeric 0 — which, under asc, would float a Pending row above real scores.

const row = (handle: string, ves: number | null, totalTokens = 0): Sortable => ({
  handle,
  totalTokens,
  estimatedCostUsd: 0,
  ves,
});

function order(rows: Sortable[], key: Parameters<typeof compareBy>[0], dir: Parameters<typeof compareBy>[1]) {
  return [...rows].sort(compareBy(key, dir)).map((r) => r.handle);
}

describe("compareBy — VES Pending (0 and null) handling", () => {
  const rows = [
    row("zero", 0),
    row("null", null),
    row("low", 1.5),
    row("high", 9.0),
  ];

  it("desc: real scores first, both Pending rows last", () => {
    const o = order(rows, "ves", "desc");
    expect(o.slice(0, 2)).toEqual(["high", "low"]);
    expect(o.slice(2).sort()).toEqual(["null", "zero"]);
  });

  it("asc: real scores first (ascending), Pending rows still last — zero never floats to top", () => {
    const o = order(rows, "ves", "asc");
    expect(o.slice(0, 2)).toEqual(["low", "high"]);
    expect(o.slice(2).sort()).toEqual(["null", "zero"]);
    // Regression guard for codex finding #1: a Pending (ves===0) row must not
    // appear before a real score under ascending sort.
    expect(o[0]).not.toBe("zero");
  });
});

describe("compareBy — non-VES columns keep numeric 0 semantics", () => {
  it("totalTokens asc: 0 sorts as the smallest real value (not sunk)", () => {
    const rows = [row("a", 0, 0), row("b", 0, 5), row("c", 0, 2)];
    expect(order(rows, "totalTokens", "asc")).toEqual(["a", "c", "b"]);
  });

  it("handle: alphabetical, direction-aware", () => {
    const rows = [row("c", 1), row("a", 1), row("b", 1)];
    expect(order(rows, "handle", "asc")).toEqual(["a", "b", "c"]);
    expect(order(rows, "handle", "desc")).toEqual(["c", "b", "a"]);
  });
});
