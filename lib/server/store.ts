// store.ts — server-side JSON file store for the Burn Index leaderboard.
//
// The leaderboard is a shared resource: an import done in one browser must be
// visible to every other browser hitting the same server (incognito included).
// localStorage cannot do that, so imports persist here instead.
//
// SECURITY: this file holds ONLY the derived ImportedEntry (handle, avatar,
// verif level, token/cost totals, period bounds, importedAt). The raw
// envelope, raw content, file paths, and secrets never reach this layer —
// route.ts builds the entry via buildImportedEntry before calling upsertEntry.

import { promises as fs } from "node:fs";
import path from "node:path";
import type { ImportedEntry } from "@/lib/data";
import { withLock, atomicWriteJson } from "@/lib/server/atomic";

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_PATH = path.join(DATA_DIR, "leaderboard.json");

// Read the full leaderboard. A missing or corrupt file yields [] rather than
// throwing — the server's first boot, or a hand-deleted .data/, must not 500.
export async function readEntries(): Promise<ImportedEntry[]> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ImportedEntry[]) : [];
  } catch {
    return [];
  }
}

// Upsert by handle (a re-import replaces the older card), newest first.
// Returns the full list after the write so callers can echo it to the client.
// The whole read-modify-write runs under withLock so two concurrent imports
// cannot each read stale state and lose one of the writes.
export async function upsertEntry(entry: ImportedEntry): Promise<ImportedEntry[]> {
  return withLock(STORE_PATH, async () => {
    const prev = await readEntries();
    const next = [entry, ...prev.filter((e) => e.handle !== entry.handle)];
    next.sort((a, b) => b.importedAt.localeCompare(a.importedAt));
    await atomicWriteJson(STORE_PATH, next);
    return next;
  });
}
