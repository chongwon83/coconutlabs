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
import type { ClaimUpsertResult } from "@/lib/server/burnStore/types";

// The full leaderboard, newest import first. An empty store yields [].
export async function readEntries(): Promise<ImportedEntry[]> {
  return getStore().readEntries();
}

// Upsert by handle (a re-import replaces the older card) and, for a weekly
// import, record its history point — one atomic step inside the BurnStore.
// Returns the full leaderboard (newest first) so callers can echo it back.
//
// UNGATED writer — the trusted server-side path (migration, admin backfill).
// The public POST path goes through claimAndUpsert; do NOT call this from the
// route on user input or you bypass the claim gate.
export async function upsertEntry(entry: ImportedEntry): Promise<ImportedEntry[]> {
  return getStore().upsertEntry(entry);
}

// Claim-gated upsert (spec §2.3 enforcing matrix) — the public POST path.
// `entry.handle` MUST already be canonical. Decides mint/match/reject against
// the per-handle claim record, writing the card ONLY on ok/claimed and echoing
// no board on a refusal. Never throws on an identity conflict; the route maps
// the ClaimUpsertResult to 201/409/400. The CLAIM_MODE readonly/enforcing gate
// is the route's responsibility — this is reached only in enforcing mode.
export async function claimAndUpsert(
  entry: ImportedEntry,
  presentedToken: string | undefined,
): Promise<ClaimUpsertResult> {
  return getStore().claimAndUpsert(entry, presentedToken);
}
