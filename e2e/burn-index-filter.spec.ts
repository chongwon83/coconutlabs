// e2e/burn-index-filter.spec.ts — PR Track A.5 tool-filter contract.
//
// What this exists for: the 3-tab filter (All / Claude Code / Codex) at
// BurnIndexSection.tsx L129-141 groups rows by toolsUsed.includes(filter).
// Owner intent (locked in plan Open Question Q1): entries that used BOTH
// tools surface under EACH single-tool filter — "claude+codex 경쟁 = 통합
// 경쟁". This spec is the regression net for that semantics; a naive XOR
// implementation would silently drop @carol from both single-tool tabs.
//
// Seed mirrors burn-index-sort.spec.ts so a future test author has one
// mental model for "the 3-row leaderboard". Default sort is VES desc; ves
// values are chosen so the visible order equals the old totalTokens-desc order,
// keeping these filter assertions stable:
//   @alice  toolsUsed=[claude-code]            (ves 200 — top under All + Claude Code)
//   @bob    toolsUsed=[codex]                  (ves null — bottom under All + Codex)
//   @carol  toolsUsed=[claude-code, codex]     (ves 150 — appears under BOTH single filters)
//
// Empty-state branch: a second seed (only claude-code rows) → clicking Codex
// triggers the "No results in this tab" copy — distinct from
// the truly-empty-store copy ("No data yet. Join Burn Index …"). Both branches
// matter because the second one would regress to the first if someone
// short-circuits `imported.length === 0` upstream.
//
// Legacy fallback branch: @legacy is a pre-B-cycle entry with breakdown:[].
// It has toolsUsed:["claude-code"] so the render fallback must show its
// tokens+cost on the Claude Code tab (not "—"). This seed guards the
// sliceForFilter legacy path added 2026-05-27.
//
// SECURITY: GET stub only (POST passes through). No real store, no token,
// no Redis. Identical risk envelope to burn-index-sort.spec.ts.

import { test, expect, type Page } from "@playwright/test";
import type { ImportedEntry } from "@/lib/data";

const SEED: ImportedEntry[] = [
  {
    handle: "@alice",
    avatar: "AL",
    verif: "Device-synced",
    totalTokens: 300_000,
    estimatedCostUsd: 3.0,
    ves: 200,
    period: "week",
    since: "2026-05-18T00:00:00Z",
    until: "2026-05-25T00:00:00Z",
    importedAt: "2026-05-25T10:00:00Z",
    toolsUsed: ["claude-code"],
    breakdown: [],
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
    breakdown: [],
  },
  {
    handle: "@carol",
    avatar: "CA",
    verif: "Device-synced",
    totalTokens: 200_000,
    estimatedCostUsd: 2.0,
    ves: 150,
    period: "week",
    since: "2026-05-18T00:00:00Z",
    until: "2026-05-25T00:00:00Z",
    importedAt: "2026-05-25T12:00:00Z",
    toolsUsed: ["claude-code", "codex"],
    breakdown: [],
    trendDir: "down",
    trendPct: -5,
  },
];

// Single-tool seed for the empty-state branch. Two claude-code rows, no
// codex anywhere — Codex tab MUST render the "No results in this tab" copy,
// not the "No data yet. Join Burn Index …" copy (which is store-empty only).
const CLAUDE_ONLY_SEED: ImportedEntry[] = [
  { ...SEED[0] }, // @alice, claude-code only
  {
    ...SEED[2],
    handle: "@dave",
    avatar: "DA",
    toolsUsed: ["claude-code"], // strip codex from carol's shape
  },
];

// Legacy seed: pre-B-cycle entry with breakdown:[] and toolsUsed:["claude-code"].
// The render fallback in sliceForFilter must return the aggregate (not NaN)
// on the Claude Code tab so tokens and cost are visible rather than "—".
const LEGACY_SEED: ImportedEntry[] = [
  {
    handle: "@legacy",
    avatar: "LG",
    verif: "Device-synced",
    totalTokens: 150_000,
    estimatedCostUsd: 1.5,
    period: "week",
    since: "2026-05-11T00:00:00Z",
    until: "2026-05-18T00:00:00Z",
    importedAt: "2026-05-18T09:00:00Z",
    toolsUsed: ["claude-code"],
    breakdown: [], // pre-B-cycle — no per-model data
  },
  {
    ...SEED[0], // @alice alongside for ordering reference
    breakdown: [{ tool: "claude-code", model: "claude-sonnet-4-6", totalTokens: 300_000, estimatedCostUsd: 3.0 }],
  },
];

async function seedLeaderboard(
  page: Page,
  entries: ImportedEntry[] = SEED,
): Promise<void> {
  await page.route("**/api/burnindex", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ entries }),
    });
  });
}

async function visibleHandles(page: Page): Promise<string[]> {
  return await page.locator(".lb-row .lb-handle").allTextContents();
}

// Filter buttons are inside the role="group" aria-label="Tool filter" wrapper
// at L129. getByRole("button", { name }) matches the visible text since
// these buttons have no separate aria-label — the label IS the text node.
function filterButton(page: Page, label: "All" | "Claude Code" | "Codex") {
  return page.getByRole("button", { name: label, exact: true });
}

