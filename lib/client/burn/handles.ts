// handles.ts — IndexedDB persistence for FileSystemDirectoryHandle objects.
//
// Stores the user's last-chosen .claude/projects and .codex/sessions handles
// across browser sessions so the FSA picker does not re-prompt on every visit.
// Permission must be re-verified on every page load — the browser revokes it
// after a navigation. Use ensurePermission() before any directory iteration.

const DB_NAME = "coconutlabs.handles";
const STORE_NAME = "handles";

function openHandlesDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () =>
      reject(req.error ?? new Error("IndexedDB open failed (handles)"));
  });
}

function withHandleStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openHandlesDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        const req = fn(store);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () =>
          reject(req.error ?? new Error("IndexedDB op failed (handles)"));
        tx.oncomplete = () => db.close();
        tx.onerror = () => {
          db.close();
          reject(tx.error ?? new Error("IndexedDB tx failed (handles)"));
        };
      }),
  );
}

// Persist a directory handle for later retrieval. Stored by kind so the
// claude and codex handles are independent — the user can update one without
// affecting the other.
export async function saveHandle(
  kind: "claude" | "codex",
  handle: FileSystemDirectoryHandle,
): Promise<void> {
  await withHandleStore("readwrite", (s) => s.put(handle, kind));
}

// Retrieve the last-saved directory handle, or null if none was saved.
// The returned handle is still permission-revoked after navigation — call
// ensurePermission() before iterating any entries.
export async function loadHandle(
  kind: "claude" | "codex",
): Promise<FileSystemDirectoryHandle | null> {
  const result = await withHandleStore<FileSystemDirectoryHandle | undefined>(
    "readonly",
    (s) => s.get(kind),
  );
  return result ?? null;
}

// Verify or re-request read permission on a previously saved handle.
// Returns "granted" if the user allows (or already has) read access,
// "denied" if they refuse or if the browser does not support the API.
// Must be called in a user-gesture context for requestPermission to work.
export async function ensurePermission(
  handle: FileSystemDirectoryHandle,
): Promise<"granted" | "denied"> {
  // queryPermission / requestPermission are part of the FSA spec but may not
  // be typed in older lib.dom.d.ts — cast through unknown to reach them.
  const h = handle as unknown as {
    queryPermission(desc: { mode: "read" }): Promise<PermissionState>;
    requestPermission(desc: { mode: "read" }): Promise<PermissionState>;
  };
  if (typeof h.queryPermission !== "function") return "denied";
  const current = await h.queryPermission({ mode: "read" });
  if (current === "granted") return "granted";
  if (typeof h.requestPermission !== "function") return "denied";
  const requested = await h.requestPermission({ mode: "read" });
  return requested === "granted" ? "granted" : "denied";
}
