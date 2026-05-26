// e2e/upload-success-card-banner.spec.ts — B.4 MAJOR #1 banner survival.
//
// Companion to upload-success-card.spec.ts. That spec locks the in-modal
// `.upload-success-card` contract (A.12). This spec locks the additive
// page-level `.upload-success-banner` lifted into LandingApp by B.4:
//
//   • On POST 200, the in-modal card still renders (A.12 untouched) AND
//     `lastSuccess` is set at the page level.
//   • Closing the modal unmounts the card BUT the banner mounts because
//     the gate is `modal === null && lastSuccess !== null`.
//   • Banner CTA navigates to `#burn` and dismisses the banner.
//   • Banner close `×` dismisses without navigation.
//   • Banner has role="status", aria-live="polite", and takes focus on
//     mount (tabIndex={-1} + ref.current.focus()).
//   • POST 500 → neither surface mounts (success state never armed).
//
// Stub strategy mirrors upload-success-card.spec.ts (same handler shape).
//
// ---
// Codex cross-review 2026-05-26 — deferred items (documented, not regressions):
//
//   • FSA upload path coverage: JoinBurnIndexForm.tsx L287 (FSA) and L389
//     (manual) both call `onImport(data.entries, trimmed)`. The manual path
//     here is the canonical test of that contract; FSA path mocking requires
//     `showDirectoryPicker` shims that Playwright does not expose natively.
//     Risk mitigated by: shared handler on the LandingApp side + identical
//     payload shape. Track in B.5+ if FSA-specific regressions appear.
//
//   • Stale `lastSuccess` re-show on modal re-open-then-close: if the user
//     dismisses the modal without uploading again, the banner reappears.
//     Accepted as intentional — see docs/a11y/upload-stack-review-2026-05-26.md
//     §4 Risk 2 "Banner persists across navigation" (same root cause).

import { test, expect, type Page } from "@playwright/test";

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

