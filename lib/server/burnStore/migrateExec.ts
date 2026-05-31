// burnStore/migrateExec.ts — IO executors for the A5 migration plan.
//
// planMigration (migrate.ts) is PURE: it decides WHAT changes. This module turns
// a plan into concrete writes for each backing store, kept as thin and testable
// as possible:
//   - Redis: planRedisOps() emits an ORDERED op list as DATA (no client needed),
//     so the crash-safe ordering is asserted in a unit test; runRedisOps() just
//     executes it against any RedisLike (the real Upstash client OR a fake).
//   - File: buildFileState() is PURE (plan + snapshot → the three .data arrays);
//     writeFileState() is the only fs side effect.
//
// CRASH-SAFE ORDER (per migrate group): HSET canonical card → HSET canonical
// history → HDEL stale canonical weekKeys → DEL raw alias hist keys → HDEL raw
// alias leaderboard fields → HSET claim LAST. The raw HIST keys are deleted
// BEFORE the raw LEADERBOARD fields on purpose: readHistory() discovers hist keys
// FROM leaderboard fields, so deleting the leaderboard field first would orphan
// the hist key undiscoverable by a re-run. (This deliberately tightens the plan's
// step 6/7 ordering — see migrate.ts.) Canonical writes precede every deletion,
// so a crash never loses data; a re-run re-plans any residual alias and converges.

import { promises as fs } from "node:fs";
import path from "node:path";
import type { ImportedEntry } from "@/lib/data";
import { atomicWriteJson } from "@/lib/server/atomic";
import {
  LEGACY_LOCKED_STRING,
  makeLegacyRecord,
  parseSchemeString,
} from "@/lib/server/claim";
import type { ClaimRecord } from "@/lib/server/claim";
import { canonicalHandle } from "@/lib/server/handle";
import { planMigration } from "@/lib/server/burnStore/migrate";
import type {
  ClaimState,
  MigrationPlan,
  RawCard,
  RawHistory,
} from "@/lib/server/burnStore/migrate";
import type { ImportHistoryPoint } from "@/lib/server/burnStore/types";

// Redis key layout — MUST match redisStore.ts (kept in sync, like the cleanup
// script's mirror constants).
export const LEADERBOARD_KEY = "burn:leaderboard";
export const CLAIMS_KEY = "burn:claims:v1";
export const histKey = (handle: string): string => `burn:hist:${handle}`;

// The minimal Redis surface the executor needs. @upstash/redis's Redis satisfies
// it structurally; tests inject a fake that records calls. Reads auto-parse JSON
// (Upstash behaviour), so hgetall yields objects, not strings.
export interface RedisLike {
  hgetall<T = unknown>(key: string): Promise<Record<string, T> | null>;
  hkeys(key: string): Promise<string[]>;
  hset(key: string, kv: Record<string, string>): Promise<number>;
  hdel(key: string, ...fields: string[]): Promise<number>;
  del(key: string): Promise<number>;
}

export type RedisOp =
  | { op: "hset"; key: string; field: string; value: string }
  | { op: "hdel"; key: string; field: string }
  | { op: "del"; key: string };

// ── Redis path ────────────────────────────────────────────────────────────────

/**
 * Read a wide snapshot from Redis and shape it into planMigration's input. The
 * hist universe comes from leaderboard fields (same discovery as readHistory) so
 * the plan sees exactly the keys the app would.
 */
export async function readRedisSnapshot(
  redis: RedisLike,
): Promise<{ cards: RawCard[]; histories: RawHistory[]; claims: Record<string, string> }> {
  const board = (await redis.hgetall<ImportedEntry>(LEADERBOARD_KEY)) ?? {};
  const cards: RawCard[] = Object.entries(board).map(([rawHandle, entry]) => ({
    rawHandle,
    entry,
  }));

  const rawHandles = await redis.hkeys(LEADERBOARD_KEY);
  const histories: RawHistory[] = [];
  for (const rawHandle of rawHandles) {
    const hash = await redis.hgetall<ImportHistoryPoint>(histKey(rawHandle));
    histories.push({ rawHandle, points: hash == null ? [] : Object.values(hash) });
  }

  const claims = (await redis.hgetall<string>(CLAIMS_KEY)) ?? {};
  return { cards, histories, claims };
}

