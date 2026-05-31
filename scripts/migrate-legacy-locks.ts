#!/usr/bin/env tsx
// scripts/migrate-legacy-locks.ts — A5 key-canonicalizing migration runner.
//
// THE A5 PROBLEM (see lib/server/burnStore/migrate.ts for the full writeup):
// before PR2 the route stored handles RAW, so `@Foo` / `Foo` / `FOO` each became
// their own leaderboard field + `burn:hist:<raw>` key. PR2's claimAndUpsert writes
// the CANONICAL key (`foo`). The first canonical upsert of a legacy handle would
// SPLIT every row (stale raw orphan + new canonical row) AND make its trend vanish
// (Redis readHistory discovers hist keys FROM leaderboard fields). This one-time
// migration collapses every raw alias onto its canonical key BEFORE the gate flips
// to enforcing, then legacy-locks each canonical handle (grandfathered: no token
// was minted at upload time, so v1 recovery is manual).
//
// ALL decision logic is the PURE planner (migrate.ts) + executors (migrateExec.ts),
// both unit-tested without a live Redis. This script is only operational glue:
// argv → Upstash client / `.data` → the tested functions, plus snapshots.
//
// RUN (tsx resolves the `@/*` tsconfig path — run from the web/ directory):
//   pnpm dlx tsx scripts/migrate-legacy-locks.ts --dry-run [redis|file]
//   pnpm dlx tsx scripts/migrate-legacy-locks.ts --snapshot ./tmp/pre.json [redis|file]
//   MIGRATE_APPROVED=1 pnpm dlx tsx scripts/migrate-legacy-locks.ts --apply [redis|file]
//   pnpm dlx tsx scripts/migrate-legacy-locks.ts --restore ./tmp/pre.json [redis|file]
//
//   Second positional selects the target store; default `redis` (prod Upstash).
//   `file` operates on the local `.data` dir (dev / parity checks).
//
// APPROVAL GATE: --apply requires MIGRATE_APPROVED=1 in the shell env (NOT .env).
// SAFETY: --apply ALWAYS writes an auto-snapshot to ./tmp/migrate-pre-<ts>/ first.
// IDEMPOTENT: the plan skips already-canonical + legacy-locked groups; a crashed
//   rerun with residual raw aliases still cleans them (see migrate.ts).
//
// DEPLOY (D-b, zero public-claimable window): merge with CLAIM_MODE=
//   claims_disabled_readonly (uploads 503) → run --dry-run → review renames +
//   collisions → --apply → verify → flip CLAIM_MODE=claims_enforcing → redeploy.
//   The readonly window guarantees NO concurrent writer, which is what makes the
//   --restore full-region replace below safe.
//
// SECURITY: never logs a claim TOKEN (it only ever writes the metadata-thin
//   `legacy-locked` marker) and never reads the raw upload envelope, paths, or
//   secrets — only already-derived stored shapes.

import { Redis } from "@upstash/redis";
import { mkdirSync, writeFileSync, readFileSync, cpSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import type { ImportedEntry } from "@/lib/data";
import type { ImportHistoryPoint } from "@/lib/server/burnStore/types";
import { canonicalHandle } from "@/lib/server/handle";
import { renderPlan } from "@/lib/server/burnStore/migrate";
import {
  LEADERBOARD_KEY,
  CLAIMS_KEY,
  histKey,
  planFromRedis,
  planRedisOps,
  runRedisOps,
  planFromFile,
  buildFileState,
  writeFileState,
  type RedisLike,
} from "@/lib/server/burnStore/migrateExec";

type Target = "redis" | "file";

// ── Redis client (mirror of backfill-breakdown.ts) ────────────────────────────

function makeRedis(): Redis {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error(
      "Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN. " +
        "Load .env.local before running: source .env.local",
    );
  }
  return new Redis({ url, token });
}

// @upstash/redis satisfies RedisLike structurally; a thin adapter pins the exact
// shape the executor expects (and keeps the generics from fighting).
function asRedisLike(redis: Redis): RedisLike {
  return {
    hgetall<T = unknown>(key: string) {
      return redis.hgetall(key) as Promise<Record<string, T> | null>;
    },
    hkeys: (key) => redis.hkeys(key),
    hset: (key, kv) => redis.hset(key, kv),
    hdel: (key, ...fields) => redis.hdel(key, ...fields),
    del: (key) => redis.del(key),
  };
}

