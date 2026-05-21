// burn-collect.test.ts — buildEnvelope happy/edge paths via `__internal`.
//
// buildEnvelope itself walks FileSystemDirectoryHandle (FSA), which has no
// node shim. Rather than build a fake FSA, we cover its INVARIANT-CARRYING
// helpers (__internal export) plus the public throw-paths reachable without
// any handles:
//   - unknown period
//   - invalid generatedAt
//   - no sessions in window (both handles null → throws)
//
// The FSA-driven aggregation path is left for an e2e/playwright suite — the
// math primitives below are what determine whether two builders with the
// same logs land on the same row.

import { describe, it, expect } from "vitest";
import { buildEnvelope, __internal } from "@/lib/client/burn/collect";

const {
  bankersRound,
  utcDay,
  parseInstant,
  isoWeekday,
  formatGenerated,
  calendarWindow,
  inWindow,
  schemaTokenCount,
  buildVerification,
  compareKey,
} = __internal;

// ── bankersRound — CPython parity (see collect.ts comment) ──────────────────
describe("bankersRound — V8 toFixed parity with CPython round()", () => {
  it("rounds 0.00025 UP to 0.0003 (IEEE-754 bit-pattern parity)", () => {
    // CPython rounds based on stored bit pattern (0.00025 stored slightly
    // larger than exact decimal). V8 toFixed matches.
    expect(bankersRound(0.00025, 4)).toBe(0.0003);
  });

  it("rounds 0.12345 to 0.1235 (collect.ts comment example)", () => {
    expect(bankersRound(0.12345, 4)).toBe(0.1235);
  });

  it("strips trailing zeros (Number()) — 2.6750 → 2.675", () => {
    expect(bankersRound(2.675, 4)).toBe(2.675);
  });

  it("preserves Infinity / NaN as-is (Number.isFinite guard)", () => {
    expect(bankersRound(Number.POSITIVE_INFINITY, 4)).toBe(Number.POSITIVE_INFINITY);
    expect(Number.isNaN(bankersRound(Number.NaN, 4))).toBe(true);
  });

  it("collapses signed zero to +0 (toFixed→Number normalisation)", () => {
    // (-0).toFixed(4) → "0.0000" → Number("0.0000") = +0. Desirable for cost
    // output ("$-0.00" is nonsensical). Pin this so a future bankersRound
    // rewrite that preserves -0 surfaces as a test break.
    expect(bankersRound(0, 4)).toBe(0);
    expect(Object.is(bankersRound(-0, 4), 0)).toBe(true);
    expect(Object.is(bankersRound(-0, 4), -0)).toBe(false);
  });
});

// ── utcDay — regex slice, NOT timezone-normalised ───────────────────────────
describe("utcDay — raw YYYY-MM-DD prefix", () => {
  it("returns the date prefix without TZ normalisation", () => {
    // The instant is Z-equivalent 2026-05-21, but parity says use raw prefix.
    expect(utcDay("2026-05-20T23:30:00-05:00")).toBe("2026-05-20");
  });

  it("returns the same prefix for Z-suffixed", () => {
    expect(utcDay("2026-05-20T00:00:00Z")).toBe("2026-05-20");
  });

  it("returns null for null input", () => {
    expect(utcDay(null)).toBeNull();
  });

  it("returns null for unparseable input", () => {
    expect(utcDay("yesterday")).toBeNull();
  });
});

// ── parseInstant — naive timestamps assumed UTC ─────────────────────────────
describe("parseInstant — naive strings treated as UTC", () => {
  it("appends Z to a naive ISO string before parsing", () => {
    const a = parseInstant("2026-05-20T12:00:00");
    const b = parseInstant("2026-05-20T12:00:00Z");
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a!.getTime()).toBe(b!.getTime());
  });

  it("preserves explicit offset", () => {
    const dt = parseInstant("2026-05-20T12:00:00+09:00");
    expect(dt).not.toBeNull();
    expect(dt!.toISOString()).toBe("2026-05-20T03:00:00.000Z");
  });

  it("returns null for unparseable strings", () => {
    expect(parseInstant("not-a-date")).toBeNull();
  });

  it("returns null for null input", () => {
    expect(parseInstant(null)).toBeNull();
  });
});

