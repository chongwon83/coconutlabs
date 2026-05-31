// burnStore/redisStore.ts — BurnStore backed by Upstash Redis.
//
// This is the production implementation. Vercel's filesystem is ephemeral and
// per-instance, so the JSON-file store (fileStore) cannot persist across
// deploys or serialize writes across instances. Upstash Redis is the hosted
// shared home: getStore() picks this when UPSTASH_REDIS_REST_URL is present.
//
// CONCURRENCY: fileStore relied on withLock (an in-process promise chain) to
// make read-modify-write safe. That does not survive multiple instances. Here
// the leaderboard + history write is one atomic Lua EVAL — that pairing has no
// read-modify-write race because the script runs indivisibly on the server.
// The one exception is the VES numerator precedence merge (upsertEntry): it
// does an HGET before the EVAL to merge against the stored count in TS, so that
// read-then-write step is NOT atomic. We accept it deliberately — cjson is not
// a documented Upstash builtin (so we will not merge inside Lua), and for this
// workload (one operator re-importing their own data) two same-handle writes
// never interleave. See mergeNumerator for the merge rules.
//
// SECURITY: persists ONLY the derived ImportedEntry / ImportHistoryPoint
// shapes. Every value written below is an explicit JSON.stringify of a typed
// object — never a spread of unknown data. The raw envelope, raw content, file
// paths, repo names, and secrets never reach this layer (route.ts builds
// ImportedEntry via buildImportedEntry first).

import type { Redis } from "@upstash/redis";
import type { ImportedEntry } from "@/lib/data";
import { mergeNumerator } from "@/lib/server/burnStore/mergeNumerator";
import {
  isValidTokenFormat,
  hashToken,
  CLAIM_SCHEME,
  LEGACY_LOCKED_STRING,
} from "@/lib/server/claim";
import type {
  BurnStore,
  ClaimUpsertResult,
  ImportHistoryPoint,
} from "@/lib/server/burnStore/types";

const LEADERBOARD_KEY = "burn:leaderboard";
const histKey = (handle: string) => `burn:hist:${handle}`;
// Claim hash: field = CANONICAL handleKey, value = the metadata-thin string
// `sha256-v1:<hex>` | `legacy-locked` (spec A2 — no cjson so the atomic Lua gate
// needs no parsing). v1 in the key lets a future scheme migrate without a clash.
const CLAIMS_KEY = "burn:claims:v1";

const KEEP_PER_HANDLE = 12; // > trend WINDOW(7), caps history hash growth

// Claim-gate return codes — the small int the Lua returns and the TS maps to a
// ClaimUpsertResult (spec §2.9). NEVER a thrown error: an identity conflict is
// an expected 409/400, and throwing would collapse it into route.ts's 500 catch.
const CODE = {
  OK: 0, // active claim matched → upsert ran → 201
  CLAIMED: 1, // unclaimed + valid token → minted + upsert ran → 201
  MISMATCH: 2, // active claim, token missing/wrong → no write → 409
  LEGACY: 3, // legacy-locked → no write → 409
  INVALID: 4, // unclaimed + missing token → no write → 400
} as const;

// Atomic upsert: leaderboard HSET + (week-only) history HSET + history trim,
// all in one indivisible server-side script. This is what makes redisStore
// safe across instances where fileStore's in-process withLock cannot reach.
//
//   KEYS[1] = burn:leaderboard        KEYS[2] = burn:hist:<handle>
//   ARGV    = handle, entryJson, isWeek("0"|"1"), weekKey, pointJson, keep
//
// weekKey ISO Monday strings sort lexicographically = chronologically, so
// table.sort + HDEL of the lowest excess keys trims oldest-first.
const UPSERT_LUA = `
redis.call('HSET', KEYS[1], ARGV[1], ARGV[2])
if ARGV[3] == '1' then
  redis.call('HSET', KEYS[2], ARGV[4], ARGV[5])
  local keys = redis.call('HKEYS', KEYS[2])
  table.sort(keys)
  local excess = #keys - tonumber(ARGV[6])
  for i = 1, excess do redis.call('HDEL', KEYS[2], keys[i]) end
end
return 1
`;

