// burn-handle.test.ts — canonicalHandle is the SINGLE source of truth for the
// leaderboard/history/claim key. It must collapse @-prefix + casing variants to
// ONE key (else trends split + claims mismatch) and reject malformed handles at
// the 400 boundary BEFORE anything is hashed or written. displayHandle preserves
// the user's casing for rendering only.

import { describe, it, expect } from "vitest";
import {
  canonicalHandle,
  displayFormFor,
  parseHandle,
} from "@/lib/server/handle";

describe("canonicalHandle — collapse variants to one key", () => {
  it("collapses @-prefix + casing to a single canonical key", () => {
    const variants = ["@Foo", "foo", "@foo", "FOO", "  @Foo  ", "@@foo"];
    const canon = variants.map(canonicalHandle);
    expect(canon.every((c) => c === "foo")).toBe(true);
  });

  it("strips leading @(s), trims, lowercases", () => {
    expect(canonicalHandle("@Octocat")).toBe("octocat");
    expect(canonicalHandle("   @@MixedCase  ")).toBe("mixedcase");
    expect(canonicalHandle("alice-99")).toBe("alice-99");
  });

  it("accepts a 39-char handle (1 + 38) but rejects 40", () => {
    const len39 = "a" + "b".repeat(38);
    const len40 = "a" + "b".repeat(39);
    expect(len39.length).toBe(39);
    expect(canonicalHandle(len39)).toBe(len39);
    expect(canonicalHandle(len40)).toBeNull();
  });
});

describe("canonicalHandle — reject malformed (400 boundary)", () => {
  it("rejects empty / @-only / whitespace-only", () => {
    expect(canonicalHandle("")).toBeNull();
    expect(canonicalHandle("@")).toBeNull();
    expect(canonicalHandle("   ")).toBeNull();
    expect(canonicalHandle("@@@")).toBeNull();
  });

  it("rejects a leading hyphen (after @-strip)", () => {
    expect(canonicalHandle("-foo")).toBeNull();
    expect(canonicalHandle("@-foo")).toBeNull();
  });

  it("rejects illegal characters (underscore, dot, space, slash)", () => {
    expect(canonicalHandle("foo_bar")).toBeNull();
    expect(canonicalHandle("foo.bar")).toBeNull();
    expect(canonicalHandle("foo bar")).toBeNull();
    expect(canonicalHandle("foo/bar")).toBeNull();
    expect(canonicalHandle("@ foo")).toBeNull();
  });

  it("rejects non-string input defensively", () => {
    // Signature is `unknown` (untrusted body values reach here), so these are
    // type-valid calls — we assert the runtime guard returns null, not a throw.
    expect(canonicalHandle(null)).toBeNull();
    expect(canonicalHandle(undefined)).toBeNull();
    expect(canonicalHandle(123)).toBeNull();
  });
});

describe("displayFormFor — preserve casing, strip @ + trim", () => {
  it("preserves casing while stripping @ and trimming", () => {
    expect(displayFormFor("@Foo")).toBe("Foo");
    expect(displayFormFor("  @MixedCase  ")).toBe("MixedCase");
    expect(displayFormFor("@@Octocat")).toBe("Octocat");
  });
});

describe("parseHandle — combined canonical + display", () => {
  it("returns both forms for a valid handle", () => {
    expect(parseHandle("@Foo")).toEqual({ handle: "foo", display: "Foo" });
  });

  it("returns null for an invalid handle (no display leakage)", () => {
    expect(parseHandle("@-bad")).toBeNull();
    expect(parseHandle("")).toBeNull();
  });

  it("display equals canonical when already lowercase", () => {
    expect(parseHandle("alice-99")).toEqual({
      handle: "alice-99",
      display: "alice-99",
    });
  });
});
