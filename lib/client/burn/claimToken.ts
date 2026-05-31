// claimToken.ts — the browser-minted, per-handle CLAIM token (spec §2.2–2.5).
//
// THE TOKEN THIS MODULE OWNS — read before touching: the *claim* token is a
// 256-bit secret the browser mints ONCE per @handle, persists in IndexedDB, and
// attaches to every Burn Index upload as `body.claimToken`. The server never
// stores it — only a domain-separated sha256 (lib/server/claim.ts) — and a
// re-upload proves "same claimant of @handle" by presenting the same token
// (v1 identity; real ownership/OAuth is deferred to v2). It is NOT either of the
// other two browser secrets, and must never be conflated with them:
//   • COLLECTOR token (token.ts) — a short-lived server nonce, fetched fresh per
//     upload, sent as the `Authorization` header. Burned server-side each use.
//   • project-hash SALT (hashing.ts) — device-stable, hashes folder names; one
//     per device, not per handle.
// All three share the IDB database `coconutlabs` (store `config`) but live under
// distinct keys. The claim token is the only one that is a BEARER SECRET FOR
// IDENTITY, so the hard rule (spec §2.10): NEVER log it, NEVER place it in a URL,
// header, query string, telemetry event, or error-capture payload. Body-only.

// Shared with hashing.ts (the salt). Same DB + store + version so the two
// modules coexist in one object store; only the KEYS differ. If hashing.ts ever
// bumps DB_VERSION, bump it here in lockstep.
const DB_NAME = "coconutlabs";
const STORE_NAME = "config";
const DB_VERSION = 1;

// Per-handle token key, namespaced so it cannot collide with `salt` or any
// future `config` key. canonicalHandle keeps "@Foo" / "Foo" / "foo" on ONE
// token, matching the server's canonical claim key (lib/server/handle.ts).
const TOKEN_KEY_PREFIX = "claimToken:";
// The canonical handle whose token was most recently minted/used. Lets a future
// seamless-UX path (PR3) prefill the field with the device's own handle.
const LAST_HANDLE_KEY = "claimToken:lastHandle";

// 256-bit random → base64url(no padding) = exactly 43 chars. MUST satisfy the
// server's isValidTokenFormat (^[A-Za-z0-9_-]{43}$, lib/server/claim.ts) or the
// upload is rejected 400 before the claim gate.
const TOKEN_FORMAT_RE = /^[A-Za-z0-9_-]{43}$/;

// GitHub-ish canonical key — inline mirror of lib/server/handle.ts
// canonicalHandle. Client code cannot import the server module (node:crypto),
// so keep this in sync: strip leading @(s), trim, lowercase, validate charset.
const CANONICAL_HANDLE_RE = /^[a-z0-9](?:[a-z0-9-]{0,38})$/;
function canonicalHandle(raw: string): string | null {
  const stripped = raw.trim().replace(/^@+/, "").toLowerCase();
  return CANONICAL_HANDLE_RE.test(stripped) ? stripped : null;
}

/**
 * The IDB key for a handle's token. Valid handles key by their canonical form
 * (so "@Foo" / "Foo" / "foo" SHARE one token). An invalid handle can never win a
 * claim — the server 400s it at handle validation, before the claim gate — but
 * we still want a deterministic, total function, so fall back to the loosely-
 * normalized form. Throws only on a key that normalizes to empty (e.g. "@@@"),
 * which the form already guards against and the server would 400 regardless.
 * Exported for unit coverage of the per-canonical-handle aliasing contract.
 */
export function claimTokenStorageKey(handle: string): string {
  const canonical = canonicalHandle(handle);
  if (canonical !== null) return TOKEN_KEY_PREFIX + canonical;
  const loose = handle.trim().replace(/^@+/, "").toLowerCase();
  if (loose === "") {
    throw new Error("Cannot derive a claim-token key from an empty handle.");
  }
  return TOKEN_KEY_PREFIX + loose;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () =>
      reject(req.error ?? new Error("IndexedDB open failed (claimToken)"));
  });
}

