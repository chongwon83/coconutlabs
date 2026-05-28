// burnStore/types.ts — the BurnStore contract + the types it persists.
//
// A BurnStore is the single hosted home for the Burn Index's shared state:
// the leaderboard and each handle's weekly import history. Two implementations
// satisfy it — fileStore (JSON files under .data/, for local dev) and
// redisStore (Upstash Redis, for Vercel where the filesystem is ephemeral and
// multi-instance). getStore() picks one.
//
// SECURITY: every type below is a DERIVED projection. A BurnStore persists
// ONLY these shapes — never the raw Burn Summary envelope, raw prompt/response
// content, original file paths, repo names, or secrets. An implementation must
// JSON-serialize only the typed object it is handed, never spread unknown data.

import type { ImportedEntry } from "@/lib/data";

// One weekly import's contribution to a handle's trend. trend.ts derives the
// sparkline and % change from a handle's successive weekly points.
// Holds ONLY these four fields — no raw envelope, content, paths, or secrets.
export interface ImportHistoryPoint {
  handle: string;
  weekKey: string; // periodWindow.since (ISO Monday) — the trend sort key
  totalTokens: number;
  importedAt: string; // audit only — NOT a sort key
}

// The persistence contract. Three methods — recordImportHistory is NOT exposed:
// upsertEntry absorbs the leaderboard + history write into one atomic step so
// the two can never drift (a history point with no matching leaderboard card,
// or vice versa). The pure derivations — historyByHandle, trendByHandle — live
// OUTSIDE this interface; they post-process readHistory output and are shared
// verbatim by both implementations.
export interface BurnStore {
  // The full leaderboard, newest import first. Empty store → [].
  readEntries(): Promise<ImportedEntry[]>;

  // Upsert one card by handle (a re-import replaces the older card) AND, when
  // the entry is a weekly import, record its history point — both in ONE
  // atomic write. Returns the full leaderboard (newest first) after the write.
  upsertEntry(entry: ImportedEntry): Promise<ImportedEntry[]>;

  // Every weekly import history point across all handles. Empty store → [].
  readHistory(): Promise<ImportHistoryPoint[]>;
}
