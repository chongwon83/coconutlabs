// store.ts — the Burn Index leaderboard's public read/write surface.
//
// The leaderboard is a shared resource: an import done in one browser must be
// visible to every other browser hitting the same server. This module is the
// stable API the route layer imports; the actual persistence lives behind a
// BurnStore (fileStore for local dev, redisStore for Vercel) chosen by
// getStore(). The exported signatures are unchanged from the pre-BurnStore
// version — route.ts is untouched by the migration.
//
// SECURITY: a BurnStore holds ONLY the derived ImportedEntry. The raw
// envelope, raw content, file paths, and secrets never reach this layer —
// route.ts builds the entry via buildImportedEntry before calling upsertEntry.

import type { ImportedEntry } from "@/lib/data";
import { getStore } from "@/lib/server/burnStore";

// The full leaderboard, newest import first. An empty store yields [].
export async function readEntries(): Promise<ImportedEntry[]> {
  return getStore().readEntries();
}

// Upsert by handle (a re-import replaces the older card) and, for a weekly
// import, record its history point — one atomic step inside the BurnStore.
// Returns the full leaderboard (newest first) so callers can echo it back.
export async function upsertEntry(entry: ImportedEntry): Promise<ImportedEntry[]> {
  return getStore().upsertEntry(entry);
}