/** Map a Redis claims hash (scheme strings) to the planner's claimState lookup. */
export function redisClaimState(
  claims: Record<string, string>,
): (canonical: string) => ClaimState {
  return (canonical) => {
    const raw = claims[canonical];
    if (raw == null) return "none";
    const parsed = parseSchemeString(raw);
    if (parsed == null) return "legacyLocked"; // corrupt → fail safe to locked
    return parsed.kind === "active" ? "active" : "legacyLocked";
  };
}

/**
 * The ordered Redis write ops for a plan. PURE — emits data, executes nothing, so
 * a test can assert the crash-safe ordering without a client. Skip/active groups
 * emit nothing.
 */
export function planRedisOps(plan: MigrationPlan): RedisOp[] {
  const ops: RedisOp[] = [];
  for (const g of plan.groups) {
    if (g.status !== "migrate") continue;

    // 1. Canonical card.
    if (g.canonicalCard != null) {
      ops.push({
        op: "hset",
        key: LEADERBOARD_KEY,
        field: g.canonical,
        value: JSON.stringify(g.canonicalCard),
      });
    }
    // 2. Canonical history (merged points).
    for (const point of g.canonicalHistory) {
      ops.push({
        op: "hset",
        key: histKey(g.canonical),
        field: point.weekKey,
        value: JSON.stringify(point),
      });
    }
    // 3. Drop stale canonical weekKeys (collision losers / trimmed).
    for (const wk of g.staleCanonicalWeekKeys) {
      ops.push({ op: "hdel", key: histKey(g.canonical), field: wk });
    }
    // 4. Delete raw alias hist keys — BEFORE the leaderboard HDEL (else the hist
    //    key becomes undiscoverable by a re-run).
    for (const rawAlias of g.removeHistKeys) {
      ops.push({ op: "del", key: histKey(rawAlias) });
    }
    // 5. Delete raw alias leaderboard fields.
    for (const rawAlias of g.removeCardFields) {
      ops.push({ op: "hdel", key: LEADERBOARD_KEY, field: rawAlias });
    }
    // 6. Legacy-lock the claim LAST.
    if (g.writeClaim) {
      ops.push({
        op: "hset",
        key: CLAIMS_KEY,
        field: g.canonical,
        value: LEGACY_LOCKED_STRING,
      });
    }
  }
  return ops;
}

/** Execute Redis ops in order. One round-trip per op — fine for a one-time run. */
export async function runRedisOps(redis: RedisLike, ops: RedisOp[]): Promise<void> {
  for (const op of ops) {
    if (op.op === "hset") {
      await redis.hset(op.key, { [op.field]: op.value });
    } else if (op.op === "hdel") {
      await redis.hdel(op.key, op.field);
    } else {
      await redis.del(op.key);
    }
  }
}

// ── File path ───────────────────────────────────────────────────────────────

const DATA_DIR = (cwd: string): string => path.join(cwd, ".data");
const STORE_PATH = (cwd: string): string => path.join(DATA_DIR(cwd), "leaderboard.json");
const HIST_PATH = (cwd: string): string => path.join(DATA_DIR(cwd), "import-history.json");
const CLAIMS_PATH = (cwd: string): string => path.join(DATA_DIR(cwd), "claims.json");

async function readJsonArray<T>(filePath: string): Promise<T[]> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

async function readJsonObject<T>(filePath: string): Promise<Record<string, T>> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    return parsed != null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, T>)
      : {};
  } catch {
    return {};
  }
}

export interface FileSnapshot {
  cards: RawCard[];
  histories: RawHistory[];
  claims: Record<string, ClaimRecord>;
}

/** Read .data/{leaderboard,import-history,claims}.json into planner input shape. */
export async function readFileSnapshot(cwd: string): Promise<FileSnapshot> {
  const board = await readJsonArray<ImportedEntry>(STORE_PATH(cwd));
  const cards: RawCard[] = board.map((entry) => ({ rawHandle: entry.handle, entry }));

  const points = await readJsonArray<ImportHistoryPoint>(HIST_PATH(cwd));
  const byRaw = new Map<string, ImportHistoryPoint[]>();
  for (const p of points) {
    const list = byRaw.get(p.handle) ?? [];
    list.push(p);
    byRaw.set(p.handle, list);
  }
  const histories: RawHistory[] = [...byRaw.entries()].map(([rawHandle, pts]) => ({
    rawHandle,
    points: pts,
  }));

  const claims = await readJsonObject<ClaimRecord>(CLAIMS_PATH(cwd));
  return { cards, histories, claims };
}

