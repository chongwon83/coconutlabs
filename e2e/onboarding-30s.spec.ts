// e2e/onboarding-30s.spec.ts — measures the wall-clock time for the
// coconutlabs.xyz upload flow: page load → paste JSON → validate → confirm.
//
// Goal: 5 runs, median ≤ 30 s.
// BURN_STORE=memory (playwright.config.ts) keeps runs isolated from production.
//
// Timing starts after page.goto() resolves (DOMContentLoaded + hydration),
// representing the in-page interaction time a real user would experience.
// Page load itself is excluded because dev-server cold start is not
// representative of a production CDN response.

import { test, expect } from "@playwright/test";

// ── Fixture ──────────────────────────────────────────────────────────────────

// Minimal valid schemaVersion 2 envelope — one row, all 9 required fields,
// no extra keys.  Passes the client validateSummary whitelist and the
// server-side re-validation in POST /api/burnindex.
const FIXTURE_ENVELOPE = JSON.stringify({
  schemaVersion: "2",
  generatedAt: "2026-05-21T07:14:26Z",
  periodWindow: {
    period: "week",
    since: "2026-05-11T00:00:00Z",
    until: "2026-05-18T00:00:00Z",
  },
  rows: [
    {
      tool: "claude-code",
      model: "claude-sonnet-4-6",
      tokenCount: {
        input: 100000,
        output: 20000,
        cacheRead: 5000,
        cacheWrite: 2000,
        cachedInput: 1000,
      },
      estimatedCostUsd: 9.87,
      timestampBucket: "2026-05-15",
      sessionCount: 3,
      activeDays: 2,
      projectHash: "abc123def456",
      verification: {
        tokenSource: "device",
        costBasis: "estimated",
        priceConfidence: "high",
        level: "Device-synced",
      },
    },
  ],
  grandTotal: {
    totalTokens: 128000,
    estimatedCostUsd: 9.87,
  },
});

const RUNS = 5;
const THRESHOLD_MS = 30_000;

// Each run: page.goto + 2 fills + click + waitForSelector + click + wait ≈ 5-15 s.
// 5 runs × 20 s safety margin = 100 s total. Allow 120 s.
test.setTimeout(120_000);

// ── Test ─────────────────────────────────────────────────────────────────────

test("onboarding upload flow completes in ≤ 30 s (5-run median)", async ({ page }) => {
  const times: number[] = [];

  for (let i = 0; i < RUNS; i++) {
    // Unique handle per run so BURN_STORE upsertEntry never races with a prior
    // run's write even if the server is reused across the test suite.
    const handle = `@e2e-30s-${i}-${Date.now()}`;

    // Page load (dev server already warm via playwright.config.ts webServer).
    await page.goto("/");

    // Timing starts after the page has loaded and hydrated.
    const t0 = Date.now();

    // Open the "Join Burn Index" modal (form lives behind a modal trigger).
    await page.locator('button:has-text("Join Burn Index")').first().click();

    // Step 1: fill handle + paste the JSON.
    await page.fill("#jbi-handle", handle);
    await page.fill("#jbi-paste", FIXTURE_ENVELOPE);

    // Click "Validate & preview" (the form's submit button).
    await page.click('button[type="submit"]');

    // Step 2 (preview card): wait for the confirm handle input to appear.
    await page.waitForSelector("#jbi-handle-confirm");

    // Handle is already pre-filled from state; click "Add to Burn Index".
    await page.click('button:has-text("Add to Burn Index")');

    // Success: wait for the toast (role="status").
    await page.waitForSelector('div[role="status"]');

    const elapsed = Date.now() - t0;
    times.push(elapsed);

    // eslint-disable-next-line no-console
    console.log(`  run ${i + 1}/${RUNS}: ${elapsed} ms`);
  }

  // Median of 5 samples (index 2 after sort).
  const sorted = [...times].sort((a, b) => a - b);
  const medianMs = sorted[Math.floor(sorted.length / 2)];

  // eslint-disable-next-line no-console
  console.log(
    `\n  timings : [${times.map((t) => `${t}ms`).join(", ")}]`,
    `\n  median  : ${medianMs} ms`,
    `\n  threshold: ${THRESHOLD_MS} ms`,
    `\n  result  : ${medianMs <= THRESHOLD_MS ? "PASS" : "FAIL"}`,
  );

  expect(
    medianMs,
    `Median upload-flow time (${medianMs} ms) exceeds the 30 s threshold. ` +
      `Timings: [${times.join(", ")}] ms.`,
  ).toBeLessThanOrEqual(THRESHOLD_MS);
});
