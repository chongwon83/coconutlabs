// e2e: FSA picker happy path + reject + 9-field envelope negative.
//
// Clock is pinned to 2026-05-21 so the 'week' window resolves to
// [2026-05-11, 2026-05-18). Fixture timestamps sit inside that window.
// showDirectoryPicker is stubbed via addInitScript; the real browser API is
// never invoked. BURN_STORE=memory (set in playwright.config.ts webServer env)
// keeps this test isolated from the production FileBurnStore.
//
// IDB note: fake handles carry function properties (queryPermission, entries,
// getFile). saveHandle() calls IDB put() which structuredClone()s the value →
// DataCloneError for functions. injectFakeHandlesIDB() patches
// IDBFactory.prototype.open for "coconutlabs.handles" only, replacing the put()
// clone with a plain Map write so setClaudeHandle() is reached after picking.

import { test, expect } from "@playwright/test";

// ── Fixture data ──────────────────────────────────────────────────────────────

// Two assistant rows, both timestamped inside [2026-05-11, 2026-05-18).
const FIXTURE_JSONL = [
  JSON.stringify({
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
  }),
  JSON.stringify({
    type: "assistant",
    timestamp: "2026-05-15T10:05:00Z",
    message: {
      model: "claude-sonnet-4-5",
      usage: {
        input_tokens: 800,
        output_tokens: 220,
        cache_read_input_tokens: 60,
        cache_creation: {
          ephemeral_5m_input_tokens: 8,
          ephemeral_1h_input_tokens: 2,
        },
      },
    },
  }),
].join("\n");

// 9-field row whitelist from lib/validateSummary.ts:29-33 (sorted for comparison).
const ROW_KEYS_SORTED = [
  "activeDays",
  "estimatedCostUsd",
  "model",
  "projectHash",
  "sessionCount",
  "timestampBucket",
  "tokenCount",
  "tool",
  "verification",
].sort();

