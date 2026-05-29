// e2e/burn-index-ves-gate.spec.ts — VES de-emphasis gate (2026-05-29).
//
// What this exists for: VES (= verified fixes ÷ AI cost) is the structural
// headline of the product, but it renders empty (0.0 / no score) for almost
// every live row because the verified-fixes numerator is ≈0 in reality.
// Headlining an empty metric undercuts a "trust the data" product, so the VES
// column, the StatusBar Top-VES line, and the default sort now GATE on real
// data: they only appear once ≥ VES_REVEAL_THRESHOLD (2) builders post a
// nonzero VES (hasEnoughVes). Below that, the column is hidden, the default
// sort falls back to most-tokens desc, and StatusBar shows a neutral count.
//
// The sort spec (burn-index-sort.spec.ts) covers the SHOWN state (2 nonzero VES
// → VES desc default). This spec is the regression net for the HIDDEN state,
// which is the live reality today.
//
// Seed strategy mirrors the sort spec: page.route() stubs GET /api/burnindex
// with a synthetic ImportedEntry[]. Exactly ONE row carries a nonzero VES —
// the boundary case (1 < threshold 2), proving the gate keys on the threshold,
// not merely on "all empty".
//
// SECURITY: no real store touched, no token issued. The GET stub is the
// boundary — no write path is exercised.

import { test, expect, type Page } from "@playwright/test";
import type { ImportedEntry } from "@/lib/data";

// dave=120 (nonzero), erin=0 (zero → not counted), finn=absent. Only 1 nonzero
// VES → hasEnoughVes() === false → column hidden, default sort = tokens desc.
// Tokens: dave 300k > erin 200k > finn 100k, so tokens-desc → [dave, erin, finn].
const SEED: ImportedEntry[] = [
  {
    handle: "@dave",
    avatar: "DA",
    verif: "Device-synced",
    totalTokens: 300_000,
    estimatedCostUsd: 3.0,
    ves: 120,
    period: "week",
    since: "2026-05-18T00:00:00Z",
    until: "2026-05-25T00:00:00Z",
    importedAt: "2026-05-25T10:00:00Z",
    toolsUsed: ["claude-code"],
    breakdown: [],
    trendDir: "up",
    trendPct: 10,
  },
  {
    handle: "@erin",
    avatar: "ER",
    verif: "Device-synced",
    totalTokens: 200_000,
    estimatedCostUsd: 2.0,
    ves: 0,
    period: "week",
    since: "2026-05-18T00:00:00Z",
    until: "2026-05-25T00:00:00Z",
    importedAt: "2026-05-25T11:00:00Z",
    toolsUsed: ["codex"],
    breakdown: [],
    trendDir: "flat",
    trendPct: 0,
  },
  {
    handle: "@finn",
    avatar: "FI",
    verif: "Device-synced",
    totalTokens: 100_000,
    estimatedCostUsd: 1.0,
    period: "week",
    since: "2026-05-18T00:00:00Z",
    until: "2026-05-25T00:00:00Z",
    importedAt: "2026-05-25T12:00:00Z",
    toolsUsed: ["claude-code", "codex"],
    breakdown: [],
    // ves absent.
  },
];

async function seedLeaderboard(page: Page): Promise<void> {
  await page.route("**/api/burnindex", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ entries: SEED }),
    });
  });
}

async function visibleHandles(page: Page): Promise<string[]> {
  return await page.locator(".lb-row .lb-handle").allTextContents();
}

test.describe("BurnIndex VES gate — hidden state (< 2 nonzero VES)", () => {
  test.beforeEach(async ({ page }) => {
    await seedLeaderboard(page);
    await page.goto("/#burn");
    await expect(page.locator(".lb-row")).toHaveCount(3);
  });

  test("VES column is absent from header and rows", async ({ page }) => {
    // The whole column gates out: no sort button, no header cell, no row cell.
    await expect(page.getByRole("button", { name: "Sort by VES" })).toHaveCount(0);
    await expect(page.locator(".lb-head .lb-col-ves")).toHaveCount(0);
    await expect(page.locator(".lb-row .lb-col-ves")).toHaveCount(0);
  });

  test("container carries the no-VES grid modifier", async ({ page }) => {
    // lb-grid--no-ves drops the VES track so the 6-column grid lines up with the
    // 6 rendered cells (rank/builder/tokens/cost/models/trend).
    await expect(page.locator(".lb-v3.lb-grid--no-ves")).toHaveCount(1);
  });

  test("default sort falls back to Tokens desc", async ({ page }) => {
    expect(await visibleHandles(page)).toEqual(["@dave", "@erin", "@finn"]);
    await expect(
      page
        .locator('[role="columnheader"]')
        .filter({ has: page.getByRole("button", { name: "Sort by Tokens" }) }),
    ).toHaveAttribute("aria-sort", "descending");
  });

  test("StatusBar shows a neutral count, never Top VES: 0.0", async ({ page }) => {
    const statusItem = page.locator('[data-testid="status-bar"] .status-item');
    await expect(statusItem).toContainText("3 builders ranked");
    await expect(page.locator('[data-testid="status-bar"]')).not.toContainText("Top VES");
  });
});

test.describe("BurnIndex VES gate — empty store", () => {
  test("no rows, StatusBar invites the first builder", async ({ page }) => {
    await page.route("**/api/burnindex", async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ entries: [] }),
      });
    });
    await page.goto("/#burn");
    await expect(page.locator(".lb-row")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Sort by VES" })).toHaveCount(0);
    await expect(
      page.locator('[data-testid="status-bar"] .status-item'),
    ).toContainText("Be first on the board");
  });
});
