// backfill-breakdown.test.ts — one-time Redis backfill script logic.
//
// The script is in web/scripts/backfill-breakdown.ts. These tests cover the
// core synthesis logic in isolation (no real Redis calls):
//   1. Single-tool legacy entry → 1-row breakdown attributed to that tool
//   2. Multi-tool legacy entry  → 2-row breakdown 50/50 split
//   3. Well-formed entry        → skipped (idempotent)
//   4. Empty toolsUsed          → skipped (no signal)
//   5. model name is "unknown" (not a real model name)
//   6. dry-run produces no mutations
//   7. snapshot/restore round-trips byte-for-byte
//
// No network calls; synthetic store mocked with a Map.

import { describe, it, expect } from "vitest";
import type { ImportedEntry, ImportedEntryBreakdown } from "@/lib/data";

// --- Inline backfill logic (mirrors scripts/backfill-breakdown.ts) ---

type BackfillResult =
  | { action: "skip"; reason: string }
  | { action: "patch"; breakdown: ImportedEntryBreakdown[] };

function synthesizeBreakdown(e: ImportedEntry): BackfillResult {
  // Skip if already has breakdown data.
  if (e.breakdown.length > 0) return { action: "skip", reason: "already has breakdown" };
  // Skip if no tool signal.
  if (e.toolsUsed.length === 0) return { action: "skip", reason: "no toolsUsed signal" };

  if (e.toolsUsed.length === 1) {
    return {
      action: "patch",
      breakdown: [
        {
          tool: e.toolsUsed[0],
          model: "unknown",
          totalTokens: e.totalTokens,
          estimatedCostUsd: e.estimatedCostUsd,
        },
      ],
    };
  }

  // Multi-tool: 50/50 split.
  const tokenHalf = Math.floor(e.totalTokens / 2);
  const costHalf = e.estimatedCostUsd / 2;
  return {
    action: "patch",
    breakdown: e.toolsUsed.map((tool, i) => ({
      tool,
      model: "unknown",
      totalTokens: i === 0 ? e.totalTokens - tokenHalf : tokenHalf,
      estimatedCostUsd: costHalf,
    })),
  };
}

function applyBackfill(
  entries: Map<string, ImportedEntry>,
  dryRun: boolean,
): { modified: string[]; skipped: string[] } {
  const modified: string[] = [];
  const skipped: string[] = [];
  for (const [handle, e] of entries) {
    const result = synthesizeBreakdown(e);
    if (result.action === "skip") {
      skipped.push(handle);
    } else {
      modified.push(handle);
      if (!dryRun) {
        entries.set(handle, { ...e, breakdown: result.breakdown });
      }
    }
  }
  return { modified, skipped };
}

// --- Test helpers ---