// Keys that must NEVER appear in the envelope rows (silent leak guard).
const FORBIDDEN_ROW_KEYS = [
  "prompt",
  "rawContent",
  "content",
  "message_id",
  "filePath",
  "sessionId",
  "slug",
  "projectName",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Patch IDBFactory.prototype.open for "coconutlabs.handles" only.
 *
 * saveHandle() calls IDB put() which uses the structured clone algorithm.
 * Function-valued properties on fake handles (queryPermission, entries, getFile)
 * are not cloneable → DataCloneError → pickFolder() catch shows an error and
 * skips setClaudeHandle() → "✓ projects" button never appears → test hang.
 *
 * This patch intercepts only the handles DB and replaces the IDB put/get with
 * plain object-map operations that never invoke structuredClone.
 * All other DB names (e.g. "coconutlabs" for salt) fall through to real IDB.
 */
function injectFakeHandlesIDB() {
  // Runs in browser context — plain JS only.
  return () => {
    const HANDLES_DB = "coconutlabs.handles";
    const _realOpen = IDBFactory.prototype.open;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const _map: Record<string, any> = {};

    IDBFactory.prototype.open = function (name, version) {
      if (name !== HANDLES_DB) return _realOpen.call(this, name, version);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fakeReq: any = {
        result: null,
        error: null,
        readyState: "pending",
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
      };

      const fakeDb = {
        transaction() {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const tx: any = { oncomplete: null, onerror: null };
          tx.objectStore = () => ({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            put(value: any, key: string) {
              _map[key] = value; // store without structuredClone
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const r: any = { result: undefined, error: null, onsuccess: null, onerror: null };
              setTimeout(() => r.onsuccess && r.onsuccess({ target: r }), 0);
              return r;
            },
            get(key: string) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const r: any = {
                result: _map[key] !== undefined ? _map[key] : undefined,
                error: null,
                onsuccess: null,
                onerror: null,
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

/** Stub browser's showDirectoryPicker with a fake projects handle. */
function injectHappyPathPicker(jsonl: string) {
  // Runs in the browser context — plain JS only, no TS syntax.
  // The function literal is serialised by Playwright and eval'd in the page.
  return async ({ jsonl: content }: { jsonl: string }) => {
    const fakeFileHandle = {
      name: "session-2026-05-15.jsonl",
      kind: "file",
      getFile: async () =>
        new File([content], "session-2026-05-15.jsonl", {
          type: "text/plain",
        }),
    };

    const fakeProjAHandle = {
      name: "proj-a",
      kind: "directory",
      queryPermission: async () => "granted",
      requestPermission: async () => "granted",
      entries: async function* () {
        yield ["session-2026-05-15.jsonl", fakeFileHandle];
      },
    };

    const fakeProjectsHandle = {
      name: "projects",
      kind: "directory",
      queryPermission: async () => "granted",
      requestPermission: async () => "granted",
      entries: async function* () {
        yield ["proj-a", fakeProjAHandle];
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).showDirectoryPicker = async () => fakeProjectsHandle;
  };
}

/** Stub browser's showDirectoryPicker with a handle that has the wrong name. */
function injectRejectPicker() {
  return () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).showDirectoryPicker = async () => ({
      name: "random-folder",
      kind: "directory",
      queryPermission: async () => "granted",
      requestPermission: async () => "granted",
    });
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe("FSA burn import — picker flow", () => {
  // Pin the browser clock so Date.now() / new Date() inside buildEnvelope
  // resolve to a deterministic 'now' and calendarWindow('week') returns
  // [2026-05-11, 2026-05-18).
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: new Date("2026-05-21T00:00:00Z") });
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  test(
    "happy path: picks projects folder → scan → POST has valid 9-field envelope",
    async ({ page }) => {
      // 1a. Patch IDB handles DB to allow function-valued fake handle properties
      //     (prevents DataCloneError in saveHandle → pickFolder catch block).
      await page.addInitScript(injectFakeHandlesIDB());

      // 1b. Register addInitScript (runs before page JS on every navigation).
      await page.addInitScript(injectHappyPathPicker(FIXTURE_JSONL), {
        jsonl: FIXTURE_JSONL,
      });

      // 2. Intercept burnindex POST before navigating.
      // Filter by method: the page GETs /api/burnindex on mount (leaderboard
      // fetch). Only intercept POSTs — let GETs pass through so the GET
      // doesn't crash the handler with a null postDataJSON body.
      let capturedRaw: string | null = null;
      let postCount = 0;
      await page.route("**/api/burnindex", async (route) => {
        if (route.request().method() !== "POST") {
          await route.continue();
          return;
        }
        const body = route.request().postDataJSON() as {
          handle: string;
          raw: string;
        };
        capturedRaw = body.raw;
        postCount++;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ entries: [] }),
        });
      });

      // 3. Navigate with auto-detect flag (activates FSA UI branch).
      await page.goto("/?auto-detect=1");

      // 4. Open the modal — JoinBurnIndexForm lives inside a modal overlay
      //    that requires clicking "Join Burn Index" to render. Use .first()
      //    because the same button label appears in both hero and CTA sections.
      await page.getByRole("button", { name: "Join Burn Index" }).first().click();

      // 5. Step 1: pick folder.
      await page
        .getByRole("button", { name: "Select .claude/projects folder" })
        .click();
      // Button label changes to "✓ projects" once claudeHandle is set.
      await expect(
        page.getByRole("button", { name: /✓ projects/ }),
      ).toBeVisible({ timeout: 5_000 });

      // 6. Step 2: scan (clock ensures window = [2026-05-11, 2026-05-18)).
      await page.getByRole("button", { name: "Scan & preview" }).click();
      // Preview appears after runImport() resolves (may take a few seconds).
      await expect(
        page.getByRole("button", { name: "Upload to leaderboard" }),
      ).toBeVisible({ timeout: 15_000 });

      // 7. Step 3: enter handle + upload.
      await page.getByLabel(/GitHub \/ X handle/).fill("@testhandle");

      const responseReady = page.waitForResponse("**/api/burnindex");
      await page
        .getByRole("button", { name: "Upload to leaderboard" })
        .click();
      await responseReady;

      // ── Assertions ────────────────────────────────────────────────────────

      // Exactly one POST.
      expect(postCount).toBe(1);
      expect(capturedRaw).not.toBeNull();

      const envelope = JSON.parse(capturedRaw!) as {
        rows: Record<string, unknown>[];
      };

      // At least one row (both fixture lines share model+project → 1 aggregate).
      expect(envelope.rows.length).toBeGreaterThan(0);

      // Every row must have exactly the 9 whitelisted fields.
      for (const row of envelope.rows) {
        const keys = Object.keys(row).sort();
        expect(keys).toEqual(ROW_KEYS_SORTED);
      }

      // Negative: no raw/leaked keys anywhere in the rows JSON.
      const rowsJson = JSON.stringify(envelope.rows);
      for (const forbidden of FORBIDDEN_ROW_KEYS) {
        expect(rowsJson, `"${forbidden}" must not appear in rows`).not.toContain(
          `"${forbidden}"`,
        );
      }
    },
  );

  // ── Reject: wrong folder name ───────────────────────────────────────────────

  test(
    "reject: wrong folder name shows error message and never POSTs",
    async ({ page }) => {
      await page.addInitScript(injectRejectPicker());

      let postCount = 0;
      await page.route("**/api/burnindex", async (route) => {
        if (route.request().method() !== "POST") {
          await route.continue();
          return;
        }
        postCount++;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ entries: [] }),
        });
      });

      await page.goto("/?auto-detect=1");
      // Open the modal — form lives inside a modal overlay.
      await page.getByRole("button", { name: "Join Burn Index" }).first().click();
      await page
        .getByRole("button", { name: "Select .claude/projects folder" })
        .click();

      // Full error string from JoinBurnIndexForm.tsx pickFolder() — includes the
      // selected folder name so the assertion fails if no error is shown at all.
      await expect(
        page.getByText(
          'Selected folder must be the .claude/projects (or .codex/sessions) directory itself, not your home directory. You selected "random-folder".',
        ),
      ).toBeVisible({ timeout: 5_000 });

      // No POST must have been made.
      expect(postCount).toBe(0);
    },
  );
});
