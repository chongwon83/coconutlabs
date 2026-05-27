// e2e/hero-pulse.spec.ts — B.5 micro interactions.
//
// What this exists for:
//   1. Hero `.product-shot-dot` gains a CSS-only `pulseDot` animation in
//      B.5 (app/globals.css). Without a test, future commits could
//      revert the animation silently — visual regression covers
//      static pixels but not animation-name presence.
//   2. B.5 also closes the reduced-motion debt on `.pulseGreen` and
//      `.ticker` infinite animations that B.4 left ungated. The global
//      `@media (prefers-reduced-motion: reduce)` block at globals.css
//      EOF must disable both the new pulseDot and the existing ticker
//      carrier. If a future commit removes the gate, accessibility
//      regresses with no compile-time signal.
//
// Why DOM-only (no screenshots): hero-fold.spec.ts already documents
// the rationale — Linux/macOS font raster diff makes pixel baselines
// flaky, while computed-style assertions are deterministic. Animation
// presence/absence is a textbook fit for computed-style assertions.
//
// Viewport choice: `.product-shot-dot` lives inside `.hero-right` which
// is `display:none` at ≤920px (mobile breakpoint). Tests use 1280x800
// to ensure the dot is actually rendered and queryable.
//
// `.ticker-track` is the second carrier checked under reduced motion.
// Cycle A (2026-05-27) replaced hardcoded items with a live
// /api/burnindex feed — Ticker returns null when the store is empty
// (memory store in CI). The two ticker tests below install a minimal
// route stub so the Ticker mounts and .ticker-track is present.
//
// Codex REVISE fix (2026-05-26): the ticker uses `padding-left: 100%` to
// start content offscreen and relies on the `ticker` keyframe to scroll
// it in. Naively disabling the animation under reduced-motion leaves the
// strip permanently blank — strictly worse than the pre-B.5 debt. The
// global reduced-motion block now also overrides `padding-left: 0;
// transform: none` on `.ticker-inner` and `.ticker-track`. Test #3 (the
// "stays in viewport" spec) is the regression guard for that override.

import { test, expect, Page } from "@playwright/test";

const DESKTOP = { width: 1280, height: 800 };

// Minimal entry that satisfies ImportedEntry shape + triggers Ticker render.
const TICKER_STUB = {
  handle: "@test-ticker",
  avatar: "TT",
  verif: "Device-synced",
  totalTokens: 500_000,
  estimatedCostUsd: 5.0,
  period: "week",
  since: "2026-05-18T00:00:00Z",
  until: "2026-05-25T00:00:00Z",
  importedAt: "2026-05-27T00:00:00Z",
  toolsUsed: ["claude-code"],
  breakdown: [],
};

// Install a GET stub for /api/burnindex so Ticker mounts in CI (empty store).
// Must be called BEFORE page.goto() — Playwright intercepts register in order.
async function seedTicker(page: Page): Promise<void> {
  await page.route("**/api/burnindex", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ entries: [TICKER_STUB] }),
    });
  });
}

async function awaitFonts(page: Page): Promise<void> {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
}

test.describe("B.5 Hero pulse + reduced-motion gates", () => {
  test.use({ viewport: DESKTOP });

  test("default: .product-shot-dot has pulseDot animation", async ({
    page,
  }) => {
    await awaitFonts(page);
    const dot = page.locator(".product-shot-dot");
    await expect(dot).toBeVisible();
    const animationName = await dot.evaluate(
      (el) => window.getComputedStyle(el).animationName,
    );
    expect(animationName).toBe("pulseDot");
  });

  test("reduced-motion: .product-shot-dot animation frozen", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await awaitFonts(page);
    const dot = page.locator(".product-shot-dot");
    await expect(dot).toBeVisible();
    const animationName = await dot.evaluate(
      (el) => window.getComputedStyle(el).animationName,
    );
    expect(animationName).toBe("none");
  });

  test("default: .hero-secondary-header-dot has hero-secondary-pulse animation", async ({
    page,
  }) => {
    await awaitFonts(page);
    const dot = page.locator(".hero-secondary-header-dot");
    await expect(dot).toBeVisible();
    const animationName = await dot.evaluate(
      (el) => window.getComputedStyle(el).animationName,
    );
    expect(animationName).toBe("hero-secondary-pulse");
  });

  test("reduced-motion: .hero-secondary-header-dot animation frozen", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await awaitFonts(page);
    const dot = page.locator(".hero-secondary-header-dot");
    await expect(dot).toBeVisible();
    const animationName = await dot.evaluate(
      (el) => window.getComputedStyle(el).animationName,
    );
    expect(animationName).toBe("none");
  });

  test("reduced-motion: .ticker-track animation frozen (B.4 debt closed)", async ({
    page,
  }) => {
    await seedTicker(page); // ensure Ticker mounts (live feed, empty CI store)
    await page.emulateMedia({ reducedMotion: "reduce" });
    await awaitFonts(page);
    const ticker = page.locator(".ticker-track").first();
    await expect(ticker).toBeAttached();
    const animationName = await ticker.evaluate(
      (el) => window.getComputedStyle(el).animationName,
    );
    expect(animationName).toBe("none");
  });

  test("reduced-motion: ticker content stays in viewport (codex REVISE fix)", async ({
    page,
  }) => {
    // Codex 2026-05-26 caught: .ticker-inner / .ticker-track use
    // `padding-left: 100%` to start content offscreen and rely on the
    // ticker keyframe to scroll it in. Disabling the animation without
    // overriding padding/transform leaves the strip permanently blank —
    // worse than the original a11y debt. The reduced-motion block now
    // forces `padding-left: 0; transform: none` on both selectors.
    // This test guards that override.
    await seedTicker(page); // ensure Ticker mounts (live feed, empty CI store)
    await page.emulateMedia({ reducedMotion: "reduce" });
    await awaitFonts(page);
    const ticker = page.locator(".ticker-track").first();
    await expect(ticker).toBeAttached();

    const computed = await ticker.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return { paddingLeft: cs.paddingLeft, transform: cs.transform };
    });
    // paddingLeft "0px" and transform "none" — content sits flush-left,
    // not 100% offscreen.
    expect(computed.paddingLeft).toBe("0px");
    expect(computed.transform).toBe("none");

    // First child must render inside the viewport (x < viewport width).
    const firstItem = ticker.locator(":scope > *").first();
    await expect(firstItem).toBeVisible();
    const box = await firstItem.boundingBox();
    expect(box).not.toBeNull();
    const viewport = page.viewportSize();
    if (box && viewport) {
      expect(box.x).toBeLessThan(viewport.width);
      expect(box.x + box.width).toBeGreaterThan(0);
    }
  });
});