// A single-op transaction that closes the db on settle. Rejects (never silently
// resolves) on any IDB error so a blocked / private-mode store surfaces to the
// caller, which then refuses to upload.
//
// DURABILITY (codex I4): resolve on tx.oncomplete, NOT req.onsuccess. A readwrite
// request can report success and still ABORT at transaction commit (quota/IO);
// resolving on the request would report a token as persisted when it never
// durably committed — the next upload would then mint a DIFFERENT token and 409
// the user out of their own row. So capture req.result, but settle only when the
// transaction durably commits, and reject on request error, tx error, OR tx abort
// (a commit-time quota failure fires onabort, not onerror).
function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        let result: T;
        let settled = false;
        const finish = (err?: unknown) => {
          if (settled) return;
          settled = true;
          db.close();
          if (err === undefined) resolve(result);
          else
            reject(
              err instanceof Error
                ? err
                : new Error("IndexedDB op failed (claimToken)"),
            );
        };
        try {
          const tx = db.transaction(STORE_NAME, mode);
          const store = tx.objectStore(STORE_NAME);
          const req = fn(store);
          req.onsuccess = () => {
            result = req.result;
          };
          req.onerror = () =>
            finish(req.error ?? new Error("IndexedDB op failed (claimToken)"));
          tx.oncomplete = () => finish();
          tx.onerror = () =>
            finish(tx.error ?? new Error("IndexedDB tx failed (claimToken)"));
          tx.onabort = () =>
            finish(tx.error ?? new Error("IndexedDB tx aborted (claimToken)"));
        } catch (err) {
          // Synchronous throw from db.transaction()/fn(store) — e.g. a tampered
          // v1 DB missing the `config` store throws NotFoundError. Route through
          // finish() so db.close() runs (else the connection leaks); never pass
          // undefined (would resolve instead of reject). (codex confirm #5)
          finish(
            err === undefined
              ? new Error("IndexedDB setup failed (claimToken)")
              : err,
          );
        }
      }),
  );
}

// 32 random bytes → base64url with no padding = 43 chars. crypto.getRandomValues
// is a CSPRNG; the token is never derived from anything guessable. Exported so a
// unit test can assert it satisfies the server's isValidTokenFormat gate — a
// drift there would silently 400 every upload before the claim logic runs.
export function mintClaimToken(): string {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  let binary = "";
  for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * The token for `handle`, minting + persisting one on first use. Subsequent
 * calls for the same canonical handle return the SAME token, which is what lets
 * a re-upload re-claim the row. Updates the lastHandle pointer on every call.
 *
 * Rejects if IndexedDB is unavailable (private mode, blocked storage, quota).
 * The caller MUST treat a rejection as "do not upload": sending no token would
 * either 400 (unclaimed handle) or 409 (mint a competing claim), so failing the
 * upload is safer than silently dropping identity (spec §2.10, plan step 11).
 *
 * Also rejects (rather than silently re-minting) if a value is PRESENT but
 * malformed — re-minting would change this device's identity for the handle and,
 * if it was already claimed, 409-lock the user out of their own row (codex #6).
 */
export async function loadOrCreateClaimToken(handle: string): Promise<string> {
  const key = claimTokenStorageKey(handle);
  const bareHandle = key.slice(TOKEN_KEY_PREFIX.length);
  const existing = (await withStore("readonly", (s) => s.get(key))) as unknown;
  if (typeof existing === "string" && TOKEN_FORMAT_RE.test(existing)) {
    // Refresh the lastHandle pointer even on a hit so prefill tracks the most
    // recently used handle, not only freshly-minted ones.
    await withStore("readwrite", (s) => s.put(bareHandle, LAST_HANDLE_KEY));
    return existing;
  }
  if (existing !== undefined && existing !== null) {
    // A value is present but isn't a valid token — storage corruption (or a
    // foreign write). Mint ONLY when the key is absent; here, silently re-minting
    // would change this device's identity for the handle. Surface it instead
    // (honest failure > silent identity change). v1 recovery is manual
    // (clearClaimToken / clear site data); a distinct in-form "reset your device
    // claim" affordance is a PR3 follow-up.
    throw new Error(
      "Stored device claim for this handle is corrupt; cannot safely re-mint (v1 recovery is manual).",
    );
  }
  // Absent → first claim for this handle on this device. Mint + persist.
  const fresh = mintClaimToken();
  await withStore("readwrite", (s) => s.put(fresh, key));
  await withStore("readwrite", (s) => s.put(bareHandle, LAST_HANDLE_KEY));
  return fresh;
}

/**
 * Read-only peek: the persisted token for `handle`, or null if none exists yet
 * (or storage is unreadable). Never mints. For tests and a future seamless-UX
 * "you already claimed this" hint — must not be used to gate the upload.
 */
export async function peekClaimToken(handle: string): Promise<string | null> {
  try {
    const key = claimTokenStorageKey(handle);
    const existing = (await withStore("readonly", (s) => s.get(key))) as
      | string
      | undefined;
    return typeof existing === "string" && TOKEN_FORMAT_RE.test(existing)
      ? existing
      : null;
  } catch {
    return null;
  }
}

/**
 * The canonical handle whose token was most recently minted/used, or null.
 * For a future prefill of the join field; read-only, never throws.
 */
export async function getLastClaimedHandle(): Promise<string | null> {
  try {
    const last = (await withStore("readonly", (s) => s.get(LAST_HANDLE_KEY))) as
      | string
      | undefined;
    return typeof last === "string" && last.length > 0 ? last : null;
  } catch {
    return null;
  }
}

/**
 * Forget the token for `handle` (device-reset / test cleanup). The next
 * loadOrCreateClaimToken mints a NEW token, which will FAIL to re-claim an
 * existing row (409) — only call when the user explicitly abandons the handle.
 */
export async function clearClaimToken(handle: string): Promise<void> {
  const key = claimTokenStorageKey(handle);
  await withStore("readwrite", (s) => s.delete(key));
}