// ── Redis snapshot / restore (wide scope: leaderboard + claims + every touched
//    hist key — exactly the rename/collision blast radius). ─────────────────────

interface RedisSnapshot {
  leaderboard: Record<string, ImportedEntry>;
  claims: Record<string, string>;
  hist: Record<string, Record<string, ImportHistoryPoint>>; // histKey → weekKey → point
}

async function snapshotRedis(redis: Redis): Promise<RedisSnapshot> {
  const leaderboard = (await redis.hgetall<Record<string, ImportedEntry>>(LEADERBOARD_KEY)) ?? {};
  const claims = (await redis.hgetall<Record<string, string>>(CLAIMS_KEY)) ?? {};
  // The hist universe is exactly readHistory's: discover keys FROM leaderboard
  // fields. Anything not anchored by a leaderboard field is unreachable anyway.
  const hist: RedisSnapshot["hist"] = {};
  for (const rawHandle of Object.keys(leaderboard)) {
    const hash = await redis.hgetall<Record<string, ImportHistoryPoint>>(histKey(rawHandle));
    if (hash != null) hist[histKey(rawHandle)] = hash;
  }
  return { leaderboard, claims, hist };
}

function writeRedisSnapshot(outPath: string, snap: RedisSnapshot): void {
  const abs = resolve(outPath);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, JSON.stringify(snap, null, 2), "utf-8");
  console.log(`[migrate] redis snapshot → ${abs}`);
}

async function restoreRedis(redis: Redis, snapshotPath: string): Promise<void> {
  const snap: RedisSnapshot = JSON.parse(readFileSync(resolve(snapshotPath), "utf-8"));

  // Full-region replace (safe: the readonly deploy window has no concurrent
  // writer). Clear then re-seed leaderboard + claims.
  await redis.del(LEADERBOARD_KEY);
  if (Object.keys(snap.leaderboard).length > 0) {
    const fields: Record<string, string> = {};
    for (const [h, e] of Object.entries(snap.leaderboard)) fields[h] = JSON.stringify(e);
    await redis.hset(LEADERBOARD_KEY, fields);
  }
  await redis.del(CLAIMS_KEY);
  if (Object.keys(snap.claims).length > 0) {
    await redis.hset(CLAIMS_KEY, snap.claims); // scheme strings, stored verbatim
  }

  // Clear every hist key the migration could have touched: the snapshotted raw
  // keys PLUS the canonical targets it may have created (derivable from snapshot
  // leaderboard fields). Then re-seed only the snapshotted keys.
  const toClear = new Set<string>(Object.keys(snap.hist));
  for (const rawHandle of Object.keys(snap.leaderboard)) {
    const canonical = canonicalHandle(rawHandle);
    if (canonical != null) toClear.add(histKey(canonical));
  }
  for (const key of toClear) await redis.del(key);
  for (const [key, hash] of Object.entries(snap.hist)) {
    if (Object.keys(hash).length === 0) continue;
    const fields: Record<string, string> = {};
    for (const [wk, p] of Object.entries(hash)) fields[wk] = JSON.stringify(p);
    await redis.hset(key, fields);
  }
  console.log(
    `[migrate] redis restored: ${Object.keys(snap.leaderboard).length} entries, ` +
      `${Object.keys(snap.claims).length} claims, ${Object.keys(snap.hist).length} hist keys`,
  );
}

// ── File snapshot / restore (the three .data files). ──────────────────────────

function dataDir(): string {
  return resolve(process.cwd(), ".data");
}

function snapshotFile(outDir: string): void {
  const abs = resolve(outDir);
  mkdirSync(abs, { recursive: true });
  for (const name of ["leaderboard.json", "import-history.json", "claims.json"]) {
    const src = join(dataDir(), name);
    if (existsSync(src)) cpSync(src, join(abs, name));
  }
  console.log(`[migrate] .data snapshot → ${abs}`);
}

