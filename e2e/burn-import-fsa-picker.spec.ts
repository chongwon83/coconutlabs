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

/**
 * Stub showDirectoryPicker with a projects handle whose two project dirs are
 * claude slugs that decode to sibling repos under one parent
 * ("-Users-e2e-work-repoA" / "-Users-e2e-work-repoB" → /Users/e2e/work/{repoA,repoB}).
 * groupRepos() then yields ONE group rooted at /Users/e2e/work (2 repos ≥ the
 * default threshold), so the optional Step 3 (VES browser numerator) block must
 * surface a grant button for it after the scan. This is the render-surface
 * regression net for C2's grant UI; the count itself needs a real .git tree and
 * is unit-tested in gitcount.test.ts.
 */
function injectGroupablePicker(jsonl: string) {
  return async ({ jsonl: content }: { jsonl: string }) => {
    const slugs = ["-Users-e2e-work-repoA", "-Users-e2e-work-repoB"];
    const makeProj = (slug: string) => ({
      name: slug,
      kind: "directory",
      queryPermission: async () => "granted",
      requestPermission: async () => "granted",
      entries: async function* () {
        yield [
          "session-2026-05-15.jsonl",
          {
            name: "session-2026-05-15.jsonl",
            kind: "file",
            getFile: async () =>
              new File([content], "session-2026-05-15.jsonl", { type: "text/plain" }),
          },
        ];
      },
    });
    const fakeProjectsHandle = {
      name: "projects",
      kind: "directory",
      queryPermission: async () => "granted",
      requestPermission: async () => "granted",
      entries: async function* () {
        for (const slug of slugs) yield [slug, makeProj(slug)];
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).showDirectoryPicker = async () => fakeProjectsHandle;
  };
}

/**
 * Stub showDirectoryPicker with a projects handle holding ONE project dir whose
 * claude slug decodes to a single repo under a parent that no sibling shares
 * ("-Users-e2e-work-soloRepo" → /Users/e2e/work/soloRepo). groupRepos() then
 * yields groups:[] (one repo < the default threshold of 2) and
 * ungrouped:[/Users/e2e/work/soloRepo].
 *
 * This is the SINGLE-REPO ORPHAN regression net (PR1). Before the grantCards()
 * fix the Step 3 render gate was `repoGroups.length > 0`, so a groups:[] scan
 * left a solo developer with NO grant card and a permanently 0.0/Pending VES —
 * the core bug. With grantCards() the ungrouped repo is synthesized into one
 * repo-as-root card, so the numerator step must now surface for the single repo
 * too. The count itself needs a real .git tree (unit-tested in gitcount.test.ts);
 * this only pins that the card RENDERS.
 */
function injectSingleRepoPicker(jsonl: string) {
  return async ({ jsonl: content }: { jsonl: string }) => {
    const slug = "-Users-e2e-work-soloRepo";
    const fakeProj = {
      name: slug,
      kind: "directory",
      queryPermission: async () => "granted",
      requestPermission: async () => "granted",
      entries: async function* () {
        yield [
          "session-2026-05-15.jsonl",
          {
            name: "session-2026-05-15.jsonl",
            kind: "file",
            getFile: async () =>
              new File([content], "session-2026-05-15.jsonl", { type: "text/plain" }),
          },
        ];
      },
    };
    const fakeProjectsHandle = {
      name: "projects",
      kind: "directory",
      queryPermission: async () => "granted",
      requestPermission: async () => "granted",
      entries: async function* () {
        yield [slug, fakeProj];
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

      // 2. Mock the collector-token endpoint. JoinBurnIndexForm.tsx calls
      //    fetchCollectorToken() before POSTing the envelope. The real endpoint
      //    needs Redis + COLLECTOR_HMAC_SECRET which playwright.config.ts
      //    intentionally omits (security boundary). Without this stub the
      //    fetch throws and the upload aborts before /api/burnindex is hit.
      await page.route("**/api/internal/issue-collector-token", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ token: "test-token-for-e2e" }),
        });
      });

      // 3. Intercept burnindex POST before navigating.
      // Filter by method: the page GETs /api/burnindex on mount (leaderboard
      // fetch). Only intercept POSTs — let GETs pass through so the GET
      // doesn't crash the handler with a null postDataJSON body.
      let capturedRaw: string | null = null;
      let capturedClaimToken: string | null = null;
      let capturedReqHeaders: Record<string, string> = {};
      let postCount = 0;
      await page.route("**/api/burnindex", async (route) => {
        if (route.request().method() !== "POST") {
          await route.continue();
          return;
        }
        const body = route.request().postDataJSON() as {
          handle: string;
          raw: string;
          claimToken?: string;
        };
        capturedRaw = body.raw;
        capturedClaimToken = body.claimToken ?? null;
        capturedReqHeaders = route.request().headers();
        postCount++;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ entries: [] }),
        });
      });

      // 4. Navigate with auto-detect flag (activates FSA UI branch).
      await page.goto("/?auto-detect=1");

      // 5. Modal auto-opens via LandingApp.tsx:46-51 useEffect when the
      //    auto-detect query param is set. Assert the overlay first (fails
      //    fast and unambiguously if the auto-open contract regresses), then
      //    the picker button (fails if the FSA branch fails to mount).
      await expect(page.locator(".modal-overlay")).toBeVisible({
        timeout: 2_000,
      });
      await expect(
        page.getByRole("button", { name: "Select .claude/projects folder" }),
      ).toBeVisible({ timeout: 5_000 });

      // 6. Step 1: pick folder.
      await page
        .getByRole("button", { name: "Select .claude/projects folder" })
        .click();
      // Button label changes to "✓ projects" once claudeHandle is set.
      await expect(
        page.getByRole("button", { name: /✓ projects/ }),
      ).toBeVisible({ timeout: 5_000 });

      // 7. Step 2: scan (clock ensures window = [2026-05-11, 2026-05-18)).
      await page.getByRole("button", { name: "Scan & preview" }).click();
      // Preview appears after runImport() resolves (may take a few seconds).
      await expect(
        page.getByRole("button", { name: "Upload to leaderboard" }),
      ).toBeVisible({ timeout: 15_000 });

      // 8. Step 3: enter handle + upload.
      await page.getByLabel(/GitHub \/ X handle/).fill("@testhandle");

      // Predicate-form waitForResponse: only count the POST. The page also
      // GETs /api/burnindex on mount (leaderboard fetch) — the unpredicated
      // glob would match that too and let postCount remain 0 silently.
      const responseReady = page.waitForResponse(
        (res) =>
          res.url().includes("/api/burnindex") && res.request().method() === "POST",
      );
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

      // ── PR2: claim token (browser-upload-with-token, real-IDB proof) ───────
      // The upload must carry a per-handle claim token that loadOrCreateClaimToken
      // minted with the real browser crypto.getRandomValues + btoa AND durably
      // persisted via real IndexedDB (the unit tests defer this round-trip — no
      // node IDB shim). It must match the server's isValidTokenFormat gate exactly
      // (^[A-Za-z0-9_-]{43}$, lib/server/claim.ts) or the upload would 400 before
      // the claim logic runs.
      expect(capturedClaimToken).not.toBeNull();
      expect(capturedClaimToken).toMatch(/^[A-Za-z0-9_-]{43}$/);

      // I2 leak guard: the token is a BODY-only bearer secret. It must NOT ride
      // any request header (the only Authorization header is the collector token,
      // a different secret) nor the URL. A header/URL leak is the spec §2.10 line.
      const headerBlob = JSON.stringify(capturedReqHeaders);
      expect(headerBlob).not.toContain(capturedClaimToken!);
      expect(page.url()).not.toContain(capturedClaimToken!);
    },
  );

  // ── Step 3 (VES browser numerator) render surface ────────────────────────────

  test(
    "scan with groupable repos surfaces the Step 3 numerator grant button",
    async ({ page }) => {
      await page.addInitScript(injectFakeHandlesIDB());
      await page.addInitScript(injectGroupablePicker(FIXTURE_JSONL), {
        jsonl: FIXTURE_JSONL,
      });
      await page.route("**/api/internal/issue-collector-token", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ token: "test-token-for-e2e" }),
        });
      });
      // Let GETs pass through to the memory store; no POST is exercised here.
      await page.route("**/api/burnindex", async (route) => {
        if (route.request().method() !== "POST") {
          await route.continue();
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ entries: [] }),
        });
      });

      await page.goto("/?auto-detect=1");
      await expect(page.locator(".modal-overlay")).toBeVisible({ timeout: 2_000 });
      await page
        .getByRole("button", { name: "Select .claude/projects folder" })
        .click();
      await expect(page.getByRole("button", { name: /✓ projects/ })).toBeVisible({
        timeout: 5_000,
      });
      await page.getByRole("button", { name: "Scan & preview" }).click();
      await expect(
        page.getByRole("button", { name: "Upload to leaderboard" }),
      ).toBeVisible({ timeout: 15_000 });

      // The two slugs decode to /Users/e2e/work/{repoA,repoB} → one group at
      // /Users/e2e/work. The optional Step 3 block must offer to grant it.
      await expect(page.getByText("Count verified commits")).toBeVisible();
      const grant = page.getByRole("button", {
        name: /Grant\s+work\/\s+—\s+count\s+2\s+repos/,
      });
      await expect(grant).toBeVisible();
      // The absolute parent path is shown only as a local hint, never uploaded.
      await expect(page.getByText("/Users/e2e/work")).toBeVisible();

      // "Scan again" tears the numerator UI back down (resetNumerator).
      await page.getByRole("button", { name: "Scan again" }).click();
      await expect(page.getByText("Count verified commits")).toHaveCount(0);
    },
  );

  // ── Single-repo orphan: groups:[] still surfaces a grant card (PR1) ──────────

  test(
    "scan with a single repo (no group) still surfaces the Step 3 numerator grant card",
    async ({ page }) => {
      await page.addInitScript(injectFakeHandlesIDB());
      await page.addInitScript(injectSingleRepoPicker(FIXTURE_JSONL), {
        jsonl: FIXTURE_JSONL,
      });
      await page.route("**/api/internal/issue-collector-token", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ token: "test-token-for-e2e" }),
        });
      });
      await page.route("**/api/burnindex", async (route) => {
        if (route.request().method() !== "POST") {
          await route.continue();
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ entries: [] }),
        });
      });

      await page.goto("/?auto-detect=1");
      await expect(page.locator(".modal-overlay")).toBeVisible({ timeout: 2_000 });
      await page
        .getByRole("button", { name: "Select .claude/projects folder" })
        .click();
      await expect(page.getByRole("button", { name: /✓ projects/ })).toBeVisible({
        timeout: 5_000,
      });
      await page.getByRole("button", { name: "Scan & preview" }).click();
      await expect(
        page.getByRole("button", { name: "Upload to leaderboard" }),
      ).toBeVisible({ timeout: 15_000 });

      // The lone slug decodes to /Users/e2e/work/soloRepo → groups:[] (below the
      // threshold). PRE-PR1 this left NO card; the synthesized repo-as-root card
      // must now appear with a SINGULAR "count 1 repo" label (not "repos").
      await expect(page.getByText("Count verified commits")).toBeVisible();
      const grant = page.getByRole("button", {
        name: /Grant\s+soloRepo\/\s+—\s+count\s+1\s+repo(?!s)/,
      });
      await expect(grant).toBeVisible();
      // The repo-as-root absolute path is shown only as a local hint, never uploaded.
      await expect(page.getByText("/Users/e2e/work/soloRepo")).toBeVisible();

      // "Scan again" tears the numerator UI back down (resetNumerator).
      await page.getByRole("button", { name: "Scan again" }).click();
      await expect(page.getByText("Count verified commits")).toHaveCount(0);
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
      // Modal auto-opens via LandingApp.tsx:46-51 when ?auto-detect=1 is set.
      // Assert overlay first (fails fast if auto-open contract regresses),
      // then the picker button.
      await expect(page.locator(".modal-overlay")).toBeVisible({
        timeout: 2_000,
      });
      await expect(
        page.getByRole("button", { name: "Select .claude/projects folder" }),
      ).toBeVisible({ timeout: 5_000 });
      await page
        .getByRole("button", { name: "Select .claude/projects folder" })
        .click();

      // Canonical reject message from JoinBurnIndexForm.tsx:159 — regex must
      // include BOTH the user-supplied folder name AND the expected target
      // directory so a generic empty error or a generic "wrong folder" toast
      // can't satisfy the assertion. Refactor-resilient (i18n / minor wording)
      // but still catches missing-name-interpolation bugs.
      await expect(
        page.getByText(
          /You picked "random-folder"\. We need the directory literally named "projects" \(inside ~\/\.claude\/ or ~\/\.codex\/\)\. Try again\./,
        ),
      ).toBeVisible({ timeout: 5_000 });

      // No POST must have been made.
      expect(postCount).toBe(0);
    },
  );
});
