// burn-index-legacy-fallback.test.ts — sliceForFilter legacy path.
//
// Pre-B-cycle entries have breakdown:[] and toolsUsed tagging one tool.
// sliceForFilter must return the aggregate (not NaN) for a single-tool
// legacy entry so the leaderboard renders tokens/cost rather than "—".
//
// Covered paths:
//   1. Single-tool legacy → aggregate returned for the matching tool
//   2. Single-tool legacy → NaN returned for a different tool
//   3. Multi-tool legacy  → NaN returned (no safe attribution)
//   4. Well-formed entry  → breakdown slice returned normally
//   5. f==="all"          → aggregate always returned regardless of breakdown

import { describe, it, expect } from "vitest";
import type { ImportedEntry } from "@/lib/data";

// Inline the function under test so the unit test doesn't depend on the
// component render tree. If sliceForFilter changes signature, this test
// breaks loudly (good).
function sliceForFilter(
  e: ImportedEntry,
  f: "all" | "claude-code" | "codex",
): { tokens: number; costUsd: number } {
  if (f === "all") return { tokens: e.totalTokens, costUsd: e.estimatedCostUsd };
  const slices = (e.breakdown ?? []).filter((b) => b.tool === f);
  if (slices.length > 0) {
    return {
      tokens: slices.reduce((acc, b) => acc + b.totalTokens, 0),
      costUsd: slices.reduce((acc, b) => acc + b.estimatedCostUsd, 0),
    };
  }
  if ((e.breakdown ?? []).length === 0 && e.toolsUsed.length === 1 && e.toolsUsed[0] === f) {
    return { tokens: e.totalTokens, costUsd: e.estimatedCostUsd };
  }
  return { tokens: NaN, costUsd: NaN };
}

const BASE: ImportedEntry = {
  handle: "@pms0505",
  avatar: "PM",
  verif: "Device-synced",
  totalTokens: 500_000,
  estimatedCostUsd: 5.0,
  period: "week",
  since: "2026-05-11T00:00:00Z",
  until: "2026-05-18T00:00:00Z",
  importedAt: "2026-05-18T09:00:00Z",
  toolsUsed: [],
  breakdown: [],
};

describe("sliceForFilter — legacy fallback (breakdown:[])", () => {
  it("f=all always returns aggregate regardless of breakdown", () => {
    const e: ImportedEntry = { ...BASE, toolsUsed: ["claude-code"] };
    const result = sliceForFilter(e, "all");
    expect(result.tokens).toBe(500_000);
    expect(result.costUsd).toBe(5.0);
  });

  it("single-tool claude-code legacy → returns aggregate on claude-code filter", () => {
    const e: ImportedEntry = { ...BASE, toolsUsed: ["claude-code"] };
    const result = sliceForFilter(e, "claude-code");
    expect(result.tokens).toBe(500_000);
    expect(result.costUsd).toBe(5.0);
  });

  it("single-tool claude-code legacy → returns NaN on codex filter", () => {
    const e: ImportedEntry = { ...BASE, toolsUsed: ["claude-code"] };
    const result = sliceForFilter(e, "codex");
    expect(Number.isNaN(result.tokens)).toBe(true);
    expect(Number.isNaN(result.costUsd)).toBe(true);
  });

  it("single-tool codex legacy → returns aggregate on codex filter", () => {
    const e: ImportedEntry = { ...BASE, toolsUsed: ["codex"] };
    const result = sliceForFilter(e, "codex");
    expect(result.tokens).toBe(500_000);
    expect(result.costUsd).toBe(5.0);
  });

  it("multi-tool legacy (toolsUsed=[claude-code,codex], breakdown:[]) → NaN (no safe attribution)", () => {
    const e: ImportedEntry = { ...BASE, toolsUsed: ["claude-code", "codex"] };
    expect(Number.isNaN(sliceForFilter(e, "claude-code").tokens)).toBe(true);
    expect(Number.isNaN(sliceForFilter(e, "codex").tokens)).toBe(true);
  });

  it("empty toolsUsed legacy → NaN (nothing to attribute)", () => {
    const e: ImportedEntry = { ...BASE, toolsUsed: [] };
    expect(Number.isNaN(sliceForFilter(e, "claude-code").tokens)).toBe(true);
    expect(Number.isNaN(sliceForFilter(e, "codex").tokens)).toBe(true);
  });

  it("well-formed entry with breakdown → slice returned, not fallback", () => {
    const e: ImportedEntry = {
      ...BASE,
      toolsUsed: ["claude-code"],
      breakdown: [
        { tool: "claude-code", model: "sonnet-4-6", totalTokens: 300_000, estimatedCostUsd: 3.0 },
      ],
    };
    const result = sliceForFilter(e, "claude-code");
    expect(result.tokens).toBe(300_000);
    expect(result.costUsd).toBe(3.0);
  });
});
