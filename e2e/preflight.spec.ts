// e2e/preflight.spec.ts — baseline-stability preflight (Track 4 Step A).
//
// What this exists for: visual.spec.ts (Track 4 Step C) baselines will only
// be reproducible if every per-run source of pixel drift is verified absent
// BEFORE the snapshot is taken. Font load races, late-arriving lazy images,
// stale localStorage from a prior session, and uncaught console errors all
// produce silent baseline drift that humans diagnose for hours. This spec
// gates each of those into an assertion that fails loud, BEFORE the
// screenshot spec runs. If preflight is green, a flaky baseline points at
// the renderer / OS — not at our page.
//
// Codex A-0 consultation (2026-05-23) added 2 invariants beyond the plan's
// original 6: console/pageerror count = 0 (uncaught errors mutate the DOM
// silently) and hero bounding box stability across 2 requestAnimationFrame
// ticks (catches layout shift completing after networkidle).
//
// hero-right invariant uses .hero-right className (already in DOM per
// hero-fold.spec.ts:109). Step B will add data-testid="hero-right" — both
// selectors must remain valid (className preserved, testid additive).

import { test, expect, Page } from "@playwright/test";

// ── Stabilization helpers ───────────────────────────────────────────────────
//
// disableMotionAndAwaitFonts diverges from hero-fold.spec.ts:25-35 in one
// way: we defer the style-injection until document.head exists. The
// hero-fold version assumes document.head is non-null at init-script time,
// which throws "Cannot read properties of null (reading 'appendChild')" as
// a pageerror in real runs. hero-fold passes only because it does not
// observe pageerror; INV-7 here would flake on every run otherwise.

async function disableMotionAndAwaitFonts(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const inject = () => {
      if (!document.head) return;
      const style = document.createElement("style");
      style.textContent = `*, *::before, *::after {
        animation: none !important;
        transition: none !important;
        caret-color: transparent !important;
      }`;
      document.head.appendChild(style);
    };
    if (document.head) inject();
    else document.addEventListener("DOMContentLoaded", inject, { once: true });
  });
}