// Claim-gated upsert (spec §2.3, Q2 Option A). One indivisible EVAL: read the
// claim FIRST, decide, then write leaderboard + history + (on a mint) the claim
// — the card/history writes are CONDITIONAL on the claim passing, so an impostor
// changes nothing. The TS side mirrors decideClaim's matrix by passing the
// presented value as the already-domain-separated string `sha256-v1:<hex>`
// (or "" for a missing token); Lua needs no hashing and no parsing.
//
//   KEYS[1]=burn:leaderboard  KEYS[2]=burn:hist:<handle>  KEYS[3]=burn:claims:v1
//   ARGV = handle, entryJson, isWeek("0"|"1"), weekKey, pointJson, keep,
//          presented("" | "sha256-v1:<hex>"), legacyStr("legacy-locked")
//
// ROLLBACK HAZARD (Q2c): Redis Lua is atomic against interleaving but NOT
// transactional — a runtime error mid-script leaves prior writes committed. So
// every fallible step is done up front: `keep` is tonumber'd and bounds-guarded
// BEFORE any write, the presented string is pre-validated in TS (we never hash
// junk), and the claim HSET is the LAST write with nothing parse-able after it.
// The remaining ops are only HGET/HSET/HKEYS/HDEL on string args — they cannot
// raise. The `keep` guard is the teeth: a malformed ARGV[6] (today impossible —
// the wrapper passes the hardcoded KEEP_PER_HANDLE) would otherwise make
// `#keys - keep` throw AFTER the card/history write but BEFORE the claim write,
// leaving a card-without-claim that an impostor could then mint. With the guard,
// an unparseable/negative keep simply SKIPS the trim (never over-deletes, never
// raises); the card/history/claim writes still complete atomically.
//
// Returns a small int (NEVER throws — an identity conflict is an expected
// 409/400, and a thrown error would collapse into route.ts's 500 catch):
//   0=ok(matched) 1=claimed(minted) 2=mismatch 3=legacy 4=invalid.
const CLAIM_UPSERT_LUA = `
local keep = tonumber(ARGV[6])
local presented = ARGV[7]
local legacyStr = ARGV[8]
local claim = redis.call('HGET', KEYS[3], ARGV[1])
local minted = false
if not claim then
  if presented == '' then return 4 end
  minted = true
elseif claim == legacyStr then
  return 3
else
  if presented == '' then return 2 end
  if claim ~= presented then return 2 end
end
redis.call('HSET', KEYS[1], ARGV[1], ARGV[2])
if ARGV[3] == '1' then
  redis.call('HSET', KEYS[2], ARGV[4], ARGV[5])
  if keep and keep >= 1 then
    local keys = redis.call('HKEYS', KEYS[2])
    table.sort(keys)
    local excess = #keys - keep
    for i = 1, excess do redis.call('HDEL', KEYS[2], keys[i]) end
  end
end
if minted then
  redis.call('HSET', KEYS[3], ARGV[1], presented)
  return 1
end
return 0
`;

// Sort newest import first — the order route.ts echoes to the client.
function byImportedAtDesc(a: ImportedEntry, b: ImportedEntry): number {
  return b.importedAt.localeCompare(a.importedAt);
}