function restoreFile(snapshotDir: string): void {
  const abs = resolve(snapshotDir);
  mkdirSync(dataDir(), { recursive: true });
  for (const name of ["leaderboard.json", "import-history.json", "claims.json"]) {
    const src = join(abs, name);
    if (existsSync(src)) cpSync(src, join(dataDir(), name));
  }
  console.log(`[migrate] .data restored from ${abs}`);
}

// ── Commands ──────────────────────────────────────────────────────────────────

function nowIso(): string {
  return new Date().toISOString();
}

function autoSnapshotDir(): string {
  return resolve(`./tmp/migrate-pre-${nowIso().replace(/[:.]/g, "-")}`);
}

async function dryRun(target: Target): Promise<void> {
  console.log(`[migrate] DRY-RUN (${target}) — no writes\n`);
  if (target === "redis") {
    const plan = await planFromRedis(asRedisLike(makeRedis()));
    console.log(renderPlan(plan).join("\n"));
  } else {
    const { plan } = await planFromFile(process.cwd());
    console.log(renderPlan(plan).join("\n"));
  }
}

async function apply(target: Target): Promise<void> {
  if (process.env.MIGRATE_APPROVED !== "1") {
    console.error(
      "[migrate] BLOCKED: set MIGRATE_APPROVED=1 in your shell (NOT .env) after reviewing --dry-run output",
    );
    process.exit(1);
  }
  const snapDir = autoSnapshotDir();
  mkdirSync(snapDir, { recursive: true });

  if (target === "redis") {
    const redis = makeRedis();
    // Auto-snapshot the full blast radius BEFORE any write.
    writeRedisSnapshot(join(snapDir, "redis-snapshot.json"), await snapshotRedis(redis));

    const plan = await planFromRedis(asRedisLike(redis));
    console.log(renderPlan(plan).join("\n"));
    const ops = planRedisOps(plan);
    console.log(`\n[migrate] executing ${ops.length} redis ops...`);
    await runRedisOps(asRedisLike(redis), ops);
    console.log(`[migrate] redis apply complete. Restore with: --restore ${join(snapDir, "redis-snapshot.json")} redis`);
  } else {
    const cwd = process.cwd();
    snapshotFile(snapDir); // auto-snapshot .data

    const { plan, snapshot } = await planFromFile(cwd);
    console.log(renderPlan(plan).join("\n"));
    const state = buildFileState(plan, snapshot, nowIso());
    await writeFileState(cwd, state);
    console.log(`[migrate] .data apply complete. Restore with: --restore ${snapDir} file`);
  }
}

// ── CLI entry (unconditional run, like backfill-breakdown.ts; the testable logic
//    lives in migrateExec.ts, which the tests import directly — never this file). ─

const [, , cmd, ...rest] = process.argv;

function resolveTarget(args: string[]): Target {
  const t = args.find((a) => a === "redis" || a === "file");
  return (t as Target) ?? "redis";
}

function usage(): never {
  console.error(
    "Usage (run from web/):\n" +
      "  pnpm dlx tsx scripts/migrate-legacy-locks.ts --dry-run [redis|file]\n" +
      "  pnpm dlx tsx scripts/migrate-legacy-locks.ts --snapshot <path|dir> [redis|file]\n" +
      "  MIGRATE_APPROVED=1 pnpm dlx tsx scripts/migrate-legacy-locks.ts --apply [redis|file]\n" +
      "  pnpm dlx tsx scripts/migrate-legacy-locks.ts --restore <path|dir> [redis|file]",
  );
  process.exit(1);
}

async function main(): Promise<void> {
  const target = resolveTarget(rest);
  const pathArg = rest.find((a) => a !== "redis" && a !== "file");

  switch (cmd) {
    case "--dry-run":
      await dryRun(target);
      break;
    case "--snapshot":
      if (!pathArg) usage();
      if (target === "redis") writeRedisSnapshot(pathArg, await snapshotRedis(makeRedis()));
      else snapshotFile(pathArg);
      break;
    case "--apply":
      await apply(target);
      break;
    case "--restore":
      if (!pathArg) usage();
      if (target === "redis") await restoreRedis(makeRedis(), pathArg);
      else restoreFile(pathArg);
      break;
    default:
      usage();
  }
}

void main();
