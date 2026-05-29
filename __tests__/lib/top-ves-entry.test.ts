// top-ves-entry.test.ts — StatusBar headline picker contract.
//
// topVesEntry() feeds the always-on StatusBar with the single highest-VES
// builder. The critical invariant: `imported` is ordered newest-first, so the
// picker must scan for the MAX, never read entries[0]. Null-VES entries (no
// verified fixes) are skipped; an empty/all-null set yields null so the bar
// renders its "be first" empty state.
//
// SECURITY: pure projection — no I/O, no env access.

import { describe, it, expect } from "vitest";
import { topVesEntry, type ImportedEntry } from "@/lib/data";

function entry(handle: string, ves?: number): ImportedEntry {
  return {
    handle,
    avatar: "XX",
    verif: "Device-synced",
    totalTokens: 0,
    estimatedCostUsd: 0,
    period: "week",
    since: null,
    until: null,
    importedAt: "2026-05-29T00:00:00Z",
    toolsUsed: [],
    breakdown: [],
    ...(ves != null ? { ves } : {}),
  };
}

describe("topVesEntry — highest-VES picker for StatusBar", () => {
  it("returns the MAX-VES entry, not the first (newest-first ordering)", () => {
    // Newest-first: the leader (@b, 250) sits in the middle, not at index 0.
    const entries = [entry("@a", 100), entry("@b", 250), entry("@c", 50)];
    expect(topVesEntry(entries)).toEqual({ ves: 250, handle: "@b" });
  });

  it("ignores entries whose VES is absent (no verified fixes)", () => {
    const entries = [entry("@a"), entry("@b", 30), entry("@c")];
    expect(topVesEntry(entries)).toEqual({ ves: 30, handle: "@b" });
  });

  it("returns null for an empty list", () => {
    expect(topVesEntry([])).toBeNull();
  });

  it("returns null when no entry has a VES", () => {
    expect(topVesEntry([entry("@a"), entry("@b")])).toBeNull();
  });

  it("keeps the first seen on a tie (strict greater-than)", () => {
    const entries = [entry("@a", 200), entry("@b", 200)];
    expect(topVesEntry(entries)).toEqual({ ves: 200, handle: "@a" });
  });

  it("treats a genuine VES of 0 as a valid candidate", () => {
    // computeVes(0, cost>0) → 0 is a real score, distinct from absent.
    const entries = [entry("@a", 0)];
    expect(topVesEntry(entries)).toEqual({ ves: 0, handle: "@a" });
  });
});