async function gotoStable(page: Page): Promise<void> {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe("Preflight: baseline stability invariants (Track 4)", () => {
  test.beforeEach(async ({ page }) => {
    await disableMotionAndAwaitFonts(page);
  });

  test("INV-1: devicePixelRatio === 1", async ({ page }) => {
    // playwright.config.ts pins deviceScaleFactor=1 so raster is integer-pixel.
    // If devicePixelRatio drifts (e.g. CI runner ships a retina-equivalent
    // default), every pixel diff doubles and baselines invert false-positive.
    await gotoStable(page);
    const dpr = await page.evaluate(() => window.devicePixelRatio);
    expect(dpr, "deviceScaleFactor=1 should pin devicePixelRatio").toBe(1);
  });

  test("INV-2: no fonts in 'loading' state (FOFT-free)", async ({ page }) => {
    // CSS Font Loading API states: unloaded (never requested) / loading /
    // loaded / error. next/font registers each FontFace as 'unloaded' until
    // a glyph actually demands it, so an 'unloaded' entry is normal — that
    // weight just isn't on screen. The FOFT (Flash of Faux Text) hazard for
    // baselines is a font still in 'loading' after networkidle + fonts.ready:
    // that's the one that swaps mid-screenshot. 'error' would also corrupt
    // a baseline by locking the fallback raster.
    await gotoStable(page);
    const fontStatuses = await page.evaluate(() =>
      [...document.fonts].map((f) => ({
        family: f.family,
        weight: f.weight,
        status: f.status,
      }))
    );
    const inFlight = fontStatuses.filter(
      (f) => f.status === "loading" || f.status === "error"
    );
    expect(
      inFlight,
      `no FontFace may be loading/error post-ready; ${inFlight.length} pending`
    ).toEqual([]);
  });

  test("INV-3: priority/eager <img> all complete=true", async ({ page }) => {
    // networkidle waits for HTTP traffic, but <img> decoding can complete
    // AFTER the network request finishes. complete=true means decoded and
    // ready to paint — the actual condition a screenshot needs. priority/
    // eager imgs are the hero-shot candidates; lazy imgs may legitimately
    // still be loading and are not baseline-blocking.
    await gotoStable(page);
    const incomplete = await page.evaluate(() => {
      const imgs = document.querySelectorAll<HTMLImageElement>(
        'img[loading="eager"], img[fetchpriority="high"]'
      );
      return [...imgs]
        .filter((img) => !img.complete || img.naturalWidth === 0)
        .map((img) => ({ src: img.currentSrc || img.src }));
    });
    expect(
      incomplete,
      `all eager/priority <img> must be decoded; ${incomplete.length} pending`
    ).toEqual([]);
  });

  test("INV-4: localStorage / sessionStorage empty", async ({ page }) => {
    // A prior test or dev session can leave per-origin state (theme override,
    // onboarding-complete flag, FSA handle marker). Baselines must capture
    // the first-visit chrome, not a returning-user variant.
    await gotoStable(page);
    const counts = await page.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
    }));
    expect(counts).toEqual({ local: 0, session: 0 });
  });

  // INV-5 split into two viewport-isolated tests. Each test owns its own
  // BrowserContext (test.use of viewport creates a new context), and we add
  // an explicit page.reload({ waitUntil: "networkidle" }) after the initial
  // goto to bust any cached Turbopack CSS chunk inherited from the prior
  // worker session (workers=1 + fullyParallel=false shares the dev server).
  //
  // Diagnosis trail: synchronous getComputedStyle flaked 30-40%. Splitting
  // by viewport (test.use) reduced to 0% in isolation but persisted at 70%
  // in combined runs (3/10 pass → 4-10 fail, deterministic cumulative
  // pattern). A standalone diag spec confirmed innerWidth=375 +
  // matchMedia(max-width:920px)=true + display=none all correct on first
  // load. The failure only manifests when prior tests (INV-1..4 default
  // 1280x720 viewport) caused Turbopack to emit a CSS chunk hash that the
  // mobile context's HTML still references but no longer matches the
  // current rules. reload() forces the page to re-request the current
  // chunk URL, which Next.js resolves to the up-to-date CSS.

  test.describe("INV-5a: .hero-right display:none at mobile (375x667)", () => {
    test.use({ viewport: { width: 375, height: 667 } });
    test("hero-right hidden", async ({ page }) => {
      await gotoStable(page);
      await page.reload({ waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      await expect(
        page.locator(".hero-right"),
        "hero-right hidden at mobile breakpoint"
      ).toHaveCSS("display", "none");
    });
  });

  test.describe("INV-5b: .hero-right visible at desktop (1280x800)", () => {
    test.use({ viewport: { width: 1280, height: 800 } });
    test("hero-right visible", async ({ page }) => {
      await gotoStable(page);
      await page.reload({ waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      await expect(
        page.locator(".hero-right"),
        "hero-right visible at desktop breakpoint"
      ).toHaveCSS("display", "flex");
    });
  });

  test("INV-6: -webkit-font-smoothing === antialiased", async ({ page }) => {
    // Subpixel-antialiased text rasters differ between macOS local and Linux
    // CI by ~1-3% of changed pixels — the dominant source of macOS↔Linux
    // diff. globals.css must pin -webkit-font-smoothing: antialiased on body.
    await gotoStable(page);
    const smoothing = await page.evaluate(() =>
      window.getComputedStyle(document.body).getPropertyValue(
        "-webkit-font-smoothing"
      )
    );
    expect(smoothing).toBe("antialiased");
  });

  // ── Codex A-0 additions ────────────────────────────────────────────────────

  test("INV-7 (Codex): console.error + pageerror count === 0", async ({
    page,
  }) => {
    // Uncaught JS errors and console.error noise mutate the DOM (React error
    // boundaries swap to fallback UI, ResizeObserver warnings re-layout) and
    // produce silent baseline drift. A baseline run with a Sentry stub error
    // would lock the error UI as the "correct" baseline forever.
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
    });
    await gotoStable(page);
    // Give post-load handlers one tick to throw if they're going to.
    await page.waitForTimeout(100);
    expect(errors, `no console/pageerror; got ${errors.length}`).toEqual([]);
  });

  test("INV-8 (Codex): hero bounding box stable across 2 rAF ticks", async ({
    page,
  }) => {
    // networkidle + fonts.ready does not catch layout shift that completes
    // in a post-load useEffect (e.g. measuring a ref then resizing). If the
    // hero box still moves between two requestAnimationFrame callbacks, the
    // screenshot timing is non-deterministic. Compare hero rect at t and
    // t+2rAF; require pixel-equality.
    await gotoStable(page);
    const stable = await page.evaluate(async () => {
      const el = document.querySelector(".hero-headline");
      if (!el) return { ok: false, reason: "hero-headline not found" };

      const snap = () => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      };

      const before = snap();
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const after = snap();

      return {
        ok:
          before.x === after.x &&
          before.y === after.y &&
          before.w === after.w &&
          before.h === after.h,
        before,
        after,
      };
    });
    expect(
      stable.ok,
      `hero bbox unstable: before=${JSON.stringify(
        (stable as { before?: unknown }).before
      )} after=${JSON.stringify((stable as { after?: unknown }).after)}`
    ).toBe(true);
  });
});
