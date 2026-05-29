// burn-pricing-match.test.ts — matchModel pricing + confidence regression.
//
// Mirrors test_match_model_* in tools/usage-poc/tests/test_collector.py so the
// TS and Python collectors agree on the current-gen pricing / wildcard rules.
//
// Regression: before the fix an unlisted Opus minor (claude-opus-4-8) matched
// the bare "claude-opus-4" legacy key at HIGH confidence -> $15 input, a 3x
// over-charge vs. the real $5 current-Opus rate. The fix lists 4-8 explicitly
// and adds a "claude-opus-4-x" wildcard so a not-yet-listed future minor prices
// at the $5 tier but reports LOW (Estimated) confidence.

import { describe, it, expect } from "vitest";
import { matchModel } from "@/lib/client/burn/parsers";
import { MODEL_PRICING } from "@/lib/client/burn/pricing.generated";

const claude = MODEL_PRICING.claude;

describe("matchModel — Opus pricing + confidence", () => {
  it("prices an explicit current version at $5, high confidence", () => {
    const { rate, confidence } = matchModel(claude, "claude-opus-4-8");
    expect(rate.input).toBe(5);
    expect(confidence).toBe("high");
  });

  it("keeps a dated build of a listed version on the specific key (high)", () => {
    const { rate, confidence } = matchModel(claude, "claude-opus-4-7-20260101");
    expect(rate.input).toBe(5);
    expect(confidence).toBe("high");
  });

  it("prices a not-yet-listed future minor via the wildcard: $5 tier, LOW conf", () => {
    const { rate, confidence } = matchModel(claude, "claude-opus-4-9");
    expect(rate.input).toBe(5); // regression: must NOT be the legacy $15
    expect(confidence).toBe("low"); // regression: must NOT be high
  });

  it("keeps legacy minors at $15, high confidence (explicit keys win the tie)", () => {
    for (const legacy of ["claude-opus-4-1", "claude-opus-4-0"]) {
      const { rate, confidence } = matchModel(claude, legacy);
      expect(rate.input, legacy).toBe(15);
      expect(confidence, legacy).toBe("high");
    }
  });

  it("pins the Opus 4.0 GA snapshot (no '-0' in its id) at $15 high", () => {
    // Without the explicit pin the wildcard would undercharge it at $5 and
    // inflate VES (codex round-1 HIGH).
    const { rate, confidence } = matchModel(claude, "claude-opus-4-20250514");
    expect(rate.input).toBe(15);
    expect(confidence).toBe("high");
  });

  it("resolves bare 'claude-opus-4' (not a real id) to $5 LOW via the wildcard", () => {
    // The 4.0 alias is claude-opus-4-0; bare claude-opus-4 is not an Anthropic
    // id. If seen it is an accepted, flagged guess — never silent high charge.
    const { rate, confidence } = matchModel(claude, "claude-opus-4");
    expect(rate.input).toBe(5);
    expect(confidence).toBe("low");
  });
});

describe("matchModel — Haiku wildcard + default fallback", () => {
  it("prices an explicit Haiku version at $1, high confidence", () => {
    const { rate, confidence } = matchModel(claude, "claude-haiku-4-5");
    expect(rate.input).toBe(1);
    expect(confidence).toBe("high");
  });

  it("prices a future Haiku minor at the $1 family tier (wildcard, low conf)", () => {
    const { rate, confidence } = matchModel(claude, "claude-haiku-4-6");
    expect(rate.input).toBe(1); // not the $3 _default
    expect(confidence).toBe("low");
  });

  it("falls back to _default ($3) at low confidence for an unknown family", () => {
    const { rate, confidence } = matchModel(claude, "gemini-3-pro");
    expect(rate.input).toBe(claude._default.input);
    expect(confidence).toBe("low");
  });
});
