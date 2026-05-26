// live-badge-polling.spec.ts — Track B.2 SWR polling contract.
//
// LandingApp owns the live Burn Index fetch. Track A left BurnIndexSection as
// a pure render component and explicitly noted that the parent would inject
// entries via SWR in Track B. These tests lock that browser seam:
//   1. /api/burnindex is polled after the 30s refresh interval.
//   2. A failed refresh keeps the last good leaderboard rows visible.
//   3. /api/burnindex/stats drives the Hero stat bar with the same cadence.
//
// SECURITY: GET-only route stubs. No collector token is issued, no POST path is
// exercised, and no real BurnStore state is touched.

import { test, expect, type Page } from "@playwright/test";
import type { ImportedEntry } from "@/lib/data";

const INITIAL_ENTRY: ImportedEntry = {
  handle: "@initial",
  avatar: "IN",
  verif: "Device-synced",
  totalTokens: 100_000,
  estimatedCostUsd: 1.25,
  period: "week",
  since: "2026-05-18T00:00:00Z",
  until: "2026-05-25T00:00:00Z",
  importedAt: "2026-05-25T10:00:00Z",
  toolsUsed: ["claude-code"],
};

const POLLED_ENTRY: ImportedEntry = {
  ...INITIAL_ENTRY,
  handle: "@polled",
  avatar: "PO",
  totalTokens: 900_000,
  estimatedCostUsd: 9.75,
  importedAt: "2026-05-25T10:30:00Z",
  toolsUsed: ["codex"],
};

interface StatsPayload {
  builderCount: number;
  totalTokens: number;
  totalCost: number;
}

const INITIAL_STATS: StatsPayload = {
  builderCount: 2,
  totalTokens: 2_400_000,
  totalCost: 4_820,
};

const POLLED_STATS: StatsPayload = {
  builderCount: 3,
  totalTokens: 980_000,
  totalCost: 12,
};

async function installLeaderboardStub(
  page: Page,
  nextPayload: () => { status: number; entries?: ImportedEntry[] },
): Promise<{ count: () => number }> {
  let requests = 0;
  await page.route("**/api/burnindex", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    requests += 1;
    const payload = nextPayload();
    await route.fulfill({
      status: payload.status,
      contentType: "application/json",
      body: JSON.stringify({ entries: payload.entries ?? [] }),
    });
  });
  return { count: () => requests };
}

async function installStatsStub(
  page: Page,
  nextPayload: () => { status: number; stats?: StatsPayload },
): Promise<{ count: () => number }> {
  let requests = 0;
  await page.route("**/api/burnindex/stats", async (route) => {
    requests += 1;
    const payload = nextPayload();
    await route.fulfill({
      status: payload.status,
      contentType: "application/json",
      body: JSON.stringify(payload.stats ?? {}),
    });
  });
  return { count: () => requests };
}

async function visibleHandles(page: Page): Promise<string[]> {
  return await page.locator(".lb-row .lb-handle").allTextContents();
}

test.describe("Burn Index live polling", () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date("2026-05-26T00:00:00Z") });
  });

  test("polls /api/burnindex every 30s and adopts the fresh rows", async ({ page }) => {
    let servePolled = false;
    const stub = await installLeaderboardStub(page, () => ({
      status: 200,
      entries: servePolled ? [POLLED_ENTRY] : [INITIAL_ENTRY],
    }));

    await page.goto("/#burn");
    await expect(page.locator(".lb-row")).toHaveCount(1);
    expect(await visibleHandles(page)).toEqual(["@initial"]);

    const initialRequestCount = stub.count();
    servePolled = true;
    await page.clock.runFor(30_000);

    await expect.poll(() => stub.count(), { timeout: 5_000 }).toBeGreaterThan(
      initialRequestCount,
    );
    await expect(page.locator(".lb-row .lb-handle")).toHaveText(["@polled"]);
  });

  test("keeps the previous rows visible when a refresh fails", async ({ page }) => {
    let failRefresh = false;
    const stub = await installLeaderboardStub(page, () => (
      failRefresh
        ? { status: 500 }
        : { status: 200, entries: [INITIAL_ENTRY] }
    ));

    await page.goto("/#burn");
    await expect(page.locator(".lb-row")).toHaveCount(1);
    expect(await visibleHandles(page)).toEqual(["@initial"]);

    const initialRequestCount = stub.count();
    failRefresh = true;
    await page.clock.runFor(30_000);

    await expect.poll(() => stub.count(), { timeout: 5_000 }).toBeGreaterThan(
      initialRequestCount,
    );
    expect(await visibleHandles(page)).toEqual(["@initial"]);
    await expect(page.locator(".lb-empty")).toHaveCount(0);
  });

  test("renders and polls the Hero stat bar from /api/burnindex/stats", async ({
    page,
  }) => {
    await installLeaderboardStub(page, () => ({
      status: 200,
      entries: [INITIAL_ENTRY],
    }));
    let servePolled = false;
    const stub = await installStatsStub(page, () => ({
      status: 200,
      stats: servePolled ? POLLED_STATS : INITIAL_STATS,
    }));

    await page.goto("/");
    await expect(page.getByTestId("hero-stat-builders")).toHaveText("2 builders");
    await expect(page.getByTestId("hero-stat-tokens")).toHaveText("2.4M tokens");
    await expect(page.getByTestId("hero-stat-spend")).toHaveText("$4,820 spent");

    const initialRequestCount = stub.count();
    servePolled = true;
    await page.clock.runFor(30_000);

    await expect.poll(() => stub.count(), { timeout: 5_000 }).toBeGreaterThan(
      initialRequestCount,
    );
    await expect(page.getByTestId("hero-stat-builders")).toHaveText("3 builders");
    await expect(page.getByTestId("hero-stat-tokens")).toHaveText("980K tokens");
    await expect(page.getByTestId("hero-stat-spend")).toHaveText("$12 spent");
  });

  test("keeps the previous Hero stats visible when a stats refresh fails", async ({
    page,
  }) => {
    await installLeaderboardStub(page, () => ({
      status: 200,
      entries: [INITIAL_ENTRY],
    }));
    let failRefresh = false;
    const stub = await installStatsStub(page, () => (
      failRefresh
        ? { status: 500 }
        : { status: 200, stats: INITIAL_STATS }
    ));

    await page.goto("/");
    await expect(page.getByTestId("hero-stat-builders")).toHaveText("2 builders");
    await expect(page.getByTestId("hero-stat-tokens")).toHaveText("2.4M tokens");
    await expect(page.getByTestId("hero-stat-spend")).toHaveText("$4,820 spent");

    const initialRequestCount = stub.count();
    failRefresh = true;
    await page.clock.runFor(30_000);

    await expect.poll(() => stub.count(), { timeout: 5_000 }).toBeGreaterThan(
      initialRequestCount,
    );
    await expect(page.getByTestId("hero-stat-builders")).toHaveText("2 builders");
    await expect(page.getByTestId("hero-stat-tokens")).toHaveText("2.4M tokens");
    await expect(page.getByTestId("hero-stat-spend")).toHaveText("$4,820 spent");
  });
});
