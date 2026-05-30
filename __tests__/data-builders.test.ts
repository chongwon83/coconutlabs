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
import { buildImportedEntry, computeVes, fmtVes } from "@/lib/data";
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
    schemaVersion: "3",
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
      schemaVersion: "3",
      generatedAt: "2026-05-25T00:00:00Z",
      periodWindow: { period: "all", since: null, until: null },
      rows: [],
      grandTotal: { totalTokens: 0, estimatedCostUsd: 0 },
    };
    const entry = buildImportedEntry(env, "@eve");
    expect(entry.toolsUsed).toEqual([]);
  });
});

describe("buildImportedEntry — verifiedCommits → fixes mapping (store-at-import)", () => {
  it("stores fixes from env.verifiedCommits when present", () => {
    const env = { ...envelope([row("claude-code")]), verifiedCommits: 12 };
    const entry = buildImportedEntry(env, "@heidi");
    expect(entry.fixes).toBe(12);
    // ves is NOT persisted — derived at read time in the GET route.
    expect(entry.ves).toBeUndefined();
  });

  it('defaults fixesSource to "cli" when a numerator arrives without a source (CLI back-compat)', () => {
    // The Python CLI was deliberately not changed (D3): it sends verifiedCommits
    // but no verifiedCommitsSource. The server defaults the provenance to "cli"
    // so the precedence merge ranks these as CLI-measured counts.
    const env = { ...envelope([row("claude-code")]), verifiedCommits: 12 };
    const entry = buildImportedEntry(env, "@heidi");
    expect(entry.fixesSource).toBe("cli");
  });

  it('carries verifiedCommitsSource "browser-fsa" through to fixesSource', () => {
    const env = {
      ...envelope([row("claude-code")]),
      verifiedCommits: 40,
      verifiedCommitsSource: "browser-fsa" as const,
    };
    const entry = buildImportedEntry(env, "@heidi");
    expect(entry.fixes).toBe(40);
    expect(entry.fixesSource).toBe("browser-fsa");
  });

  it("leaves fixesSource undefined when there is no numerator", () => {
    const entry = buildImportedEntry(envelope([row("claude-code")]), "@judy");
    expect(entry.fixesSource).toBeUndefined();
  });

  it("stores a genuine 0 (inspected, no commits) as fixes: 0", () => {
    const env = { ...envelope([row("claude-code")]), verifiedCommits: 0 };
    const entry = buildImportedEntry(env, "@ivan");
    expect(entry.fixes).toBe(0);
  });

  it("leaves fixes undefined when verifiedCommits is absent (browser upload → '—')", () => {
    const entry = buildImportedEntry(envelope([row("claude-code")]), "@judy");
    expect(entry.fixes).toBeUndefined();
    expect(entry.ves).toBeUndefined();
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

describe("computeVes — verified commits per dollar", () => {
  it("returns commits / cost for a positive cost", () => {
    expect(computeVes(10, 2)).toBe(5);
    expect(computeVes(3, 0.5)).toBe(6);
  });

  it("returns 0 for a 0 numerator with positive cost", () => {
    expect(computeVes(0, 4)).toBe(0);
  });

  it("returns null when cost is non-positive (avoids Infinity/NaN → '—')", () => {
    expect(computeVes(5, 0)).toBeNull();
    expect(computeVes(5, -1)).toBeNull();
  });
});

describe("fmtVes — display as commits per $1k of AI spend", () => {
  it("rescales the raw ratio by 1000 (raw 0.0396 → '39.6')", () => {
    // Real operator data: 153 commits / $3860 = 0.0396 raw → 39.6 per $1k.
    expect(fmtVes(0.0396)).toBe("39.6");
    expect(fmtVes(0.0124)).toBe("12.4");
  });

  it("keeps 2 decimals for tiny scores so they don't collapse to 0", () => {
    // Without per-$1k + 2-decimal handling this is the old '0.0' bug.
    expect(fmtVes(0.00375)).toBe("3.75"); // 3 commits / $800
    expect(fmtVes(0.009)).toBe("9.00");
  });

  it("uses 1 decimal in the mid range and rounds with separators when large", () => {
    expect(fmtVes(0.0865)).toBe("86.5"); // demo @shellcoder 64 / $740
    expect(fmtVes(2)).toBe("2,000"); // 100 commits / $50 → 2000 per $1k
    expect(fmtVes(1.2345)).toBe("1,235");
  });

  it("renders an exact zero as '0', never '0.00'", () => {
    expect(fmtVes(0)).toBe("0");
  });

  it("floors a positive-but-sub-0.005 score to '<0.01' instead of a false '0.00'", () => {
    // raw 0.000004 → 0.004 per $1k: positive real data that would otherwise
    // round to "0.00" — the exact misleading zero this metric exists to kill.
    expect(fmtVes(0.000004)).toBe("<0.01");
    expect(fmtVes(0.0000049)).toBe("<0.01");
    // Just above the floor renders a real 2-decimal value, not the floor.
    expect(fmtVes(0.00001)).toBe("0.01");
  });

  it("maps non-finite or negative input to '—'/'0', never 'NaN' on a headline cell", () => {
    expect(fmtVes(Number.NaN)).toBe("—");
    expect(fmtVes(Number.POSITIVE_INFINITY)).toBe("—");
    expect(fmtVes(-0.5)).toBe("0"); // impossible from computeVes, but never render a negative VES
  });
});