async function stubBurnPost(
  page: Page,
  opts: { status: number },
): Promise<void> {
  await page.route("**/api/burnindex", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
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

async function openModalAndUpload(page: Page, handle: string): Promise<void> {
  await page.goto("/");
  await page.getByTestId("hero-cta-primary").click();
  await page.fill("#jbi-handle", handle);
  await page.fill("#jbi-paste", FIXTURE_ENVELOPE);
  await page.click('button[type="submit"]'); // "Validate & preview"
  await page.waitForSelector("#jbi-handle-confirm");
  await page.getByRole("button", { name: "Add to Burn Index" }).click();
  // Card must mount before we close the modal — confirms the in-modal A.12
  // path is still firing and lastSuccess is armed via handleImport.
  await expect(page.locator(".upload-success-card")).toBeVisible();
}

async function closeModal(page: Page): Promise<void> {
  // .modal-close is the page-level modal `×` rendered by LandingApp, not the
  // in-modal card close. Clicking it sets modal=null and unmounts the form.
  await page.locator(".modal-close").click();
  // Wait for modal overlay to detach so the gate `modal === null` becomes
  // true and the banner has a chance to mount.
  await expect(page.locator(".modal-overlay")).toHaveCount(0);
}

test.describe("upload success card → banner lift-up (B.4 MAJOR #1)", () => {
  test("POST 200 → close modal → banner mounts with handle echo + #burn CTA", async ({
    page,
  }) => {
    await stubToken(page);
    await stubBurnPost(page, { status: 200 });
    const handle = "@e2e-banner";
    await openModalAndUpload(page, handle);
    await closeModal(page);

    // Codex gap #3 fix: in-modal card must unmount when modal closes
    // (no duplicate / no moved card leaking outside the modal tree).
    await expect(page.locator(".upload-success-card")).toHaveCount(0);

    const banner = page.getByTestId("upload-success-banner");
    await expect(banner).toBeVisible();
    await expect(banner).toHaveAttribute("role", "status");
    await expect(banner).toHaveAttribute("aria-live", "polite");
    await expect(
      banner.locator(".upload-success-banner__title"),
    ).toHaveText("리더보드에 추가되었어요");
    await expect(
      banner.locator(".upload-success-banner__handle"),
    ).toHaveText("@e2e-banner");
    await expect(
      banner.locator(".upload-success-banner__cta"),
    ).toHaveText("리더보드 보기");
  });

  test("banner CTA → window.location.hash = '#burn' AND banner dismisses", async ({
    page,
  }) => {
    await stubToken(page);
    await stubBurnPost(page, { status: 200 });
    await openModalAndUpload(page, "@e2e-cta");
    await closeModal(page);

    const banner = page.getByTestId("upload-success-banner");
    await expect(banner).toBeVisible();
    await banner.locator(".upload-success-banner__cta").click();
    await expect(page).toHaveURL(/#burn$/);
    await expect(banner).toHaveCount(0);
  });

  test("banner × close → no navigation, banner dismisses", async ({ page }) => {
    await stubToken(page);
    await stubBurnPost(page, { status: 200 });
    await openModalAndUpload(page, "@e2e-close");
    await closeModal(page);

    const banner = page.getByTestId("upload-success-banner");
    await expect(banner).toBeVisible();
    const urlBefore = page.url();
    await banner.locator(".upload-success-banner__close").click();
    await expect(banner).toHaveCount(0);
    // No navigation occurred — only `setLastSuccess(null)` should fire.
    expect(page.url()).toBe(urlBefore);
  });

  test("banner is focused on mount + visible in viewport (reduced motion safe)", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    // Codex gap #2 fix: install a scrollIntoView spy BEFORE navigation so we
    // can prove the banner uses `behavior: "instant"` under reduced motion.
    // Without this, an implementation that always smooth-scrolls would still
    // pass `toBeFocused`/`toBeInViewport` and slip past the a11y contract.
    await page.addInitScript(() => {
      const calls: Array<{ behavior?: string; block?: string }> = [];
      (window as unknown as { __scrollIntoViewCalls: typeof calls }).__scrollIntoViewCalls = calls;
      const original = Element.prototype.scrollIntoView;
      Element.prototype.scrollIntoView = function (
        arg?: boolean | ScrollIntoViewOptions,
      ): void {
        if (arg && typeof arg === "object") {
          calls.push({ behavior: arg.behavior, block: arg.block });
        } else {
          calls.push({ behavior: arg === true ? "smooth" : "auto" });
        }
        return original.apply(this, [arg] as Parameters<typeof original>);
      };
    });
    await stubToken(page);
    await stubBurnPost(page, { status: 200 });
    await openModalAndUpload(page, "@e2e-focus");
    await closeModal(page);

    const banner = page.getByTestId("upload-success-banner");
    await expect(banner).toBeVisible();
    await expect(banner).toBeInViewport();
    // tabIndex={-1} + ref.current.focus() in UploadSuccessBanner useEffect.
    await expect(banner).toBeFocused();

    // Reduced-motion contract: UploadSuccessBanner.tsx:25 selects
    // behavior:"instant" when prefers-reduced-motion is set. At least one
    // banner-scope scrollIntoView call must use "instant".
    const calls = await page.evaluate(
      () =>
        (window as unknown as {
          __scrollIntoViewCalls: Array<{ behavior?: string }>;
        }).__scrollIntoViewCalls,
    );
    expect(calls.some((c) => c.behavior === "instant")).toBe(true);
    expect(calls.some((c) => c.behavior === "smooth")).toBe(false);
  });

  test("POST 500 → no card, no banner (success state never armed)", async ({
    page,
  }) => {
    await stubToken(page);
    await stubBurnPost(page, { status: 500 });
    await page.goto("/");
    await page.getByTestId("hero-cta-primary").click();
    await page.fill("#jbi-handle", "@e2e-fail");
    await page.fill("#jbi-paste", FIXTURE_ENVELOPE);
    await page.click('button[type="submit"]');
    await page.waitForSelector("#jbi-handle-confirm");
    await page.getByRole("button", { name: "Add to Burn Index" }).click();

    // Failure path: no in-modal card.
    await expect(page.locator(".form-error")).toContainText(
      "Simulated server failure",
    );
    await expect(page.locator(".upload-success-card")).toHaveCount(0);

    // Close modal — handleImport never ran, so lastSuccess stays null and the
    // banner gate stays false.
    await page.locator(".modal-close").click();
    await expect(page.locator(".modal-overlay")).toHaveCount(0);
    await expect(page.getByTestId("upload-success-banner")).toHaveCount(0);
  });

  test("in-modal card and banner are mutually exclusive (modal open → no banner)", async ({
    page,
  }) => {
    await stubToken(page);
    await stubBurnPost(page, { status: 200 });
    await openModalAndUpload(page, "@e2e-exclusive");

    // Card is visible (modal still open).
    await expect(page.locator(".upload-success-card")).toBeVisible();
    // Gate `modal === null && lastSuccess` cannot be true → banner stays out.
    await expect(page.getByTestId("upload-success-banner")).toHaveCount(0);
  });
});