// Rebuild an ImportedEntry field-by-field before it is persisted. TypeScript
// checks shapes only at compile time, so a structurally-compatible object
// could still carry extra enumerable properties at runtime; JSON.stringify of
// the raw param would persist them. This explicit projection guarantees ONLY
// the declared ImportedEntry fields reach Redis — never a raw envelope,
// content, path, or secret that rode in on an extra property.
function projectEntry(e: ImportedEntry): ImportedEntry {
  const stored: ImportedEntry = {
    handle: e.handle,
    avatar: e.avatar,
    verif: e.verif,
    totalTokens: e.totalTokens,
    estimatedCostUsd: e.estimatedCostUsd,
    period: e.period,
    since: e.since,
    until: e.until,
    importedAt: e.importedAt,
    // Defensive `?? []`: an ImportedEntry built before A.1 (toolsUsed) or the
    // B cycle (breakdown) added the field lands here without it. The persisted
    // shape must always carry the arrays so readEntries hydration is a no-op.
    toolsUsed: e.toolsUsed ?? [],
    breakdown: e.breakdown ?? [],
  };
  if (e.displayHandle !== undefined) stored.displayHandle = e.displayHandle;
  if (e.fixes !== undefined) stored.fixes = e.fixes;
  if (e.fixesSource !== undefined) stored.fixesSource = e.fixesSource;
  if (e.ves !== undefined) stored.ves = e.ves;
  if (e.trendDir !== undefined) stored.trendDir = e.trendDir;
  if (e.trendPct !== undefined) stored.trendPct = e.trendPct;
  if (e.trendSeries !== undefined) stored.trendSeries = e.trendSeries;
  return stored;
}

// Hydrate one entry read from Redis. Blobs may predate A.1 (no toolsUsed), the
// B cycle (no breakdown), or the VES provenance field (no fixesSource). Coerce
// the arrays to `[]`, and backfill fixesSource="cli" when a numerator is
// present without a source so the precedence merge ranks legacy rows as CLI.
// Keep in lockstep with fileStore and memoryStore.
function hydrateEntry(e: ImportedEntry): ImportedEntry {
  const needsArrays = !Array.isArray(e.toolsUsed) || !Array.isArray(e.breakdown);
  const needsSource = e.fixes != null && e.fixesSource == null;
  if (!needsArrays && !needsSource) return e;
  return {
    ...e,
    toolsUsed: Array.isArray(e.toolsUsed) ? e.toolsUsed : [],
    breakdown: Array.isArray(e.breakdown) ? e.breakdown : [],
    ...(needsSource ? { fixesSource: "cli" as const } : {}),
  };
}

export class RedisBurnStore implements BurnStore {
  readonly #redis: Redis;

  constructor(redis: Redis) {
    this.#redis = redis;
  }