test.describe("BurnIndex leaderboard tool filter", () => {
  test("default = All shows all three rows", async ({ page }) => {
    await seedLeaderboard(page);
    await page.goto("/#burn");
    await expect(page.locator(".lb-row")).toHaveCount(3);

    // Default sort kicks in (VES desc) so order is calibrated.
    expect(await visibleHandles(page)).toEqual(["@alice", "@carol", "@bob"]);
    await expect(filterButton(page, "All")).toHaveAttribute("aria-pressed", "true");
    await expect(filterButton(page, "Claude Code")).toHaveAttribute("aria-pressed", "false");
    await expect(filterButton(page, "Codex")).toHaveAttribute("aria-pressed", "false");
  });

  test("Claude Code filter shows alice + carol (2 rows, VES desc)", async ({ page }) => {
    await seedLeaderboard(page);
    await page.goto("/#burn");
    await expect(page.locator(".lb-row")).toHaveCount(3);

    await filterButton(page, "Claude Code").click();
    await expect(page.locator(".lb-row")).toHaveCount(2);
    // Carol shows up under Claude Code despite also using codex — the
    // owner's "통합 경쟁" intent is the whole point of this test.
    expect(await visibleHandles(page)).toEqual(["@alice", "@carol"]);
    await expect(filterButton(page, "Claude Code")).toHaveAttribute("aria-pressed", "true");
    await expect(filterButton(page, "All")).toHaveAttribute("aria-pressed", "false");
  });

  test("Codex filter shows carol + bob (2 rows, VES desc)", async ({ page }) => {
    await seedLeaderboard(page);
    await page.goto("/#burn");
    await expect(page.locator(".lb-row")).toHaveCount(3);

    await filterButton(page, "Codex").click();
    await expect(page.locator(".lb-row")).toHaveCount(2);
    // Carol again — symmetric proof of the "appears in both" contract.
    expect(await visibleHandles(page)).toEqual(["@carol", "@bob"]);
    await expect(filterButton(page, "Codex")).toHaveAttribute("aria-pressed", "true");
  });

  test("toggling back to All restores all three rows", async ({ page }) => {
    await seedLeaderboard(page);
    await page.goto("/#burn");
    await expect(page.locator(".lb-row")).toHaveCount(3);

    await filterButton(page, "Claude Code").click();
    await expect(page.locator(".lb-row")).toHaveCount(2);

    await filterButton(page, "All").click();
    await expect(page.locator(".lb-row")).toHaveCount(3);
    expect(await visibleHandles(page)).toEqual(["@alice", "@carol", "@bob"]);
    await expect(filterButton(page, "All")).toHaveAttribute("aria-pressed", "true");
  });

  test("filter with zero matches renders the per-tool empty copy (not the store-empty copy)", async ({
    page,
  }) => {
    // Two claude-code rows in the store; clicking Codex yields 0 matches.
    // The empty-state branch we care about is `imported.length > 0 &&
    // sorted.length === 0` — BurnIndexSection.tsx L218-221.
    await seedLeaderboard(page, CLAUDE_ONLY_SEED);
    await page.goto("/#burn");
    await expect(page.locator(".lb-row")).toHaveCount(2);

    await filterButton(page, "Codex").click();
    await expect(page.locator(".lb-row")).toHaveCount(0);

    const empty = page.locator(".lb-empty");
    await expect(empty).toBeVisible();
    await expect(empty).toContainText("No results in this tab");
    // CRITICAL: the store-empty CTA ("Join Burn Index") MUST NOT appear
    // here — that copy is reserved for `imported.length === 0`. A bug
    // collapsing these two branches would mislead users into thinking
    // their own data hasn't been submitted yet.
    await expect(empty).not.toContainText("Join Burn Index");
  });

  test("legacy entry (breakdown:[]) shows tokens+cost on Claude Code tab (render fallback)", async ({
    page,
  }) => {
    // @legacy has breakdown:[] — pre-B-cycle import. The render fallback in
    // sliceForFilter must attribute the aggregate to claude-code when
    // toolsUsed===["claude-code"], so tokens+cost are visible (not "—").
    await seedLeaderboard(page, LEGACY_SEED);
    await page.goto("/#burn");
    await filterButton(page, "Claude Code").click();

    // Both rows appear on the Claude Code tab.
    await expect(page.locator(".lb-row")).toHaveCount(2);

    // Find the @legacy row and verify its token/cost cells are not "—".
    // allTextContents() returns the text of every .lb-col-tokens in DOM order.
    // After filter+sort (VES desc), @alice (ves 200) ranks first; @legacy
    // (no ves → sinks) ranks second.
    const tokenCells = await page.locator(".lb-row .lb-col-tokens").allTextContents();
    expect(tokenCells[1]).not.toBe("—");
    const costCells = await page.locator(".lb-row .lb-col-cost").allTextContents();
    expect(costCells[1]).not.toBe("—");

    // The row must carry data-legacy="true" so QA can target it.
    const legacyRow = page.locator('.lb-row[data-legacy="true"]');
    await expect(legacyRow).toHaveCount(1);
  });
});
