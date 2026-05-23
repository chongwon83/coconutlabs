// e2e/hero-fold.spec.ts — visual regression gate for landing page
// invariants locked in tracks 1~3 (2026-05-23 cycle).
//
// What this exists for: hero above-fold composition + sticky-header nav
// layout drifted twice in the last 3 cycles (ProductShot fold invasion;
// "Workflow Drops" label overflow risk). Unit tests cannot see CSS-driven
// layout. The Playwright boundingBox / computed style assertions here
// freeze the 3 invariants from docs/decision/above-fold-3-elements-2026-05-23.md
// as deterministic gates that fail loud when a future commit reintroduces
// the regression.
//
// Codex Track 4 review (2026-05-23) flagged screenshot baselines as the
// higher-flake half of visual testing (font raster diff CI/local,
// first-green-baseline anti-pattern). This spec therefore covers ONLY DOM
// /layout invariants; screenshot baselines are a separate next-cycle task
// once a Linux Chromium baseline environment is locked.
//
// Animation/transition disabling + document.fonts.ready are still applied
// because rect measurements rely on the same stability as screenshots.

import { test, expect, Page } from "@playwright/test";

// ── Stabilization helpers ────────────────────────────────────────────────────

async function disableMotionAndAwaitFonts(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const style = document.createElement("style");
    style.textContent = `*, *::before, *::after {
      animation: none !important;
      transition: none !important;
      caret-color: transparent !important;
    }`;
    document.head.appendChild(style);
  });
}

async function gotoStable(page: Page): Promise<void> {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
}

// ── Constants from docs/decision/above-fold-3-elements-2026-05-23.md ─────────

const MOBILE = { width: 375, height: 667 };
// iOS Safari address bar safety: 667 viewport - ~27 chrome = ~640 visible.
// HYBRID lock invariant 2 (above-fold artifact).
const CTA_BOTTOM_MAX_PX = 640;

// 920 = last mobile breakpoint (nav-links display:none required)
// 921 = first desktop breakpoint (nav-links visible required)
const NAV_HIDDEN_VIEWPORTS = [
  { name: "375", width: 375, height: 667 },
  { name: "920", width: 920, height: 768 },
];
const NAV_VISIBLE_VIEWPORTS = [
  { name: "921", width: 921, height: 768 },
  { name: "1024", width: 1024, height: 800 },
  { name: "1280", width: 1280, height: 800 },
];

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe("Above-fold HYBRID lock (mobile 375x667)", () => {
  test.use({ viewport: MOBILE });

  test.beforeEach(async ({ page }) => {
    await disableMotionAndAwaitFonts(page);
    await gotoStable(page);
  });

  test("primary path: headline, sub, CTA all visible", async ({ page }) => {
    // HYBRID lock invariant 1: primary path must render (not display:none).
    const headline = page.locator(".hero-headline");
    const sub = page.locator(".hero-sub");
    const cta = page
      .locator('button:has-text("Join Burn Index")')
      .first();

    await expect(headline).toBeVisible();
    await expect(sub).toBeVisible();
    await expect(cta).toBeVisible();

    const [hBox, sBox, cBox] = await Promise.all([
      headline.boundingBox(),
      sub.boundingBox(),
      cta.boundingBox(),
    ]);

    expect(hBox?.height ?? 0).toBeGreaterThan(0);
    expect(sBox?.height ?? 0).toBeGreaterThan(0);
    expect(cBox?.height ?? 0).toBeGreaterThan(0);
  });

  test("CTA bottom fits iOS Safari visible area", async ({ page }) => {
    // HYBRID lock invariant 2: cta_bottom <= 640 (iOS Safari address bar).
    // 2026-05-23 measurement: 467.19. Generous headroom against drift.
    const cta = page
      .locator('button:has-text("Join Burn Index")')
      .first();
    const box = await cta.boundingBox();
    expect(box).not.toBeNull();
    const ctaBottom = (box!.y) + (box!.height);
    expect(ctaBottom).toBeLessThanOrEqual(CTA_BOTTOM_MAX_PX);
  });

  test("ProductShot (hero-right) is hidden on mobile", async ({ page }) => {
    // HYBRID lock invariant 3: hero-right MUST NOT enter fold on ≤920px.
    // app/globals.css @media (max-width: 920px) { .hero-right { display: none } }
    const heroRight = page.locator(".hero-right");
    const display = await heroRight.evaluate(
      (el) => window.getComputedStyle(el).display
    );
    expect(display).toBe("none");
  });

  test("eyebrow + chips hidden on mobile (Step A+B of HYBRID)", async ({
    page,
  }) => {
    // Track 2 HYBRID Step A+B: removed eyebrow + chips from mobile fold.
    // If a future commit re-shows them, fold composition breaks.
    for (const sel of [".hero-eyebrow", ".hero-chips"]) {
      const el = page.locator(sel);
      const display = await el.evaluate(
        (node) => window.getComputedStyle(node).display
      );
      expect(display, `${sel} must be display:none on mobile`).toBe("none");
    }
  });
});

test.describe("Nav-links visibility per breakpoint", () => {
  for (const v of NAV_HIDDEN_VIEWPORTS) {
    test(`hidden at ${v.name}x${v.height}`, async ({ page }) => {
      await disableMotionAndAwaitFonts(page);
      await page.setViewportSize({ width: v.width, height: v.height });
      await gotoStable(page);

      const navLinks = page.locator(".nav-links");
      const display = await navLinks.evaluate(
        (el) => window.getComputedStyle(el).display
      );
      expect(
        display,
        `.nav-links must be display:none at viewport ${v.name}`
      ).toBe("none");
    });
  }

  for (const v of NAV_VISIBLE_VIEWPORTS) {
    test(`visible + no wrap + no CTA overlap at ${v.name}x${v.height}`, async ({
      page,
    }) => {
      await disableMotionAndAwaitFonts(page);
      await page.setViewportSize({ width: v.width, height: v.height });
      await gotoStable(page);

      const navLinks = page.locator(".nav-links");
      await expect(navLinks).toBeVisible();

      // Wrap check: scrollWidth must equal clientWidth for each .nav-link.
      // (rectHeight > lineHeight*1.25 was a false positive — .nav-link
      //  has padding 6px 12px so rect = lineHeight + 12px ≠ wrap. See
      //  Track 3 Gate A decision-log entry.)
      const wrapInfo = await page.$$eval(".nav-links .nav-link", (links) =>
        links.map((el) => ({
          text: (el as HTMLElement).innerText,
          scrollWidth: (el as HTMLElement).scrollWidth,
          clientWidth: (el as HTMLElement).clientWidth,
        }))
      );
      for (const info of wrapInfo) {
        expect(
          info.scrollWidth,
          `nav-link "${info.text}" must not horizontally overflow`
        ).toBeLessThanOrEqual(info.clientWidth);
      }

      // Overlap check: nav-links container right edge must precede the
      // "Join Burn Index" CTA left edge. Measured tolerance 1px to
      // absorb sub-pixel rounding.
      const navBox = await navLinks.boundingBox();
      const ctaBox = await page
        .locator('nav.nav-v3 button:has-text("Join Burn Index")')
        .first()
        .boundingBox();
      expect(navBox).not.toBeNull();
      expect(ctaBox).not.toBeNull();
      const navRight = navBox!.x + navBox!.width;
      const gap = ctaBox!.x - navRight;
      expect(
        gap,
        `nav-links right (${navRight.toFixed(1)}) must not overlap CTA left ` +
          `(${ctaBox!.x.toFixed(1)}); gap=${gap.toFixed(1)}`
      ).toBeGreaterThanOrEqual(-1);
    });
  }
});
