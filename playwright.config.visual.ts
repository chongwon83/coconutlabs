// playwright.config.visual.ts — Track 4 Step C visual baseline runner.
//
// Why this is separate from playwright.config.ts (Codex C-0 Q1 ✅):
// Visual baselines MUST be captured against a Next.js prod build (`next
// build && next start`). Dev mode emits Turbopack content hashes that drift
// across runs and produce silent baseline diff. Mixing dev/prod via env
// flags in a single config conflates the two webServer lifecycles and
// makes "what mode produced this baseline" non-obvious to a reviewer.
// A dedicated config file makes the mode declarative: if you ran this
// config, you ran prod build. CI references this file by name.
//
// All non-webServer options inherit by extension from the base config:
// 4 Chrome raster flags, DPR=1, en-US/UTC/light, toHaveScreenshot
// thresholds. Only webServer + testMatch are overridden — keeping a single
// source of truth for raster determinism.

import { defineConfig } from "@playwright/test";
import baseConfig from "./playwright.config";

export default defineConfig({
  ...baseConfig,

  // Run ONLY the visual spec. preflight + hero-fold + testid-coverage are
  // dev-mode contract tests; running them under prod build wastes ~60s of
  // build time per spec.
  testMatch: /visual\.spec\.ts/,

  webServer: {
    // `next build` then `next start` — the only mode producing reproducible
    // CSS chunk hashes. 3-minute timeout absorbs cold-build (TypeScript +
    // Turbopack bundle) on first CI runner of the day.
    command: "npm run build && npm run start -- --port 3002",
    url: "http://localhost:3002",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    // NO env.BURN_STORE override here. `next start` runs with
    // NODE_ENV=production, which trips the audited security guard at
    // lib/server/burnStore/index.ts:31-37 if BURN_STORE=memory. Falling
    // through to FileBurnStore (.data/burn-*.json, gitignored) keeps the
    // baseline run prod-realistic AND silent — visual specs don't write
    // burn data, so the file store reads stay idempotent across runs.
    // Base config sets BURN_STORE=memory because dev mode (NODE_ENV
    // !== "production") bypasses the guard; we cannot inherit that
    // override under prod build.
  },
});