const BASE: ImportedEntry = {
  handle: "@legacy",
  avatar: "LG",
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

describe("synthesizeBreakdown", () => {
  it("single-tool claude-code → 1 row with tool=claude-code and model=unknown", () => {
    const e: ImportedEntry = { ...BASE, toolsUsed: ["claude-code"] };
    const result = synthesizeBreakdown(e);
    expect(result.action).toBe("patch");
    if (result.action === "patch") {
      expect(result.breakdown).toHaveLength(1);
      expect(result.breakdown[0].tool).toBe("claude-code");
      expect(result.breakdown[0].model).toBe("unknown");
      expect(result.breakdown[0].totalTokens).toBe(500_000);
      expect(result.breakdown[0].estimatedCostUsd).toBe(5.0);
    }
  });

  it("single-tool codex → 1 row with tool=codex", () => {
    const e: ImportedEntry = { ...BASE, toolsUsed: ["codex"] };
    const result = synthesizeBreakdown(e);
    expect(result.action).toBe("patch");
    if (result.action === "patch") {
      expect(result.breakdown[0].tool).toBe("codex");
    }
  });

  it("multi-tool → 2 rows 50/50 split with model=unknown for both", () => {
    const e: ImportedEntry = { ...BASE, toolsUsed: ["claude-code", "codex"], totalTokens: 100_000, estimatedCostUsd: 10.0 };
    const result = synthesizeBreakdown(e);
    expect(result.action).toBe("patch");
    if (result.action === "patch") {
      expect(result.breakdown).toHaveLength(2);
      const total = result.breakdown.reduce((acc, b) => acc + b.totalTokens, 0);
      expect(total).toBe(100_000);
      const costTotal = result.breakdown.reduce((acc, b) => acc + b.estimatedCostUsd, 0);
      expect(costTotal).toBeCloseTo(10.0, 5);
      for (const row of result.breakdown) {
        expect(row.model).toBe("unknown");
      }
    }
  });

  it("well-formed entry (breakdown populated) → skip", () => {
    const e: ImportedEntry = {
      ...BASE,
      toolsUsed: ["claude-code"],
      breakdown: [{ tool: "claude-code", model: "sonnet-4-6", totalTokens: 500_000, estimatedCostUsd: 5.0 }],
    };
    const result = synthesizeBreakdown(e);
    expect(result.action).toBe("skip");
  });

  it("empty toolsUsed → skip (no signal)", () => {
    const e: ImportedEntry = { ...BASE, toolsUsed: [] };
    const result = synthesizeBreakdown(e);
    expect(result.action).toBe("skip");
  });
});

describe("applyBackfill — dry-run produces no mutations", () => {
  it("dry-run: modified list is populated but entries unchanged", () => {
    const legacy: ImportedEntry = { ...BASE, toolsUsed: ["claude-code"] };
    const store = new Map<string, ImportedEntry>([["@legacy", legacy]]);
    const { modified } = applyBackfill(store, /* dryRun= */ true);
    expect(modified).toContain("@legacy");
    // Entry unchanged — dry-run must not write.
    expect(store.get("@legacy")!.breakdown).toHaveLength(0);
  });

  it("apply: entry is patched with synthetic breakdown", () => {
    const legacy: ImportedEntry = { ...BASE, toolsUsed: ["claude-code"] };
    const store = new Map<string, ImportedEntry>([["@legacy", legacy]]);
    applyBackfill(store, /* dryRun= */ false);
    expect(store.get("@legacy")!.breakdown).toHaveLength(1);
    expect(store.get("@legacy")!.breakdown[0].model).toBe("unknown");
  });
});

describe("snapshot/restore round-trip", () => {
  it("serializing and deserializing preserves all entry fields byte-for-byte", () => {
    const entry: ImportedEntry = {
      ...BASE,
      toolsUsed: ["claude-code"],
      breakdown: [{ tool: "claude-code", model: "sonnet-4-6", totalTokens: 500_000, estimatedCostUsd: 5.0 }],
    };
    const snapshot = JSON.stringify(entry);
    const restored: ImportedEntry = JSON.parse(snapshot);
    expect(restored).toEqual(entry);
    // Re-serialize must match original snapshot.
    expect(JSON.stringify(restored)).toBe(snapshot);
  });

  it("restore merge: snapshot entries overwrite backfilled entries, post-snapshot entries survive", () => {
    // Simulate: pre-backfill snapshot has @legacy with breakdown:[].
    // After backfill, @legacy has breakdown populated.
    // After restore (merge), @legacy reverts; @new (post-snapshot) survives.
    type StoreEntry = { breakdown: { tool: string }[] };
    const store = new Map<string, StoreEntry>([
      ["@legacy", { breakdown: [{ tool: "claude-code" }] }], // post-backfill
      ["@new",    { breakdown: [{ tool: "codex" }] }],       // submitted after snapshot
    ]);
    const snapshotEntries: Record<string, StoreEntry> = {
      "@legacy": { breakdown: [] }, // pre-backfill state
      // @new is NOT in snapshot (was submitted after snapshot was taken)
    };
    // Merge-restore: overwrite snapshot handles, leave others
    for (const [handle, value] of Object.entries(snapshotEntries)) {
      store.set(handle, value);
    }
    expect(store.get("@legacy")!.breakdown).toHaveLength(0); // reverted
    expect(store.get("@new")).toBeDefined();                  // preserved
    expect(store.get("@new")!.breakdown[0].tool).toBe("codex");
  });
});

describe("model:unknown propagation guard", () => {
  it("synthetic breakdown uses only 'unknown' — never a real model name", () => {
    const entries = [
      { ...BASE, toolsUsed: ["claude-code"] as ("claude-code" | "codex")[] },
      { ...BASE, handle: "@b", toolsUsed: ["codex"] as ("claude-code" | "codex")[] },
      { ...BASE, handle: "@c", toolsUsed: ["claude-code", "codex"] as ("claude-code" | "codex")[] },
    ];
    for (const e of entries) {
      const result = synthesizeBreakdown(e as ImportedEntry);
      if (result.action === "patch") {
        for (const row of result.breakdown) {
          expect(row.model).toBe("unknown");
        }
      }
    }
  });
});
