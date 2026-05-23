// playwright.config.ts — e2e harness for the FSA picker import flow.
//
// What this exists for: the unit tests (vitest) cover parsers, hashing,
// validateSummary, store factory, and Redis Lua. They CANNOT verify the
// browser-side seam where showDirectoryPicker → runImport → POST /api/burnindex
// glues together. A regression there is silent under unit tests but observable
// to a real user (envelope leak, wrong handle rejection, wrong period window).
//
// Workers: 1. The dev server + MemoryBurnStore are process-local, so parallel
// workers would race on the leaderboard state. Single-worker keeps spec
// determinism without needing a per-test store reset RPC.
//
// webServer.env: BURN_STORE=memory routes getStore() to MemoryBurnStore — the
// e2e fileStore would otherwise pollute .data/burn-*.json on every run, and
// owner cleanup-test-handle.mjs would have to be re-run after every CI green.
// UPSTASH_REDIS_REST_URL is INTENTIONALLY omitted: a developer with .env.local
// holding a Redis URL must not have that URL leak into the e2e run.

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // visual.spec.ts MUST only run via playwright.config.visual.ts (prod build).
  // If picked up under dev mode (this config's webServer), Turbopack CSS hash
  // drift produces non-deterministic baseline diffs — silent rot of the
  // baseline lock. Excluding it from the default project keeps the dev-mode
  // e2e harness (preflight + hero-fold + testid-coverage) fast and the visual
  // baseline single-source-of-truth.
  testIgnore: /visual\.spec\.ts/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "html",
  use: {
    baseURL: "http://localhost:3002",
    trace: "on-first-retry",
    // Visual regression baseline stability (Track 4 — Codex A-0 권장).
    // DPR=1 keeps raster integer-pixel; en-US/UTC/light pin locale-derived
    // chrome (date strings, time formats, prefers-color-scheme).
    // reducedMotion option omitted: @playwright/test@1.60.0 TestOptions
    // typedef doesn't expose it, and expect.toHaveScreenshot.animations
    // "disabled" below already freezes CSS animations for visual baselines
    // (the only place motion would corrupt a raster).
    deviceScaleFactor: 1,
    locale: "en-US",
    timezoneId: "UTC",
    colorScheme: "light",
    launchOptions: {
      // font-render-hinting=none + disable-font-subpixel-positioning +
      // disable-skia-runtime-opts: 3 flags absorb most macOS↔Linux raster diff.
      // force-color-profile=srgb (Codex A-0 #1) pins ICC profile so wide-gamut
      // displays don't shift baseline colors.
      args: [
        "--font-render-hinting=none",
        "--disable-font-subpixel-positioning",
        "--disable-skia-runtime-opts",
        "--force-color-profile=srgb",
      ],
    },
  },
  expect: {
    // maxDiffPixelRatio 0.02 start (Codex A-0 #3): 0.005 generates false
    // positives until 10× CI runs stabilize. Tighten to 0.01 → 0.005 after
    // 6-week ops data. threshold=0.15 per-pixel color tolerance.
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      threshold: 0.15,
      animations: "disabled",
      caret: "hide",
      scale: "css",
    },
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run dev -- --port 3002",
    url: "http://localhost:3002",
    reuseExistingServer: !process.env.CI,
    // Cold Next.js dev starts can exceed the default 60 s on first-build CI
    // runners. 120 s buffer prevents flaky pre-spec timeouts.
    timeout: 120_000,
    env: {
      BURN_STORE: "memory",
    },
  },
});
