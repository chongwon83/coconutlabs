// e2e/topic3-comms.spec.ts — Topic 3 (comms) browser regression net.
//
// Covers the two comms channels this cycle adds, which unit tests (node-env,
// no DOM) cannot reach:
//   • INBOUND  — the footer "Contact" mailto link.
//   • OUTBOUND — the optional, consent-gated email opt-in shown as step 2 of
//                PostUploadSurvey after a successful FSA upload.
//
// The FSA happy-path setup (stubbed showDirectoryPicker + IDB patch + token/
// burnindex stubs) is copied from burn-import-fsa-picker.spec.ts — the only
// path that renders PostUploadSurvey (autoDetect && showSurvey). /api/emails is
// stubbed (playwright.config.ts omits Redis + COLLECTOR_HMAC_SECRET as a
// security boundary, so the real endpoint would 503); the stub captures the
// request body so we assert the FRONTEND sends {email, handle, consent:true}.
// The real token→validate→store backend is covered by
// __tests__/email-route-token-integration.test.ts.

import { test, expect, type Page } from "@playwright/test";

// Temporary owner-chosen contact address (lib/data.ts CONTACT_EMAIL). Hardcoded
// here so this test documents the published address and trips if it silently
// changes before the planned coconutlabs.xyz alias swap.
const CONTACT_EMAIL = "chongwon5026@gmail.com";

// One assistant row inside [2026-05-11, 2026-05-18) (clock pinned below).
const FIXTURE_JSONL = JSON.stringify({
  type: "assistant",
  timestamp: "2026-05-15T10:00:00Z",
  message: {
    model: "claude-sonnet-4-5",
    usage: {
      input_tokens: 1200,
      output_tokens: 340,
      cache_read_input_tokens: 80,
      cache_creation: {
        ephemeral_5m_input_tokens: 12,
        ephemeral_1h_input_tokens: 4,
      },
    },
  },
});

// ── FSA stub helpers (copied from burn-import-fsa-picker.spec.ts) ─────────────

function injectFakeHandlesIDB() {
  return () => {
    const HANDLES_DB = "coconutlabs.handles";
    const _realOpen = IDBFactory.prototype.open;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const _map: Record<string, any> = {};
    IDBFactory.prototype.open = function (name, version) {
      if (name !== HANDLES_DB) return _realOpen.call(this, name, version);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fakeReq: any = {
        result: null, error: null, readyState: "pending",
        onsuccess: null, onerror: null, onupgradeneeded: null,
      };
      const fakeDb = {
        transaction() {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const tx: any = { oncomplete: null, onerror: null };
          tx.objectStore = () => ({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            put(value: any, key: string) {
              _map[key] = value;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const r: any = { result: undefined, error: null, onsuccess: null, onerror: null };
              setTimeout(() => r.onsuccess && r.onsuccess({ target: r }), 0);
              return r;
            },
            get(key: string) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const r: any = {
                result: _map[key] !== undefined ? _map[key] : undefined,
                error: null, onsuccess: null, onerror: null,
              };
              setTimeout(() => r.onsuccess && r.onsuccess({ target: r }), 0);
              return r;
            },
          });
          return tx;
        },
        close() {},
        objectStoreNames: { contains: () => true },
        createObjectStore() {},
      };
      fakeReq.result = fakeDb;
      setTimeout(() => {
        fakeReq.readyState = "done";
        if (fakeReq.onsuccess) fakeReq.onsuccess({ target: fakeReq });
      }, 0);
      return fakeReq;
    };
  };
}

function injectHappyPathPicker() {
  return async ({ jsonl: content }: { jsonl: string }) => {
    const fakeFileHandle = {
      name: "session-2026-05-15.jsonl",
      kind: "file",
      getFile: async () =>
        new File([content], "session-2026-05-15.jsonl", { type: "text/plain" }),
    };
    const fakeProjAHandle = {
      name: "proj-a", kind: "directory",
      queryPermission: async () => "granted",
      requestPermission: async () => "granted",
      entries: async function* () { yield ["session-2026-05-15.jsonl", fakeFileHandle]; },
    };
    const fakeProjectsHandle = {
      name: "projects", kind: "directory",
      queryPermission: async () => "granted",
      requestPermission: async () => "granted",
      entries: async function* () { yield ["proj-a", fakeProjAHandle]; },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).showDirectoryPicker = async () => fakeProjectsHandle;
  };
}

