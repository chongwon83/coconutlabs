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
// Holds ONLY these fields — no raw envelope, content, paths, or secrets.
export interface ImportHistoryPoint {
  handle: string; // CANONICAL key (spec §2.6) — the trend group/sort key
  weekKey: string; // periodWindow.since (ISO Monday) — the trend sort key
  totalTokens: number;
  importedAt: string; // audit only — NOT a sort key
  // Case-preserving original of `handle`, persisted ONLY when it differs from
  // the canonical key (e.g. "Foo" → handle "foo", displayHandle "Foo"). Render-
  // only; never a key. Absent for already-canonical handles. The A5 migration
  // sets it when collapsing "@Foo"/"FOO" aliases onto one canonical row.
  displayHandle?: string;
}

// What claimAndUpsert resolves to (spec §2.9). The route maps it to an HTTP
// status WITHOUT throwing — an identity conflict is an expected 409/400, never a
// 500. `entries` (the full leaderboard, newest first) is present ONLY when a
// write happened (a token was minted or matched); a rejected claim returns no
// board so the caller cannot leak post-write state on a denied write.
export type ClaimUpsertResult =
  | { status: "claimed"; entries: ImportedEntry[] } // first mint → 201
  | { status: "ok"; entries: ImportedEntry[] } // matching token → 201
  | { status: "mismatch" } // claimed, token missing/wrong → 409
  | { status: "legacyLocked" } // grandfathered, manual recovery → 409
  | { status: "invalid" }; // missing-on-unclaimed / malformed token → 400

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
  //
  // PRE-PR2 path: bypasses the claim gate. After PR2 the route calls
  // claimAndUpsert on the public POST path; upsertEntry stays for trusted
  // server-side writers (migration, admin backfill) that must not be gated.
  upsertEntry(entry: ImportedEntry): Promise<ImportedEntry[]>;

  // Claim-gated upsert (spec §2.3 enforcing matrix). `entry.handle` MUST already
  // be canonical (route canonicalizes before buildImportedEntry). `presentedToken`
  // is the raw client token (undefined when the body omitted it). Decides
  // mint/match/reject against the per-handle claim record, then — ONLY on
  // ok/claimed — performs the SAME upsert as upsertEntry (preserving the
  // mergeNumerator precedence merge, §3.5 P1). Never throws on an identity
  // conflict; returns a ClaimUpsertResult the route maps to 201/409/400.
  // The route owns the CLAIM_MODE readonly/enforcing gate — this method assumes
  // enforcing and is never reached during the readonly window.
  claimAndUpsert(
    entry: ImportedEntry,
    presentedToken: string | undefined,
  ): Promise<ClaimUpsertResult>;

  // Every weekly import history point across all handles. Empty store → [].
  readHistory(): Promise<ImportHistoryPoint[]>;
}
