// burn-merge-numerator.test.ts — the VES numerator precedence merge.
//
// mergeNumerator() is the single source of truth for "which commit count wins"
// when a handle is re-imported. It must guarantee a later browser-fsa or
// numerator-absent upload never clobbers or lowers a CLI-measured count, while
// still letting a fresh CLI count update an old one. The LEGACY ROW TRAP — a
// stored count with NO source must rank as CLI — gets its own cases because
// rows persisted before fixesSource existed look exactly like that.

import { describe, it, expect } from "vitest";
import { mergeNumerator, rankSource } from "@/lib/server/burnStore/mergeNumerator";
import type { NumeratorFields } from "@/lib/server/burnStore/mergeNumerator";

const W1 = "2026-05-11T00:00:00Z";
const W2 = "2026-05-18T00:00:00Z";

const cli = (fixes: number, since: string | null = W1): NumeratorFields => ({
  fixes,
  fixesSource: "cli",
  since,
});
const browser = (fixes: number, since: string | null = W1): NumeratorFields => ({
  fixes,
  fixesSource: "browser-fsa",
  since,
});
const absent = (since: string | null = W1): NumeratorFields => ({ since });
const legacyCli = (fixes: number, since: string | null = W1): NumeratorFields => ({
  fixes,
  since, // fixesSource intentionally omitted — a pre-provenance CLI row
});

describe("rankSource", () => {
  it("ranks absent (no fixes) as 0", () => {
    expect(rankSource(absent())).toBe(0);
    expect(rankSource(undefined)).toBe(0);
    expect(rankSource(null)).toBe(0);
  });
  it("ranks browser-fsa as 1", () => {
    expect(rankSource(browser(40))).toBe(1);
  });
  it("ranks cli as 2", () => {
    expect(rankSource(cli(153))).toBe(2);
  });
  it("ranks a fixes-present + source-absent legacy row as CLI(2)", () => {
    expect(rankSource(legacyCli(153))).toBe(2);
  });
});

describe("mergeNumerator — precedence", () => {
  it("browser cannot clobber/lower a cli count (same week)", () => {
    expect(mergeNumerator(cli(153), browser(40))).toEqual({
      fixes: 153,
      fixesSource: "cli",
    });
  });

  it("absent cannot erase a present cli count (same week)", () => {
    expect(mergeNumerator(cli(153), absent())).toEqual({
      fixes: 153,
      fixesSource: "cli",
    });
  });

  it("cli outranks browser even when the cli count is lower", () => {
    expect(mergeNumerator(browser(40), cli(10))).toEqual({
      fixes: 10,
      fixesSource: "cli",
    });
  });

  it("a fresh cli count replaces an older cli count (newest wins)", () => {
    expect(mergeNumerator(cli(100), cli(200))).toEqual({
      fixes: 200,
      fixesSource: "cli",
    });
  });

  it("equal-rank browser keeps the larger count (max)", () => {
    expect(mergeNumerator(browser(60), browser(40))).toEqual({
      fixes: 60,
      fixesSource: "browser-fsa",
    });
    expect(mergeNumerator(browser(40), browser(60))).toEqual({
      fixes: 60,
      fixesSource: "browser-fsa",
    });
  });

  it("a higher browser count replaces absent", () => {
    expect(mergeNumerator(absent(), browser(40))).toEqual({
      fixes: 40,
      fixesSource: "browser-fsa",
    });
  });

  it("both absent yields an empty patch (stays absent)", () => {
    expect(mergeNumerator(absent(), absent())).toEqual({});
  });

  it("no existing card uses the incoming numerator as-is", () => {
    expect(mergeNumerator(undefined, browser(40))).toEqual({
      fixes: 40,
      fixesSource: "browser-fsa",
    });
    expect(mergeNumerator(undefined, absent())).toEqual({});
  });
});

describe("mergeNumerator — legacy row trap", () => {
  it("a legacy cli row (source absent) is NOT clobbered by a browser upload", () => {
    expect(mergeNumerator(legacyCli(153), browser(40))).toEqual({
      fixes: 153,
      fixesSource: "cli", // normalized
    });
  });

  it("a legacy cli row is NOT erased by a numerator-absent upload", () => {
    expect(mergeNumerator(legacyCli(153), absent())).toEqual({
      fixes: 153,
      fixesSource: "cli",
    });
  });

  it("an incoming legacy cli (source absent) still ranks as cli and wins over browser", () => {
    expect(mergeNumerator(browser(40), legacyCli(10))).toEqual({
      fixes: 10,
      fixesSource: "cli",
    });
  });
});

describe("mergeNumerator — different week (no carry)", () => {
  it("a different-since incoming does not inherit the prior week's count", () => {
    // Prior week had a cli 153; this week's upload is numerator-absent.
    expect(mergeNumerator(cli(153, W1), absent(W2))).toEqual({});
  });

  it("a different-since browser count stands on its own", () => {
    expect(mergeNumerator(cli(153, W1), browser(40, W2))).toEqual({
      fixes: 40,
      fixesSource: "browser-fsa",
    });
  });
});
