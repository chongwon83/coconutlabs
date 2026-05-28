// burnStore/fileStore.ts — BurnStore backed by JSON files under .data/.
//
// This is the local-dev implementation: no account, no network, no deps. It
// is the original store.ts / importHistory.ts logic gathered behind the
// BurnStore interface, unchanged in behavior.
//
// Vercel's filesystem is ephemeral and per-instance, so this implementation is
// NOT used in production — getStore() picks redisStore when Upstash env vars
// are present. fileStore stays the honest local default.
//
// SECURITY: persists ONLY the derived ImportedEntry / ImportHistoryPoint
// shapes. route.ts builds ImportedEntry via buildImportedEntry before calling
// upsertEntry — the raw envelope, content, paths, and secrets never reach this
// layer.

import { promises as fs } from "node:fs";
import path from "node:path";
import type { ImportedEntry } from "@/lib/data";
import { withLock, atomicWriteJson } from "@/lib/server/atomic";
import type {
  BurnStore,
  ImportHistoryPoint,
} from "@/lib/server/burnStore/types";

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_PATH = path.join(DATA_DIR, "leaderboard.json");
const HIST_PATH = path.join(DATA_DIR, "import-history.json");

const KEEP_PER_HANDLE = 12; // > trend WINDOW(7), caps history file growth

// Read a JSON array file. A missing or corrupt file yields [] rather than
// throwing — the server's first boot, or a hand-deleted .data/, must not 500.
async function readArray<T>(filePath: string): Promise<T[]> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

// JSON blobs written before A.1 (toolsUsed) or B (breakdown) will deserialize
// without the respective field — coerce to `[]` before any consumer reads it.
function hydrateEntry(e: ImportedEntry): ImportedEntry {
  if (Array.isArray(e.toolsUsed) && Array.isArray(e.breakdown)) return e;
  return {
    ...e,
    toolsUsed: Array.isArray(e.toolsUsed) ? e.toolsUsed : [],
    breakdown: Array.isArray(e.breakdown) ? e.breakdown : [],
  };
}

export class FileBurnStore implements BurnStore {
  async readEntries(): Promise<ImportedEntry[]> {
    const rows = await readArray<ImportedEntry>(STORE_PATH);
    return rows.map(hydrateEntry);
  }

  async readHistory(): Promise<ImportHistoryPoint[]> {
    return readArray<ImportHistoryPoint>(HIST_PATH);
  }

  // Upsert by handle (a re-import replaces the older card), newest first, and
  // record the weekly history point — both under one withLock so two
  // concurrent imports cannot read stale state and lose a write.
  //
  // The two files are not transactionally atomic: if the history write throws,
  // the leaderboard write below is skipped and both stay unwritten; if history
  // succeeds but the leaderboard write fails, history holds a point the
  // leaderboard lacks. That window is rare and self-heals — the next re-import
  // of the same (handle, week) overwrites the history point and re-runs this
  // upsert (both idempotent by handle).
  async upsertEntry(entry: ImportedEntry): Promise<ImportedEntry[]> {
    return withLock(STORE_PATH, async () => {
      const prev = (await readArray<ImportedEntry>(STORE_PATH)).map(hydrateEntry);
      const next = [entry, ...prev.filter((e) => e.handle !== entry.handle)];
      next.sort((a, b) => b.importedAt.localeCompare(a.importedAt));
      await this.#recordHistory(entry);
      await atomicWriteJson(STORE_PATH, next);
      return next;
    });
  }

  // Record one weekly import. NO own lock — upsertEntry already holds
  // withLock(STORE_PATH) and is the sole writer. Non-week imports are skipped.
  // Re-importing the same (handle, weekKey) replaces that week's point.
  async #recordHistory(entry: ImportedEntry): Promise<void> {
    if (entry.period !== "week" || entry.since == null) return;
    const weekKey = entry.since;
    const point: ImportHistoryPoint = {
      handle: entry.handle,
      weekKey,
      totalTokens: entry.totalTokens,
      importedAt: entry.importedAt,
    };
    const prev = await readArray<ImportHistoryPoint>(HIST_PATH);
    const others = prev.filter(
      (p) => !(p.handle === entry.handle && p.weekKey === weekKey),
    );
    const mine = others.filter((p) => p.handle === entry.handle);
    const notMine = others.filter((p) => p.handle !== entry.handle);
    const myNext = [...mine, point]
      .sort((a, b) => a.weekKey.localeCompare(b.weekKey))
      .slice(-KEEP_PER_HANDLE);
    await atomicWriteJson(HIST_PATH, [...notMine, ...myNext]);
  }
}