// ── isoWeekday — Mon=0..Sun=6 ───────────────────────────────────────────────
describe("isoWeekday — Mon-aligned (shifts JS Sun=0)", () => {
  it("Monday 2026-05-18 → 0", () => {
    expect(isoWeekday(new Date(Date.UTC(2026, 4, 18)))).toBe(0);
  });

  it("Sunday 2026-05-24 → 6", () => {
    expect(isoWeekday(new Date(Date.UTC(2026, 4, 24)))).toBe(6);
  });

  it("Saturday 2026-05-23 → 5", () => {
    expect(isoWeekday(new Date(Date.UTC(2026, 4, 23)))).toBe(5);
  });
});

// ── formatGenerated — second precision, no millis ───────────────────────────
describe("formatGenerated — schema-valid 'YYYY-MM-DDTHH:MM:SSZ'", () => {
  it("emits second precision with trailing Z", () => {
    const dt = new Date(Date.UTC(2026, 4, 20, 12, 34, 56, 789));
    expect(formatGenerated(dt)).toBe("2026-05-20T12:34:56Z");
  });

  it("zero-pads month/day/hour/min/sec", () => {
    const dt = new Date(Date.UTC(2026, 0, 1, 1, 2, 3));
    expect(formatGenerated(dt)).toBe("2026-01-01T01:02:03Z");
  });
});

// ── calendarWindow — period boundaries ──────────────────────────────────────
describe("calendarWindow — period-specific [since, until) pairs", () => {
  // Anchor: a Thursday 2026-05-21 to exercise the week-back math.
  const NOW = new Date(Date.UTC(2026, 4, 21, 10, 0, 0));

  it("'all' returns null (no filter)", () => {
    expect(calendarWindow("all", NOW)).toBeNull();
  });

  it("'day' is [today00:00Z, tomorrow00:00Z)", () => {
    const w = calendarWindow("day", NOW)!;
    expect(formatGenerated(w[0])).toBe("2026-05-21T00:00:00Z");
    expect(formatGenerated(w[1])).toBe("2026-05-22T00:00:00Z");
  });

  it("'week' is the LAST COMPLETED ISO week (prior Mon, this Mon)", () => {
    const w = calendarWindow("week", NOW)!;
    // Thursday 2026-05-21 → this Monday = 2026-05-18, prior Monday = 2026-05-11
    expect(formatGenerated(w[0])).toBe("2026-05-11T00:00:00Z");
    expect(formatGenerated(w[1])).toBe("2026-05-18T00:00:00Z");
  });

  it("'month' is [first of month, first of next month)", () => {
    const w = calendarWindow("month", NOW)!;
    expect(formatGenerated(w[0])).toBe("2026-05-01T00:00:00Z");
    expect(formatGenerated(w[1])).toBe("2026-06-01T00:00:00Z");
  });

  it("'month' rolls over December → January next year", () => {
    const dec = new Date(Date.UTC(2026, 11, 15));
    const w = calendarWindow("month", dec)!;
    expect(formatGenerated(w[0])).toBe("2026-12-01T00:00:00Z");
    expect(formatGenerated(w[1])).toBe("2027-01-01T00:00:00Z");
  });

  it("'year' is [Jan 1, next Jan 1)", () => {
    const w = calendarWindow("year", NOW)!;
    expect(formatGenerated(w[0])).toBe("2026-01-01T00:00:00Z");
    expect(formatGenerated(w[1])).toBe("2027-01-01T00:00:00Z");
  });
});