// Stub token + burnindex + telemetry so the FSA upload reaches success without
// Redis. Returns a ref whose .body captures the /api/emails POST payload.
async function stubCommsRoutes(page: Page): Promise<{ emailPosts: number; lastBody: unknown }> {
  const captured = { emailPosts: 0, lastBody: null as unknown };

  await page.route("**/api/internal/issue-collector-token", async (route) => {
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ token: "test-token-for-e2e" }),
    });
  });
  await page.route("**/api/burnindex", async (route) => {
    if (route.request().method() !== "POST") { await route.continue(); return; }
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ entries: [] }),
    });
  });
  await page.route("**/api/telemetry/auto-detect", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await page.route("**/api/emails", async (route) => {
    captured.emailPosts++;
    captured.lastBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });

  return captured;
}

// Drive the FSA happy path through upload success (survey now visible).
async function uploadViaFsa(page: Page, handle: string): Promise<void> {
  await page.addInitScript(injectFakeHandlesIDB());
  await page.addInitScript(injectHappyPathPicker(), { jsonl: FIXTURE_JSONL });
  await page.goto("/?auto-detect=1");

  await expect(page.locator(".modal-overlay")).toBeVisible({ timeout: 2_000 });
  await page.getByRole("button", { name: "Select .claude/projects folder" }).click();
  await expect(page.getByRole("button", { name: /✓ projects/ })).toBeVisible({ timeout: 5_000 });
  await page.getByRole("button", { name: "Scan & preview" }).click();
  await expect(page.getByRole("button", { name: "Upload to leaderboard" })).toBeVisible({ timeout: 15_000 });
  await page.getByLabel(/GitHub \/ X handle/).fill(handle);

  const posted = page.waitForResponse(
    (res) => res.url().includes("/api/burnindex") && res.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Upload to leaderboard" }).click();
  await posted;
}

// ── Inbound: footer contact ───────────────────────────────────────────────────

test.describe("Topic 3 — inbound contact", () => {
  test("footer Contact is a mailto link to the contact address", async ({ page }) => {
    await page.goto("/");
    const contact = page.locator("footer a.footer-link", { hasText: "Contact" });
    await expect(contact).toBeVisible();
    await expect(contact).toHaveAttribute("href", `mailto:${CONTACT_EMAIL}`);
  });
});

// ── Outbound: post-upload email opt-in ────────────────────────────────────────

test.describe("Topic 3 — post-upload email opt-in", () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date("2026-05-21T00:00:00Z") });
  });

  test("survey → opt-in: gated submit fires POST /api/emails with consent", async ({ page }) => {
    const captured = await stubCommsRoutes(page);
    await uploadViaFsa(page, "@testhandle");

    // Step 1: survey is shown (alongside the success card).
    await expect(page.getByText("You're on the Leaderboard!")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Which step was hardest?")).toBeVisible();
    await page.getByRole("button", { name: "Understanding what the numbers mean" }).click();
    await page.getByRole("button", { name: "Submit" }).click();

    // Step 2: optional email opt-in.
    await expect(page.getByText("Stay in the loop (optional)")).toBeVisible();
    const notify = page.getByRole("button", { name: "Notify me" });

    // Gate: disabled with no email / no consent.
    await expect(notify).toBeDisabled();
    await page.fill("#opt-in-email", "fan@example.com");
    await expect(notify).toBeDisabled(); // valid email but consent unchecked
    await page.getByRole("checkbox").check();
    await expect(notify).toBeEnabled();

    const posted = page.waitForResponse(
      (res) => res.url().includes("/api/emails") && res.request().method() === "POST",
    );
    await notify.click();
    await posted;

    expect(captured.emailPosts).toBe(1);
    expect(captured.lastBody).toEqual({
      email: "fan@example.com",
      handle: "@testhandle",
      consent: true,
    });
  });

  test("skip survey + decline email → no /api/emails POST", async ({ page }) => {
    const captured = await stubCommsRoutes(page);
    await uploadViaFsa(page, "@skiphandle");

    await expect(page.getByText("Which step was hardest?")).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "Skip" }).click();

    // Advances to the opt-in step; declining must not POST.
    await expect(page.getByText("Stay in the loop (optional)")).toBeVisible();
    await page.getByRole("button", { name: "No thanks" }).click();

    await expect(page.getByText("Stay in the loop (optional)")).toBeHidden();
    expect(captured.emailPosts).toBe(0);
  });
});
