// e2e/burn-index-sort.spec.ts — PR Track A.4/A.8 column-sort contract.
//
// What this exists for: useColumnSort + the clickable <button> headers were
// added in Track A (2026-05-25) and own the leaderboard's interactive sort
// state. Unit tests in __tests__/hooks-use-column-sort.test.ts cover the pure
// hook, but the browser seam (header button → toggle → re-render → row order
// + aria-sort + ↑↓— glyph) only manifests against real React + DOM. This spec
// is the regression net for that seam.
//
// Seed strategy: intercept GET /api/burnindex with page.route() and return a
// synthetic ImportedEntry[]. The real route requires a Bearer token from
// /api/internal/issue-collector-token (HMAC + Redis nonce) and a populated
// store — neither available in the Playwright env (BURN_STORE=memory starts
// empty per playwright.config.ts L84). LandingApp.tsx mount-time useEffect
// fetches /api/burnindex and feeds entries → BurnIndexSection's `imported`
// prop, so a single GET interception fully seeds the table.
//
// Three rows are calibrated so EVERY sort produces a different visible order:
//   @alice  totalTokens=300  cost=$3.00  trendPct=+15  toolsUsed=[claude]
//   @bob    totalTokens=100  cost=$1.00  trendPct=null toolsUsed=[codex]
//   @carol  totalTokens=200  cost=$2.00  trendPct=-5   toolsUsed=[both]
//
// This catches: stuck-direction bugs, nullish-to-bottom regression in the
// trendPct comparator, and the "new column resets to type-appropriate
// default" branch in useColumnSort.toggle (handle→asc, numeric→desc).
//
// SECURITY: no real store touched, no token issued. The route stub is the
// security boundary — even if dev .env.local leaks, no write path is exercised.

import { test, expect, type Page } from "@playwright/test";
import type { ImportedEntry } from "@/lib/data";

const SEED: ImportedEntry[] = [
  {
    handle: "@alice",
    avatar: "AL",
    verif: "Device-synced",
    totalTokens: 300_000,
    estimatedCostUsd: 3.0,
    period: "week",
    since: "2026-05-18T00:00:00Z",
    until: "2026-05-25T00:00:00Z",
    importedAt: "2026-05-25T10:00:00Z",
    toolsUsed: ["claude-code"],
    trendDir: "up",
    trendPct: 15,
  },
  {
    handle: "@bob",
    avatar: "BO",
    verif: "Device-synced",
    totalTokens: 100_000,
    estimatedCostUsd: 1.0,
    period: "week",
    since: "2026-05-18T00:00:00Z",
    until: "2026-05-25T00:00:00Z",
    importedAt: "2026-05-25T11:00:00Z",
    toolsUsed: ["codex"],
    // trendDir/trendPct intentionally absent — exercises nullish-to-bottom.
  },
  {
    handle: "@carol",
    avatar: "CA",
    verif: "Device-synced",
    totalTokens: 200_000,
    estimatedCostUsd: 2.0,
    period: "week",
    since: "2026-05-18T00:00:00Z",
    until: "2026-05-25T00:00:00Z",
    importedAt: "2026-05-25T12:00:00Z",
    toolsUsed: ["claude-code", "codex"],
    trendDir: "down",
    trendPct: -5,
  },
];

// Install GET-only stub. POST passes through so any modal-driven submit during
// the test would still hit the real (memory) store — but we never submit, so
// the route falls back to GET interception only.
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

// Read the visible handles in row order. lb-row + lb-handle are stable
// classnames owned by BurnIndexSection (L169/L175) — if these get renamed the
// inline tier chip refactor will surface a build error in BurnIndexSection
// itself, not a silent test miss.
async function visibleHandles(page: Page): Promise<string[]> {
  return await page.locator(".lb-row .lb-handle").allTextContents();
}

// Header button locator — aria-label is `Sort by ${col.label}`. Click target.
function sortButton(page: Page, label: "Builder" | "Tokens" | "Cost" | "Trend") {
  return page.getByRole("button", { name: `Sort by ${label}` });
}

// WAI-ARIA: `aria-sort` is valid only on a `columnheader`/`rowheader`, not on
// a bare <button>. BurnIndexSection wraps each sort button in a
// `<div role="columnheader">` and hangs aria-sort on the wrapper — assert via
// the columnheader, not the button. Locator is parent of sortButton.
function sortHeader(page: Page, label: "Builder" | "Tokens" | "Cost" | "Trend") {
  return page
    .locator('[role="columnheader"]')
    .filter({ has: sortButton(page, label) });
}