// ── inWindow — half-open interval ───────────────────────────────────────────
describe("inWindow — half-open [since, until)", () => {
  const window: [Date, Date] = [
    new Date(Date.UTC(2026, 4, 18)),
    new Date(Date.UTC(2026, 4, 25)),
  ];
  const baseTokens = { input: 1, output: 1, cached_input: 0 } as const;

  it("returns true when window is null", () => {
    const sp = { tool: "codex" as const, model: "gpt-5.2", tokens: baseTokens, timestamp: "2099-01-01T00:00:00Z", projectHash: "abc" };
    expect(inWindow(sp, null)).toBe(true);
  });

  it("returns true for timestamp at exact since", () => {
    const sp = { tool: "codex" as const, model: "gpt-5.2", tokens: baseTokens, timestamp: "2026-05-18T00:00:00Z", projectHash: "abc" };
    expect(inWindow(sp, window)).toBe(true);
  });

  it("returns false for timestamp at exact until (half-open)", () => {
    const sp = { tool: "codex" as const, model: "gpt-5.2", tokens: baseTokens, timestamp: "2026-05-25T00:00:00Z", projectHash: "abc" };
    expect(inWindow(sp, window)).toBe(false);
  });

  it("returns false when timestamp is missing", () => {
    const sp = { tool: "codex" as const, model: "gpt-5.2", tokens: baseTokens, timestamp: null, projectHash: "abc" };
    expect(inWindow(sp, window)).toBe(false);
  });
});

// ── schemaTokenCount — tool-specific field routing ──────────────────────────
describe("schemaTokenCount — claude vs codex field routing", () => {
  it("claude: cache_write_5m + cache_write_1h fold into cacheWrite, cachedInput=0", () => {
    const r = schemaTokenCount("claude", {
      input: 100, output: 50, cache_read: 10,
      cache_write_5m: 5, cache_write_1h: 7,
    });
    expect(r).toEqual({ input: 100, output: 50, cacheRead: 10, cacheWrite: 12, cachedInput: 0 });
  });

  it("codex: cached_input → cachedInput, cacheRead/cacheWrite = 0", () => {
    const r = schemaTokenCount("codex", { input: 80, output: 40, cached_input: 25 });
    expect(r).toEqual({ input: 80, output: 40, cacheRead: 0, cacheWrite: 0, cachedInput: 25 });
  });
});

// ── buildVerification — confidence drives level ─────────────────────────────
describe("buildVerification — confidence → level mapping", () => {
  it("high confidence → Device-synced", () => {
    expect(buildVerification("high")).toEqual({
      tokenSource: "device", costBasis: "estimated",
      priceConfidence: "high", level: "Device-synced",
    });
  });

  it("low confidence → Estimated (price match fell back to _default)", () => {
    expect(buildVerification("low")).toEqual({
      tokenSource: "device", costBasis: "estimated",
      priceConfidence: "low", level: "Estimated",
    });
  });
});

// ── compareKey — (tool, model, projectHash) lexicographic ───────────────────
describe("compareKey — element-by-element tuple compare", () => {
  it("sorts by tool first", () => {
    expect(compareKey(["claude", "z", "z"], ["codex", "a", "a"])).toBeLessThan(0);
  });

  it("then by model", () => {
    expect(compareKey(["claude", "a", "z"], ["claude", "b", "a"])).toBeLessThan(0);
  });

  it("then by projectHash", () => {
    expect(compareKey(["claude", "a", "a"], ["claude", "a", "b"])).toBeLessThan(0);
  });

  it("returns 0 on full match", () => {
    expect(compareKey(["c", "m", "h"], ["c", "m", "h"])).toBe(0);
  });
});

// ── buildEnvelope public throw-paths ────────────────────────────────────────
describe("buildEnvelope — public throw paths (no FSA required)", () => {
  const VALID_SALT = "deadbeef" + "0".repeat(56);

  it("throws on unknown period", async () => {
    await expect(
      buildEnvelope({
        claudeProjectsHandle: null,
        codexSessionsHandle: null,
        salt: VALID_SALT,
        // @ts-expect-error — exercising runtime guard
        period: "decade",
      }),
    ).rejects.toThrow(/unknown period/);
  });

  it("throws on invalid generatedAt", async () => {
    await expect(
      buildEnvelope(
        {
          claudeProjectsHandle: null,
          codexSessionsHandle: null,
          salt: VALID_SALT,
          period: "week",
        },
        { generatedAt: "not-a-date" },
      ),
    ).rejects.toThrow(/invalid generatedAt/);
  });

  it("throws when both handles are null (no sessions in window)", async () => {
    await expect(
      buildEnvelope({
        claudeProjectsHandle: null,
        codexSessionsHandle: null,
        salt: VALID_SALT,
        period: "week",
      }),
    ).rejects.toThrow(/no sessions in period 'week'/);
  });
});