  // The full leaderboard, newest first. Missing key → []. A network error
  // throws — a hidden empty leaderboard would look like data loss.
  async readEntries(): Promise<ImportedEntry[]> {
    const map = await this.#redis.hgetall<Record<string, ImportedEntry>>(
      LEADERBOARD_KEY,
    );
    if (map == null) return [];
    return Object.values(map).map(hydrateEntry).sort(byImportedAtDesc);
  }

  // Upsert one card by handle AND, for a weekly import, record its history
  // point — one atomic Lua EVAL (see UPSERT_LUA). Returns the full leaderboard
  // (newest first) read back after the write.
  async upsertEntry(entry: ImportedEntry): Promise<ImportedEntry[]> {
    const { handle, entryJson, isWeek, weekKey, pointJson } =
      await this.#mergeAndProject(entry);
    await this.#redis.eval(
      UPSERT_LUA,
      [LEADERBOARD_KEY, histKey(handle)],
      [handle, entryJson, isWeek ? "1" : "0", weekKey, pointJson, String(KEEP_PER_HANDLE)],
    );
    return this.readEntries();
  }

  // Claim-gated upsert (spec §2.3). One atomic EVAL (CLAIM_UPSERT_LUA): the
  // claim gate runs FIRST and the card/history writes are conditional on it
  // passing, so a mismatched/legacy/invalid claim changes nothing and the board
  // is not echoed back (caller can't read post-write state on a refusal).
  //
  // The token is format-validated and hashed HERE — never inside Lua (Q2c: we
  // pass an already-domain-separated `sha256-v1:<hex>` string, or "" for a
  // missing token, so the script needs no crypto and cannot hash junk). A
  // present-but-malformed token short-circuits to `invalid` before any Redis
  // call. The numerator precedence merge stays the pre-EVAL HGET→mergeNumerator
  // (non-atomic, accepted — see the CONCURRENCY note at top).
  async claimAndUpsert(
    entry: ImportedEntry,
    presentedToken: string | undefined,
  ): Promise<ClaimUpsertResult> {
    const provided =
      typeof presentedToken === "string" && presentedToken.length > 0;
    // A present-but-malformed token never reaches Redis and is never hashed.
    if (provided && !isValidTokenFormat(presentedToken)) {
      return { status: "invalid" };
    }
    const presented = provided
      ? `${CLAIM_SCHEME}:${hashToken(presentedToken)}`
      : "";

    const { handle, entryJson, isWeek, weekKey, pointJson } =
      await this.#mergeAndProject(entry);
    const raw = await this.#redis.eval(
      CLAIM_UPSERT_LUA,
      [LEADERBOARD_KEY, histKey(handle), CLAIMS_KEY],
      [
        handle,
        entryJson,
        isWeek ? "1" : "0",
        weekKey,
        pointJson,
        String(KEEP_PER_HANDLE),
        presented,
        LEGACY_LOCKED_STRING,
      ],
    );

    switch (Number(raw)) {
      case CODE.OK:
        return { status: "ok", entries: await this.readEntries() };
      case CODE.CLAIMED:
        return { status: "claimed", entries: await this.readEntries() };
      case CODE.MISMATCH:
        return { status: "mismatch" };
      case CODE.LEGACY:
        return { status: "legacyLocked" };
      case CODE.INVALID:
        return { status: "invalid" };
      // Unreachable: the script returns only 0–4. Fail closed (treat as a
      // refusal that wrote nothing) rather than reporting a false success.
      default:
        return { status: "mismatch" };
    }
  }

  // Shared pre-EVAL prep for upsertEntry + claimAndUpsert: precedence-merge the
  // VES numerator against the stored card (HGET → mergeNumerator, in TS not Lua
  // — see CONCURRENCY note), then project to the exact persisted shapes. Returns
  // the JSON strings the EVAL writes verbatim, so the two paths share one source
  // of truth for the card/history layout (incl. displayHandle).
  async #mergeAndProject(entry: ImportedEntry): Promise<{
    handle: string;
    entryJson: string;
    isWeek: boolean;
    weekKey: string;
    pointJson: string;
  }> {
    const stored = await this.#redis.hget<ImportedEntry>(
      LEADERBOARD_KEY,
      entry.handle,
    );
    const existing = stored == null ? undefined : hydrateEntry(stored);
    const merged: ImportedEntry = { ...entry, ...mergeNumerator(existing, entry) };

    const isWeek = merged.period === "week" && merged.since != null;
    const weekKey = isWeek ? (merged.since as string) : "";
    // Build the history point as a typed object — never spread `entry`. Carry
    // displayHandle onto the trend point only when it differs from the key.
    const point: ImportHistoryPoint | null = isWeek
      ? {
          handle: merged.handle,
          weekKey,
          totalTokens: merged.totalTokens,
          importedAt: merged.importedAt,
          ...(merged.displayHandle != null
            ? { displayHandle: merged.displayHandle }
            : {}),
        }
      : null;

    return {
      handle: merged.handle,
      entryJson: JSON.stringify(projectEntry(merged)),
      isWeek,
      weekKey,
      pointJson: point == null ? "" : JSON.stringify(point),
    };
  }

  // Every weekly history point across all handles. The handle universe comes
  // from the leaderboard's fields: every history write is paired with a
  // leaderboard write, so leaderboard handles ⊇ history handles.
  async readHistory(): Promise<ImportHistoryPoint[]> {
    const handles = await this.#redis.hkeys(LEADERBOARD_KEY);
    if (handles.length === 0) return [];
    const hashes = await Promise.all(
      handles.map((h) =>
        this.#redis.hgetall<Record<string, ImportHistoryPoint>>(histKey(h)),
      ),
    );
    const points: ImportHistoryPoint[] = [];
    for (const hash of hashes) {
      if (hash != null) points.push(...Object.values(hash));
    }
    return points;
  }
}
