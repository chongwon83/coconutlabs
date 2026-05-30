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
import type {
  BurnStore,
  ImportHistoryPoint,
} from "@/lib/server/burnStore/types";

const LEADERBOARD_KEY = "burn:leaderboard";
const histKey = (handle: string) => `burn:hist:${handle}`;

const KEEP_PER_HANDLE = 12; // > trend WINDOW(7), caps history hash growth

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
    // Precedence-merge the VES numerator against the stored card BEFORE the
    // atomic write. This read-merge happens in TS (HGET → mergeNumerator), not
    // inside Lua — see the CONCURRENCY note at the top of this file. Only the
    // numerator (fixes/fixesSource) is merged; the merged blob then flows into
    // the SAME unchanged Lua EVAL, which still pairs leaderboard + history
    // writes indivisibly.
    const stored = await this.#redis.hget<ImportedEntry>(
      LEADERBOARD_KEY,
      entry.handle,
    );
    const existing = stored == null ? undefined : hydrateEntry(stored);
    const merged: ImportedEntry = { ...entry, ...mergeNumerator(existing, entry) };

    const isWeek = merged.period === "week" && merged.since != null;
    const weekKey = isWeek ? (merged.since as string) : "";
    // Build the history point as a typed object — never spread `entry`.
    const point: ImportHistoryPoint | null = isWeek
      ? {
          handle: merged.handle,
          weekKey,
          totalTokens: merged.totalTokens,
          importedAt: merged.importedAt,
        }
      : null;

    await this.#redis.eval(
      UPSERT_LUA,
      [LEADERBOARD_KEY, histKey(merged.handle)],
      [
        merged.handle,
        JSON.stringify(projectEntry(merged)),
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
}
