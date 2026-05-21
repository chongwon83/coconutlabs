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
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "html",
  use: {
    baseURL: "http://localhost:3002",
    trace: "on-first-retry",
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
