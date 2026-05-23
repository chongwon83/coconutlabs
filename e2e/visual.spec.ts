// e2e/visual.spec.ts — Track 4 Step C visual regression baseline.
//
// What this exists for: lock 3 viewport baselines (mobile/desktop-921/
// desktop-1280) so any pixel regression in above-fold layout, sticky-
// header chrome, hero-right encroachment, or nav-link wrap fails CI BEFORE
// merge. preflight.spec.ts catches environmental drift; testid-coverage
// catches DOM contract drift; THIS spec catches visual drift.
//
// Codex C-0 adversarial review (2026-05-24) shaped 4 decisions:
//   Q1 → separate playwright.config.visual.ts (this spec runs under prod
//        build, not dev — dev mode produces non-deterministic CSS hashes).
//   Q2 → mobile-375 captures FULL VIEWPORT, not a hero-only clip. A clip
//        would miss sticky-header overlap regression (Track 0-3 lock #2).
//   Q3 → desktop sticky-header uses AUTO-MEASURED nav-root height, not
//        hardcoded 88px. Hardcoded would silently bake whatever the nav
//        was at baseline time — a future nav resize would diff but be
//        normalized against the wrong reference.
//   Q4 → mask uses TWO scoped locators, not one bare `[data-mask="dynamic"]`.
//        Bare selector would over-mask if SHOW_LEGACY=true ever ships
//        (3 ProductShot variants in DOM simultaneously). Scoping to the
//        actual containers limits the mask to known-dynamic regions only.
//
// Baseline origin: GitHub Actions Linux chromium (.github/workflows/ci.yml
// one-shot --update-snapshots step). Local macOS PNG commit is PROHIBITED
// per plan C-5 (macOS/Linux raster diff is not 100% absorbed by 4 Chrome
// flags). The plan's C-2 step instructs deleting any local PNG after the
// dry-run pass.

import { test, expect, type Page } from "@playwright/test";

type Viewport = {
  name: string;
  width: number;
  height: number;
  // mobile uses fullPage:false viewport capture (Codex Q2 ✅).
  // desktop uses sticky-header clip with auto-measured nav height (Q3 ✅).
  mode: "viewport" | "sticky-header";
};

const VIEWPORTS: Viewport[] = [
  { name: "mobile-375",   width: 375,  height: 667, mode: "viewport" },
  { name: "desktop-921",  width: 921,  height: 600, mode: "sticky-header" },
  { name: "desktop-1280", width: 1280, height: 800, mode: "sticky-header" },
];

async function stabilize(page: Page): Promise<void> {
  // Same stabilization as preflight.spec.ts INV gating: networkidle then
  // explicit font load wait. preflight has already proven these 8
  // invariants hold; we re-apply the 2 that affect raster (fonts, network)
  // before each visual capture.
  await page.goto("/", { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
}

test.describe("Track 4 Step C: visual baseline (3 viewports)", () => {
  for (const vp of VIEWPORTS) {
    test(`${vp.name} (${vp.width}x${vp.height}, ${vp.mode})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await stabilize(page);

      // Mask: 2 scoped locators (Codex Q4 ✅). hero-secondary-card lives in
      // hero-left and renders at all viewports. hero-right scope wraps the
      // active ProductShot; at SHOW_LEGACY=false only 1 product-shot-content
      // matches, and even at SHOW_LEGACY=true the scope keeps mask contained
      // to the hero-right column instead of leaking to any future
      // [data-mask="dynamic"] elsewhere on the page.
      const mask = [
        page.locator('[data-testid="hero-secondary-card"]'),
        page.locator('[data-testid="hero-right"] [data-mask="dynamic"]'),
      ];

      if (vp.mode === "viewport") {
        // Full viewport capture. fullPage:false means we capture exactly
        // width × height (above-fold), which is what sticky-header
        // encroachment and CTA-below-fold regressions surface as.
        await expect(page).toHaveScreenshot(`${vp.name}.png`, {
          fullPage: false,
          mask,
        });
      } else {
        // Sticky-header clip. Measure nav-root height once, AFTER fonts +
        // network are settled — measuring during layout would race and
        // produce off-by-one clips.
        const nav = page.locator('[data-testid="nav-root"]');
        const box = await nav.boundingBox();
        if (!box) throw new Error(`nav-root boundingBox unavailable at ${vp.name}`);
        await expect(page).toHaveScreenshot(`${vp.name}.png`, {
          clip: {
            x: 0,
            y: 0,
            width: vp.width,
            height: Math.ceil(box.height),
          },
          mask,
        });
      }
    });
  }
});
