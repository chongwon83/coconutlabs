// e2e/testid-coverage.spec.ts — Track 4 Step B F4 DOM verification.
//
// Why this spec exists (and stays): the Button primitive at
// components/primitives/index.tsx:157 spreads `{...props}` onto the underlying
// <button>, so data-testid SHOULD pass through. The risk is regression — a
// future primitive refactor that omits the spread would silently break visual
// baseline locators with no compile error. This spec asserts the live DOM
// count for each of the 18 unique testid types attached in Step B, plus the
// 3 data-mask containers. If the count drifts, the regression surfaces here
// before visual.spec.ts (Step C) starts producing baselines against a
// missing-testid DOM.
//
// Counts encode the Step B contract from the plan:
//   - 11 unique Hero testids (some attached to 3 ProductShot variants;
//     only 1 variant renders at a time when SHOW_LEGACY=false default).
//   - 7 unique Nav testids (nav-link repeats per V3_NAV link, currently 4).

import { test, expect } from "@playwright/test";

const EXPECTED = [
  // Hero (11 unique types) — counts at SHOW_LEGACY=false default
  { testid: "hero-section",         min: 1, max: 1 },
  { testid: "hero-eyebrow",         min: 1, max: 1 },
  { testid: "hero-headline",        min: 1, max: 1 },
  { testid: "hero-sub",             min: 1, max: 1 },
  { testid: "hero-chips",           min: 1, max: 1 },
  { testid: "hero-cta-group",       min: 1, max: 1 },
  { testid: "hero-cta-primary",     min: 1, max: 1 }, // Button primitive pass-through
  { testid: "hero-right",           min: 1, max: 1 },
  { testid: "hero-secondary-card",  min: 1, max: 1 },
  { testid: "product-shot-header",  min: 1, max: 1 }, // 1 variant rendered
  { testid: "product-shot-content", min: 1, max: 1 }, // 1 variant rendered

  // Nav (7 unique types)
  { testid: "nav-root",         min: 1, max: 1 },
  { testid: "nav-inner",        min: 1, max: 1 },
  { testid: "nav-logo",         min: 1, max: 1 },
  { testid: "nav-links",        min: 1, max: 1 },
  { testid: "nav-link",         min: 1, max: 10 }, // V3_NAV count, allow drift
  { testid: "nav-cta",          min: 1, max: 1 },
  { testid: "nav-cta-primary",  min: 1, max: 1 }, // Button primitive pass-through
];

test.describe("Track 4 Step B: data-testid DOM coverage", () => {
  test("18 unique testid types present in expected counts", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);

    const counts = await page.evaluate((expected) => {
      return expected.map((e) => ({
        testid: e.testid,
        count: document.querySelectorAll(`[data-testid="${e.testid}"]`).length,
      }));
    }, EXPECTED);

    const failures: string[] = [];
    for (let i = 0; i < EXPECTED.length; i++) {
      const exp = EXPECTED[i];
      const got = counts[i].count;
      if (got < exp.min || got > exp.max) {
        failures.push(
          `${exp.testid}: expected [${exp.min}..${exp.max}], got ${got}`
        );
      }
    }
    expect(failures, failures.join(" | ")).toEqual([]);
  });

  test("data-mask='dynamic' present on 2 unique container types", async ({
    page,
  }) => {
    // hero-secondary-card + product-shot-content (1 variant). The mask
    // contract for visual.spec.ts is "every dynamic-text region must carry
    // data-mask=dynamic so the screenshot diff ignores VES/cost/count text".
    await page.goto("/", { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);

    const maskedCount = await page.evaluate(
      () => document.querySelectorAll('[data-mask="dynamic"]').length
    );
    // hero-secondary-card (1) + product-shot-content (1 variant) = 2 minimum.
    expect(maskedCount).toBeGreaterThanOrEqual(2);
  });
});
