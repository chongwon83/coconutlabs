import { describe, it, expect } from "vitest";
import { representativeWeek, utcIsoToKstDay } from "@/lib/data";
import type { ImportedEntry } from "@/lib/data";

function entry(overrides: Partial<ImportedEntry>): ImportedEntry {
  return {
    handle: "test",
    avatar: "TE",
    verif: "Device-synced",
    totalTokens: 1000,
    estimatedCostUsd: 1,
    period: "week",
    since: "2026-05-18T00:00:00Z",
    until: "2026-05-25T00:00:00Z",
    importedAt: "2026-05-25T00:00:00Z",
    toolsUsed: ["claude-code"],
    breakdown: [],
    ...overrides,
  };
}

describe("representativeWeek", () => {
  it("returns null for empty entries", () => {
    expect(representativeWeek([])).toBeNull();
  });

  it("returns null when no weekly entries exist", () => {
    const entries = [entry({ period: "month" }), entry({ period: "all", since: null, until: null })];
    expect(representativeWeek(entries)).toBeNull();
  });

  it("returns the single weekly entry as-is", () => {
    const e = entry({ since: "2026-05-18T00:00:00Z", until: "2026-05-25T00:00:00Z" });
    expect(representativeWeek([e])).toEqual({
      since: "2026-05-18T00:00:00Z",
      until: "2026-05-25T00:00:00Z",
    });
  });

  it("picks the entry with the latest since when multiple weekly entries exist", () => {
    const older = entry({ since: "2026-05-11T00:00:00Z", until: "2026-05-18T00:00:00Z" });
    const newer = entry({ handle: "other", since: "2026-05-18T00:00:00Z", until: "2026-05-25T00:00:00Z" });
    expect(representativeWeek([older, newer])).toEqual({
      since: "2026-05-18T00:00:00Z",
      until: "2026-05-25T00:00:00Z",
    });
  });

  it("ignores non-weekly entries when selecting the representative", () => {
    const weekly = entry({ since: "2026-05-18T00:00:00Z", until: "2026-05-25T00:00:00Z" });
    const monthly = entry({ period: "month", since: "2026-05-01T00:00:00Z", until: "2026-06-01T00:00:00Z" });
    expect(representativeWeek([weekly, monthly])).toEqual({
      since: "2026-05-18T00:00:00Z",
      until: "2026-05-25T00:00:00Z",
    });
  });
});

describe("utcIsoToKstDay", () => {
  it("converts UTC midnight to same KST day", () => {
    expect(utcIsoToKstDay("2026-05-18T00:00:00Z")).toBe("2026-05-18");
  });

  it("shifts midnight UTC to next KST day for late-UTC timestamps", () => {
    // UTC 23:00 = KST 08:00 next day
    expect(utcIsoToKstDay("2026-05-18T23:00:00Z")).toBe("2026-05-19");
  });
});
