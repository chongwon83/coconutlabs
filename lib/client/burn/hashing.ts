// hashing.ts — browser-side salted project hashing (Phase 2 FSA flow).
//
// Mirrors web/tools/usage-poc/coconut_collector/hashing.py *semantically*.
// Byte-level parity with Python is intentionally NOT a goal — the browser keeps
// its own salt in IndexedDB so the same machine produces stable hashes across
// browser visits, but its hash space is separate from the Python CLI's by
// default. A user who wants the two paths to collapse into one identity can
// paste their `~/.coconutlabs/salt` value into the optional "Import Python
// salt" input; that's the only way the two paths agree.
//
// Why separate identities by default? `~/.coconutlabs/salt` lives at 0600 on
// the user's home directory — reading it from the browser would require the
// user to grant the page access to their home folder, which the rest of the
// plan explicitly forbids (narrow .claude/projects and .codex/sessions only).
//
// Hash formula (must match hashing.py::project_hash):
//   sha256(TextEncoder().encode(`${salt}:${slug}`))[:12]  // lowercase hex
//
// Salt format (must match hashing.py::load_or_create_salt):
//   secrets.token_hex(32) → 64 lowercase hex characters (32 random bytes).

const DB_NAME = "coconutlabs";
const STORE_NAME = "config";
const SALT_KEY = "salt";
const HASH_LEN = 12;
// Python's secrets.token_hex(32) emits 64 hex chars from 32 random bytes.
const SALT_HEX_LEN = 64;

// Matches the shape of /^[0-9a-f]{64}$/ — what Python's secrets.token_hex(32)
// produces and what an imported Python salt should still look like.
const SALT_RE = /^[0-9a-f]{64}$/;

function openSaltDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
}

function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openSaltDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        const req = fn(store);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error("IndexedDB op failed"));
        tx.oncomplete = () => db.close();
        tx.onerror = () => {
          db.close();
          reject(tx.error ?? new Error("IndexedDB tx failed"));
        };
      }),
  );
}

function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

function generateSalt(): string {
  // 32 random bytes → 64 lowercase hex chars (matches secrets.token_hex(32)).
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return bytesToHex(buf);
}

// Read the persisted browser salt, generating one on first use. The salt
// stays IndexedDB-resident — never uploaded, never written into a Burn
// Summary — and is origin-bound by the browser, so coconutlabs.xyz cannot
// see another origin's salt.
export async function loadOrCreateSalt(): Promise<string> {
  const existing = (await withStore("readonly", (s) => s.get(SALT_KEY))) as
    | string
    | undefined;
  if (typeof existing === "string" && SALT_RE.test(existing)) {
    return existing;
  }
  const fresh = generateSalt();
  await withStore("readwrite", (s) => s.put(fresh, SALT_KEY));
  return fresh;
}

// Replace the persisted salt with a user-provided value (the "Import Python
// salt" path). Validates the hex shape before persisting so a typo cannot
// silently corrupt every future hash on this device.
export async function importSalt(rawValue: string): Promise<string> {
  const trimmed = rawValue.trim().toLowerCase();
  if (!SALT_RE.test(trimmed)) {
    throw new Error(
      "Salt must be 64 lowercase hex characters (32 bytes). Open ~/.coconutlabs/salt and copy its contents.",
    );
  }
  await withStore("readwrite", (s) => s.put(trimmed, SALT_KEY));
  return trimmed;
}

// Erase the persisted salt; the next loadOrCreateSalt() call mints a new one.
// Project hashes silently change after this — only call when the user
// explicitly asks to reset their device identity.
export async function clearSalt(): Promise<void> {
  await withStore("readwrite", (s) => s.delete(SALT_KEY));
}

// Byte-equivalent to Python's:
//   hashlib.sha256(f"{salt}:{project_slug}".encode("utf-8")).hexdigest()[:12]
// TextEncoder is UTF-8 native, crypto.subtle.digest returns SHA-256 as raw
// bytes, lowercase hex matches Python's hexdigest, slice(0, 12) matches the
// _HASH_LEN cut.
//
// projectSlug is hash input only — callers must never emit it raw. The slug
// itself is the user's project folder name; the hash is the only form that
// is safe to ship in a Burn Summary.
export async function projectHash(
  projectSlug: string,
  salt: string,
): Promise<string> {
  const input = new TextEncoder().encode(`${salt}:${projectSlug}`);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return bytesToHex(new Uint8Array(digest)).slice(0, HASH_LEN);
}