/** Map a file claims map (full ClaimRecord union) to the planner's claimState. */
export function fileClaimState(
  claims: Record<string, ClaimRecord>,
): (canonical: string) => ClaimState {
  return (canonical) => {
    const rec = claims[canonical];
    if (rec == null) return "none";
    return rec.kind === "active" ? "active" : "legacyLocked";
  };
}

/**
 * Rebuild the three .data structures from a plan + the pre-read snapshot. PURE —
 * the full new-state computation, no fs. skip-active groups, uncanonicalizable
 * cards/points, and orphan history are carried through UNCHANGED.
 */
export function buildFileState(
  plan: MigrationPlan,
  snapshot: FileSnapshot,
  now: string,
): {
  leaderboard: ImportedEntry[];
  history: ImportHistoryPoint[];
  claims: Record<string, ClaimRecord>;
} {
  // Index originals by canonical for skip-active / orphan carry-through.
  const cardsByCanonical = new Map<string, ImportedEntry[]>();
  for (const c of snapshot.cards) {
    const canonical = canonicalHandle(c.rawHandle);
    if (canonical == null) continue;
    const list = cardsByCanonical.get(canonical) ?? [];
    list.push(c.entry);
    cardsByCanonical.set(canonical, list);
  }
  const pointsByCanonical = new Map<string, ImportHistoryPoint[]>();
  for (const h of snapshot.histories) {
    const canonical = canonicalHandle(h.rawHandle);
    if (canonical == null) continue;
    const list = pointsByCanonical.get(canonical) ?? [];
    list.push(...h.points);
    pointsByCanonical.set(canonical, list);
  }

  const leaderboard: ImportedEntry[] = [];
  const history: ImportHistoryPoint[] = [];

  for (const g of plan.groups) {
    if (g.status === "skip-active-claim") {
      leaderboard.push(...(cardsByCanonical.get(g.canonical) ?? []));
      history.push(...(pointsByCanonical.get(g.canonical) ?? []));
      continue;
    }
    if (g.canonicalCard != null) leaderboard.push(g.canonicalCard);
    history.push(...g.canonicalHistory);
  }

  // Carry-through: orphan history (no card) and uncanonicalizable cards/points.
  for (const canonical of plan.orphanHistoryWithoutCard) {
    history.push(...(pointsByCanonical.get(canonical) ?? []));
  }
  for (const c of snapshot.cards) {
    if (canonicalHandle(c.rawHandle) == null) leaderboard.push(c.entry);
  }
  for (const h of snapshot.histories) {
    if (canonicalHandle(h.rawHandle) == null) history.push(...h.points);
  }

  leaderboard.sort((a, b) => b.importedAt.localeCompare(a.importedAt));

  const claims: Record<string, ClaimRecord> = { ...snapshot.claims };
  for (const g of plan.groups) {
    if (g.writeClaim) {
      claims[g.canonical] = makeLegacyRecord(g.canonical, g.collision, now);
    }
  }

  return { leaderboard, history, claims };
}

/** Persist the rebuilt file state atomically. */
export async function writeFileState(
  cwd: string,
  state: ReturnType<typeof buildFileState>,
): Promise<void> {
  await fs.mkdir(DATA_DIR(cwd), { recursive: true });
  await atomicWriteJson(STORE_PATH(cwd), state.leaderboard);
  await atomicWriteJson(HIST_PATH(cwd), state.history);
  await atomicWriteJson(CLAIMS_PATH(cwd), state.claims);
}

// ── Shared planning entry points (read snapshot → plan) ──────────────────────

export async function planFromRedis(redis: RedisLike): Promise<MigrationPlan> {
  const snap = await readRedisSnapshot(redis);
  return planMigration({
    cards: snap.cards,
    histories: snap.histories,
    claimState: redisClaimState(snap.claims),
  });
}

export async function planFromFile(cwd: string): Promise<{ plan: MigrationPlan; snapshot: FileSnapshot }> {
  const snapshot = await readFileSnapshot(cwd);
  const plan = planMigration({
    cards: snapshot.cards,
    histories: snapshot.histories,
    claimState: fileClaimState(snapshot.claims),
  });
  return { plan, snapshot };
}
