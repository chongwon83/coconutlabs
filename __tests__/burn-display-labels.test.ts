// burn-display-labels.test.ts — wire-format VerifLevel literals double as
// labels in other domains (Apple Health / Strava call rows "Provider-synced",
// "Self-reported", etc.), so the UI routes every render through
// `verifDisplayLabel`. These tests pin the four mappings and force any new
// VerifLevel member to ship a display label in the same change.

import { describe, it, expect } from "vitest";
import { verifDisplayLabel, type VerifLevel } from "@/lib/data";

const EXPECTED: Record<VerifLevel, string> = {
  "Provider-synced": "API-verified",
  "Device-synced": "CLI-verified",
  Estimated: "Token-only estimate",
  "Self-reported": "Manual entry",
};

describe("verifDisplayLabel", () => {
  it("maps every wire-format VerifLevel to a domain-specific display label", () => {
    for (const level of Object.keys(EXPECTED) as VerifLevel[]) {
      expect(verifDisplayLabel(level)).toBe(EXPECTED[level]);
    }
  });

  it("never echoes the wire-format literal back to the caller", () => {
    for (const level of Object.keys(EXPECTED) as VerifLevel[]) {
      expect(verifDisplayLabel(level)).not.toBe(level);
    }
  });

  it("never returns a fitness-domain word", () => {
    const banned = /\b(fitness|workout|calorie|heart\s?rate|step|activity)\b/i;
    for (const level of Object.keys(EXPECTED) as VerifLevel[]) {
      expect(verifDisplayLabel(level)).not.toMatch(banned);
    }
  });
});