test.describe("BurnIndex leaderboard column sort", () => {
  test.beforeEach(async ({ page }) => {
    await seedLeaderboard(page);
    await page.goto("/#burn");
    // Wait for the seeded rows to render — LandingApp.useEffect resolves after
    // mount, and BurnIndexSection re-renders with `imported.length === 3`.
    await expect(page.locator(".lb-row")).toHaveCount(3);
  });

  test("default order is totalTokens desc", async ({ page }) => {
    expect(await visibleHandles(page)).toEqual(["@alice", "@carol", "@bob"]);
    await expect(sortHeader(page, "Tokens")).toHaveAttribute("aria-sort", "descending");
    // The other three columns report aria-sort="none" until clicked.
    await expect(sortHeader(page, "Builder")).toHaveAttribute("aria-sort", "none");
    await expect(sortHeader(page, "Cost")).toHaveAttribute("aria-sort", "none");
    await expect(sortHeader(page, "Trend")).toHaveAttribute("aria-sort", "none");
  });

  test("clicking Builder sorts handle asc, click again flips to desc", async ({ page }) => {
    await sortButton(page, "Builder").click();
    expect(await visibleHandles(page)).toEqual(["@alice", "@bob", "@carol"]);
    await expect(sortHeader(page, "Builder")).toHaveAttribute("aria-sort", "ascending");
    // Previously-active column drops back to "none" — only one column owns
    // the sort state at a time.
    await expect(sortHeader(page, "Tokens")).toHaveAttribute("aria-sort", "none");

    await sortButton(page, "Builder").click();
    expect(await visibleHandles(page)).toEqual(["@carol", "@bob", "@alice"]);
    await expect(sortHeader(page, "Builder")).toHaveAttribute("aria-sort", "descending");
  });

  test("switching to Cost resets dir to numeric default (desc)", async ({ page }) => {
    // Start by clicking Builder twice — sort key + direction now sit at
    // (handle, desc). Switching to Cost must reset to desc (the type-default
    // for numeric columns), not inherit "desc" by accident from prior state.
    await sortButton(page, "Builder").click();
    await sortButton(page, "Builder").click();
    await expect(sortHeader(page, "Builder")).toHaveAttribute("aria-sort", "descending");

    await sortButton(page, "Cost").click();
    expect(await visibleHandles(page)).toEqual(["@alice", "@carol", "@bob"]);
    await expect(sortHeader(page, "Cost")).toHaveAttribute("aria-sort", "descending");
    await expect(sortHeader(page, "Builder")).toHaveAttribute("aria-sort", "none");
  });

  test("switching to Builder from a numeric column resets dir to handle default (asc)", async ({
    page,
  }) => {
    // Default is (totalTokens, desc). Click Builder once — must land on asc
    // (handle's type-default), not inherit "desc" from the prior column.
    await sortButton(page, "Builder").click();
    expect(await visibleHandles(page)).toEqual(["@alice", "@bob", "@carol"]);
    await expect(sortHeader(page, "Builder")).toHaveAttribute("aria-sort", "ascending");
  });

  test("Trend desc puts the nullish-trend row at the bottom", async ({ page }) => {
    await sortButton(page, "Trend").click();
    // alice +15, carol -5, bob null. Numeric desc: 15 > -5, null sinks.
    expect(await visibleHandles(page)).toEqual(["@alice", "@carol", "@bob"]);
    await expect(sortHeader(page, "Trend")).toHaveAttribute("aria-sort", "descending");

    // Flip to asc — null still sinks (this is the regression we care about:
    // a naive comparator would float null to the top under asc).
    await sortButton(page, "Trend").click();
    expect(await visibleHandles(page)).toEqual(["@carol", "@alice", "@bob"]);
    await expect(sortHeader(page, "Trend")).toHaveAttribute("aria-sort", "ascending");
  });

  test("Tokens header click pattern: same-key flips, fresh column resets", async ({ page }) => {
    // Tokens is the initial sort (desc) — clicking it flips to asc.
    await sortButton(page, "Tokens").click();
    expect(await visibleHandles(page)).toEqual(["@bob", "@carol", "@alice"]);
    await expect(sortHeader(page, "Tokens")).toHaveAttribute("aria-sort", "ascending");

    // Click Tokens again — flips back to desc.
    await sortButton(page, "Tokens").click();
    expect(await visibleHandles(page)).toEqual(["@alice", "@carol", "@bob"]);
    await expect(sortHeader(page, "Tokens")).toHaveAttribute("aria-sort", "descending");
  });
});
