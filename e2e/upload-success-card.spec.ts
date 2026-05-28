// e2e/upload-success-card.spec.ts — A.12 pre-merge UX hardening regression.
//
// What this exists for: handleConfirm (JoinBurnIndexForm.tsx:354) gates
// setShowSuccess(true) strictly inside the POST 2xx branch (L383-396), and a
// useEffect at L112-120 scrollIntoView + focus the card. This spec is the
// regression net for that contract on the manual (Phase 1) path:
//   • 2xx  → card MUST render with Korean copy + handle echo + #burn CTA,
//            replacing the "Add to Burn Index" button (ternary at L660-694).
//   • 5xx  → card MUST NOT render; CTA preserved; form-error visible.
//   • pending → aria-busy="true" while POST is in flight (the !res.ok early
//            return + catch ensures showSuccess never flips on the failure path,
//            and the finally block clears submitting).
//   • reduced motion → useEffect still fires; card is in viewport + focused
//            (behavior:'instant' instead of 'smooth', invariant from L114-117).
//
// Stub strategy (identical contract to onboarding-30s.spec.ts:69-99):
//   /api/internal/issue-collector-token → 200 { token } (real route needs
//       Upstash Redis + COLLECTOR_HMAC_SECRET which playwright.config.ts
//       intentionally omits as a security boundary).
//   POST /api/burnindex → 200 or 500 per branch; GET passes through to the
//       memory store (BURN_STORE=memory).

import { test, expect, type Page } from "@playwright/test";

// Minimal schemaVersion 3 envelope — 9 row fields, no extras, passes
// validateSummary (lib/validateSummary.ts). One row keeps the preview card
// render cheap. verifiedCommits omitted → entry renders "—".
const FIXTURE_ENVELOPE = JSON.stringify({
  schemaVersion: "3",
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
  grandTotal: { totalTokens: 128000, estimatedCostUsd: 9.87 },
});

async function stubToken(page: Page): Promise<void> {
  await page.route("**/api/internal/issue-collector-token", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ token: "test-token-for-e2e" }),
    });
  });
}

// POST → fulfilled with the requested status (with optional latency for the
// aria-busy branch). GET → passthrough so LandingApp's mount-time fetch still
// exercises the real handler against the memory store.
async function stubBurnPost(
  page: Page,
  opts: { status: number; delayMs?: number },
): Promise<void> {
  await page.route("**/api/burnindex", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    if (opts.delayMs) {
      await new Promise((r) => setTimeout(r, opts.delayMs));
    }
    await route.fulfill({
      status: opts.status,
      contentType: "application/json",
      body:
        opts.status >= 200 && opts.status < 300
          ? JSON.stringify({ entries: [] })
          : JSON.stringify({ error: "Simulated server failure" }),
    });
  });
}

// Walk to the Phase 2 preview card (#jbi-handle-confirm visible). Handle
// state is shared between Phase 1 (#jbi-handle) and Phase 2 — fill once.
async function openModalAndPreview(page: Page, handle: string): Promise<void> {
  await page.goto("/");
  await page.getByTestId("hero-cta-primary").click();
  await page.fill("#jbi-handle", handle);
  await page.fill("#jbi-paste", FIXTURE_ENVELOPE);
  await page.click('button[type="submit"]'); // "Validate & preview"
  await page.waitForSelector("#jbi-handle-confirm");
}

test.describe("upload success card (A.12)", () => {
  test("manual POST 200 → card visible with handle echo + #burn CTA", async ({
    page,
  }) => {
    await stubToken(page);
    await stubBurnPost(page, { status: 200 });
    const handle = "@e2e-success";
    await openModalAndPreview(page, handle);
    await page.getByRole("button", { name: "Add to Burn Index" }).click();

    const card = page.locator(".upload-success-card");
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute("role", "status");
    // aria-live MUST be "polite" (not "assertive") — A.12 invariant for
    // non-interrupting screen-reader announcement.
    await expect(card).toHaveAttribute("aria-live", "polite");
    await expect(card.locator(".upload-success-card__title")).toHaveText(
      "You're on the Leaderboard!",
    );
    await expect(card.locator(".upload-success-card__handle")).toHaveText(
      handle,
    );
    await expect(card.locator(".upload-success-card__cta")).toHaveText(
      "View Leaderboard",
    );
    // CTA click MUST set window.location.hash = "#burn" (JoinBurnIndexForm.tsx
    // L672 — the locked invariant: no other handler, no router, no onClose).
    await card.locator(".upload-success-card__cta").click();
    await expect(page).toHaveURL(/#burn$/);
  });

  test("manual POST 500 → no card, CTA preserved, error visible", async ({
    page,
  }) => {
    await stubToken(page);
    await stubBurnPost(page, { status: 500 });
    await openModalAndPreview(page, "@e2e-fail");
    await page
      .getByRole("button", { name: "Add to Burn Index" })
      .click();

    // form-error renders the JSON error body. Wait for it before asserting
    // card absence (the early-return at L383-385 sets error then bails out).
    await expect(page.locator(".form-error")).toContainText(
      "Simulated server failure",
    );
    // CTA stays in the DOM (button, not the success card).
    await expect(
      page.getByRole("button", { name: "Add to Burn Index" }),
    ).toBeVisible();
    // showSuccess never flipped → card never rendered.
    await expect(page.locator(".upload-success-card")).toHaveCount(0);
  });

  test("pending POST → aria-busy='true'; on success button replaced by card", async ({
    page,
  }) => {
    await stubToken(page);
    await stubBurnPost(page, { status: 200, delayMs: 400 });
    await openModalAndPreview(page, "@e2e-busy");
    // Name regex tolerates the mid-render swap "Add to Burn Index" → "Adding…"
    // (JoinBurnIndexForm.tsx:690 ternary on `submitting`).
    const submitBtn = page.getByRole("button", {
      name: /Add to Burn Index|Adding…/,
    });
    await submitBtn.click();
    await expect(submitBtn).toHaveAttribute("aria-busy", "true");
    // After settle, the ternary at L660 swaps the button OUT and the card IN.
    await expect(page.locator(".upload-success-card")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add to Burn Index" }),
    ).toHaveCount(0);
  });

  test("reduced motion → card scrolled into viewport + focused", async ({
    page,
  }) => {
    // emulateMedia must precede goto so the matchMedia query inside useEffect
    // (L114) resolves to `matches: true` on first paint.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await stubToken(page);
    await stubBurnPost(page, { status: 200 });
    await openModalAndPreview(page, "@e2e-rm");
    await page.getByRole("button", { name: "Add to Burn Index" }).click();

    const card = page.locator(".upload-success-card");
    await expect(card).toBeVisible();
    // scrollIntoView({ block: 'nearest' }) → card must be in viewport.
    await expect(card).toBeInViewport();
    // tabIndex=-1 + .focus() in the useEffect → activeElement.
    await expect(card).toBeFocused();
  });
});
