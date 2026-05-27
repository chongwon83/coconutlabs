// burnStore/redisStore.ts — BurnStore backed by Upstash Redis.
//
// This is the production implementation. Vercel's filesystem is ephemeral and
// per-instance, so the JSON-file store (fileStore) cannot persist across
// deploys or serialize writes across instances. Upstash Redis is the hosted
// shared home: getStore() picks this when UPSTASH_REDIS_REST_URL is present.
//
// CONCURRENCY: fileStore relied on withLock (an in-process promise chain) to
// make read-modify-write safe. That does not survive multiple instances. Here
// the leaderboard + history write is one atomic Lua EVAL — no read-modify-write
// race exists because the script runs indivisibly on the Redis server.
//
// SECURITY: persists ONLY the derived ImportedEntry / ImportHistoryPoint /
// ChallengeRecord shapes. Every value written below is an explicit
// JSON.stringify of a typed object — never a spread of unknown data. The raw
// envelope, raw content, file paths, repo names, and secrets never reach this
// layer (route.ts builds ImportedEntry via buildImportedEntry first).

import type { Redis } from "@upstash/redis";
import type { ImportedEntry } from "@/lib/data";
import type {
  BurnStore,
  ChallengeRecord,
  ImportHistoryPoint,
} from "@/lib/server/burnStore/types";

const LEADERBOARD_KEY = "burn:leaderboard";
const CHALLENGES_KEY = "burn:challenges";
const histKey = (handle: string) => `burn:hist:${handle}`;

const KEEP_PER_HANDLE = 12; // > trend WINDOW(7), caps history hash growth
const CHALLENGES_CAP = 500; // LTRIM bound — submission retention

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

// Atomic append + trim for a challenge submission — LPUSH then LTRIM in one
// indivisible script. As two separate REST calls, a failure between them would
// leave the list one element over CHALLENGES_CAP while the method still threw;
// a single EVAL closes that window.
//
//   KEYS[1] = burn:challenges     ARGV = recordJson, cap-1
const ADD_CHALLENGE_LUA = `
redis.call('LPUSH', KEYS[1], ARGV[1])
redis.call('LTRIM', KEYS[1], 0, tonumber(ARGV[2]))
return 1
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
  if (e.fixes !== undefined) stored.fixes = e.fixes;
  if (e.ves !== undefined) stored.ves = e.ves;
  if (e.trendDir !== undefined) stored.trendDir = e.trendDir;
  if (e.trendPct !== undefined) stored.trendPct = e.trendPct;
  if (e.trendSeries !== undefined) stored.trendSeries = e.trendSeries;
  return stored;
}

// Hydrate one entry read from Redis. Blobs may predate A.1 (no toolsUsed) or
// the B cycle (no breakdown). Coerce both missing values to `[]` before the
// entry hits any UI consumer or filter path.
function hydrateEntry(e: ImportedEntry): ImportedEntry {
  if (Array.isArray(e.toolsUsed) && Array.isArray(e.breakdown)) return e;
  return {
    ...e,
    toolsUsed: Array.isArray(e.toolsUsed) ? e.toolsUsed : [],
    breakdown: Array.isArray(e.breakdown) ? e.breakdown : [],
  };
}

// Same defence for ChallengeRecord — rebuild the 7 declared fields so no extra
// runtime property is ever serialized into the challenge list.
function projectChallenge(r: ChallengeRecord): ChallengeRecord {
  return {
    handle: r.handle,
    challenge: r.challenge,
    claimedFixes: r.claimedFixes,
    status: r.status,
    verifiedFixes: r.verifiedFixes,
    submittedAt: r.submittedAt,
    verifiedAt: r.verifiedAt,
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
    const isWeek = entry.period === "week" && entry.since != null;
    const weekKey = isWeek ? (entry.since as string) : "";
    // Build the history point as a typed object — never spread `entry`.
    const point: ImportHistoryPoint | null = isWeek
      ? {
          handle: entry.handle,
          weekKey,
          totalTokens: entry.totalTokens,
          importedAt: entry.importedAt,
        }
      : null;

    await this.#redis.eval(
      UPSERT_LUA,
      [LEADERBOARD_KEY, histKey(entry.handle)],
      [
        entry.handle,
        JSON.stringify(projectEntry(entry)),
        isWeek ? "1" : "0",
        weekKey,
        point == null ? "" : JSON.stringify(point),
        String(KEEP_PER_HANDLE),
      ],
    );

    return this.readEntries();
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

  // Every challenge submission, newest first (LPUSH order).
  async readChallenges(): Promise<ChallengeRecord[]> {
    return this.#redis.lrange<ChallengeRecord>(CHALLENGES_KEY, 0, -1);
  }

  // Append one submission (newest first) and trim to CHALLENGES_CAP — one
  // atomic Lua EVAL (see ADD_CHALLENGE_LUA), so a failure can never leave the
  // list over-cap. Never deduped — each claim is verified on its own. The
  // stored value is an explicit JSON.stringify of the projected
  // ChallengeRecord (projectChallenge blocks extra runtime properties).
  async addChallenge(record: ChallengeRecord): Promise<void> {
    await this.#redis.eval(
      ADD_CHALLENGE_LUA,
      [CHALLENGES_KEY],
      [JSON.stringify(projectChallenge(record)), String(CHALLENGES_CAP - 1)],
    );
  }
}
