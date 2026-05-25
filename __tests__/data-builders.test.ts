// data-builders.test.ts — Track A.1 toolsUsed extraction contract.
//
// buildImportedEntry() walks an envelope's rows and projects a single
// leaderboard card. The toolsUsed field (added in PR Track A 2026-05-25) is
// the join key for BurnIndexSection's 3-tab filter — an entry that used both
// Claude Code AND Codex must surface under each single-tool filter, so the
// extraction has to dedupe + sort deterministically (Redis blob comparison
// in tests + JSON snapshot stability rely on it).
//
// Four cases per plan A.1:
//   1. claude-only rows  → ["claude-code"]
//   2. codex-only rows   → ["codex"]
//   3. mixed rows        → ["claude-code", "codex"] (alphabetical via .sort())
//   4. empty rows        → []  (defensive — collector should not emit, but
//                                buildImportedEntry must not crash either)
//
// SECURITY: pure projection — no I/O, no env access.

import { describe, it, expect } from "vitest";
import { buildImportedEntry } from "@/lib/data";
import type { BurnSummary, BurnSummaryEnvelope } from "@/lib/data";

const baseTokenCount = {
  input: 100,
  output: 50,
  cacheRead: 0,
  cacheWrite: 0,
  cachedInput: 0,
};

const baseVerification = {
  tokenSource: "device" as const,
  costBasis: "estimated" as const,
  priceConfidence: "high" as const,
  level: "Device-synced" as const,
};

function row(tool: "claude-code" | "codex", overrides: Partial<BurnSummary> = {}): BurnSummary {
  return {
    tool,
    model: tool === "claude-code" ? "claude-opus-4-7" : "gpt-5",
    tokenCount: { ...baseTokenCount },
    estimatedCostUsd: 0.0015,
    timestampBucket: "2026-05-20",
    sessionCount: 1,
    activeDays: 1,
    projectHash: "abc123def456",
    verification: { ...baseVerification },
    ...overrides,
  };
}

function envelope(rows: BurnSummary[]): BurnSummaryEnvelope {
  const totalTokens = rows.reduce((s, r) => {
    const t = r.tokenCount;
    return s + t.input + t.output + t.cacheRead + t.cacheWrite + t.cachedInput;
  }, 0);
  const totalCost = rows.reduce((s, r) => s + r.estimatedCostUsd, 0);
  return {
    schemaVersion: "2",
    generatedAt: "2026-05-25T00:00:00Z",
    periodWindow: {
      period: "week",
      since: "2026-05-18T00:00:00Z",
      until: "2026-05-25T00:00:00Z",
    },
    rows,
    grandTotal: { totalTokens, estimatedCostUsd: totalCost },
  };
}

describe("buildImportedEntry — toolsUsed extraction", () => {
  it("claude-only rows → toolsUsed: ['claude-code']", () => {
    const env = envelope([row("claude-code"), row("claude-code", { model: "claude-sonnet-4-6" })]);
    const entry = buildImportedEntry(env, "@alice");
    expect(entry.toolsUsed).toEqual(["claude-code"]);
  });

  it("codex-only rows → toolsUsed: ['codex']", () => {
    const env = envelope([row("codex"), row("codex", { model: "gpt-5-codex" })]);
    const entry = buildImportedEntry(env, "@bob");
    expect(entry.toolsUsed).toEqual(["codex"]);
  });

  it("mixed rows → toolsUsed: ['claude-code', 'codex'] (sorted alphabetically)", () => {
    // Insertion order codex→claude-code to verify .sort() — not just insertion order.
    const env = envelope([row("codex"), row("claude-code")]);
    const entry = buildImportedEntry(env, "@carol");
    expect(entry.toolsUsed).toEqual(["claude-code", "codex"]);
  });

  it("duplicate-tool rows are deduplicated via Set", () => {
    const env = envelope([
      row("claude-code"),
      row("claude-code", { model: "claude-sonnet-4-6" }),
      row("codex"),
      row("codex", { model: "gpt-5-codex" }),
      row("claude-code", { model: "claude-haiku-4-5" }),
    ]);
    const entry = buildImportedEntry(env, "@dave");
    expect(entry.toolsUsed).toEqual(["claude-code", "codex"]);
    // Explicit length assertion — Set dedup contract, regression guard if
    // someone replaces Set with Array.prototype.filter and breaks dedup.
    expect(entry.toolsUsed.length).toBe(2);
  });

  it("empty rows → toolsUsed: [] (defensive — does not crash)", () => {
    // Collector should never emit a 0-row envelope, but the filter UI reads
    // toolsUsed unconditionally, so [] is the only safe extraction.
    const env: BurnSummaryEnvelope = {
      schemaVersion: "2",
      generatedAt: "2026-05-25T00:00:00Z",
      periodWindow: { period: "all", since: null, until: null },
      rows: [],
      grandTotal: { totalTokens: 0, estimatedCostUsd: 0 },
    };
    const entry = buildImportedEntry(env, "@eve");
    expect(entry.toolsUsed).toEqual([]);
  });
});

describe("buildImportedEntry — other projected fields stay intact", () => {
  it("preserves handle, period bounds, and grandTotal pass-through", () => {
    const env = envelope([row("claude-code")]);
    const entry = buildImportedEntry(env, "@frank");
    expect(entry.handle).toBe("@frank");
    expect(entry.avatar).toBe("FR");
    expect(entry.period).toBe("week");
    expect(entry.since).toBe("2026-05-18T00:00:00Z");
    expect(entry.until).toBe("2026-05-25T00:00:00Z");
    expect(entry.totalTokens).toBe(150);
    expect(entry.estimatedCostUsd).toBe(0.0015);
  });

  it("derives verif from aggregate weakest row (Self-reported drags whole card)", () => {
    const env = envelope([
      row("claude-code"),
      row("codex", {
        verification: {
          tokenSource: "self",
          costBasis: "estimated",
          priceConfidence: "low",
          level: "Self-reported",
        },
      }),
    ]);
    const entry = buildImportedEntry(env, "@grace");
    expect(entry.verif).toBe("Self-reported");
  });
});
