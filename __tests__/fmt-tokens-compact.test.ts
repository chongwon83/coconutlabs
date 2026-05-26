// Unit cover for fmtTokensCompact B-unit branch (PR ~2026-05-27).
// Production has handles in the billions (chongwon83 = 2.637B tokens). Prior
// implementation rendered that as "2637.0M" — visually wrong for the dense
// leaderboard grid. The B branch is the fix; the K/M/raw paths are pinned so
// the new threshold doesn't accidentally swallow them.
import { describe, it, expect } from "vitest";
import { fmtTokensCompact } from "@/lib/data";

describe("fmtTokensCompact", () => {
  it("renders billions with one decimal + B suffix", () => {
    expect(fmtTokensCompact(2_637_000_000)).toBe("2.6B");
    expect(fmtTokensCompact(1_000_000_000)).toBe("1.0B");
    expect(fmtTokensCompact(100_000_000_000)).toBe("100.0B");
  });

  it("keeps the millions branch under the B threshold", () => {
    expect(fmtTokensCompact(999_999_999)).toBe("1000.0M");
    expect(fmtTokensCompact(1_200_000)).toBe("1.2M");
  });

  it("rounds the thousands branch to an integer", () => {
    expect(fmtTokensCompact(340_000)).toBe("340K");
    expect(fmtTokensCompact(1_499)).toBe("1K");
  });

  it("returns the raw integer below 1K", () => {
    expect(fmtTokensCompact(980)).toBe("980");
    expect(fmtTokensCompact(0)).toBe("0");
  });
});
