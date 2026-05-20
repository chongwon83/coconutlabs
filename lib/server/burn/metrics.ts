// lib/server/burn/metrics.ts — rollout gate measurement store (Axes 1–3).
//
// All writes are fire-and-forget: a metrics failure must NEVER break the
// leaderboard POST. Callers wrap in try/catch or use the safe wrappers below.
//
// SECURITY: no raw content, paths, or secrets ever reach this module.
// - Axis 1 stores only 12-char lowercase hex project_hash values (already
//   validated by validateSummary before route.ts calls recordSubmission).
// - Axis 2/3 stores only enum field values from validated telemetry events.
//
// Redis schema (all keys under burn:metrics: namespace):
//   burn:metrics:axis1         SET  — distinct project_hash values
//   burn:metrics:agg           HASH — numeric counters (see field names below)

import { Redis } from "@upstash/redis";

const AXIS1_KEY = "burn:metrics:axis1";
const AGG_KEY = "burn:metrics:agg";

// AGG hash field names
const AXIS2_STARTED = "axis2:started";
const AXIS2_COMPLETED = "axis2:completed";
const AXIS2_FAILED = "axis2:failed";
const axis2Bucket = (b: string) => `axis2:bucket:${b}`;
const axis3Step = (s: string) => `axis3:step:${s}`;
const AXIS3_TOTAL = "axis3:total";

let _redis: Redis | undefined;

function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL) return null;
  if (_redis === undefined) _redis = Redis.fromEnv();
  return _redis;
}

// ── Axis 1 ────────────────────────────────────────────────────────────────────

// Record project_hash values from a successful /api/burnindex POST.
// Deduplication is handled by the Redis SET — SADD is idempotent.
// projectHashes must be pre-validated 12-char lowercase hex strings.
export async function recordSubmission(projectHashes: string[]): Promise<void> {
  const redis = getRedis();
  if (!redis || projectHashes.length === 0) return;
  // Upstash sadd: sadd(key, member, ...members)
  await (redis.sadd as (key: string, ...members: string[]) => Promise<number>)(
    AXIS1_KEY,
    ...projectHashes,
  );
}

// Returns the count of distinct project_hash values recorded so far.
export async function getAxis1Count(): Promise<number> {
  const redis = getRedis();
  if (!redis) return 0;
  const n = await redis.scard(AXIS1_KEY);
  return typeof n === "number" ? n : 0;
}

// ── Axis 2 ────────────────────────────────────────────────────────────────────

export async function recordAutoDetectStarted(): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.hincrby(AGG_KEY, AXIS2_STARTED, 1);
}

export async function recordAutoDetectCompleted(durationBucket: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.hincrby(AGG_KEY, AXIS2_COMPLETED, 1);
  await redis.hincrby(AGG_KEY, axis2Bucket(durationBucket), 1);
}

export async function recordAutoDetectFailed(durationBucket: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.hincrby(AGG_KEY, AXIS2_FAILED, 1);
  await redis.hincrby(AGG_KEY, axis2Bucket(durationBucket), 1);
}

// ── Axis 3 ────────────────────────────────────────────────────────────────────

export async function recordSurveyResponse(hardestStep: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.hincrby(AGG_KEY, AXIS3_TOTAL, 1);
  await redis.hincrby(AGG_KEY, axis3Step(hardestStep), 1);
}

// ── Aggregate read (for rollout-gate-metrics API) ─────────────────────────────

export interface MetricsSnapshot {
  axis1DistinctCount: number;
  axis2: {
    started: number;
    completed: number;
    failed: number;
    buckets: Record<string, number>;
  };
  axis3: {
    total: number;
    steps: Record<string, number>;
  };
}

const DURATION_BUCKETS = ["0-1m", "1-3m", "3-5m", "5-10m", "10-20m", "20m+"];
const HARDEST_STEPS = [
  "terminal_setup",
  "folder_selection",
  "browser_permission",
  "upload",
  "understanding_results",
  "other_predefined",
];

export async function getMetricsSnapshot(): Promise<MetricsSnapshot> {
  const redis = getRedis();

  const [axis1Count, agg] = await Promise.all([
    getAxis1Count(),
    redis
      ? redis.hgetall<Record<string, string>>(AGG_KEY)
      : Promise.resolve(null),
  ]);

  const toNum = (v: string | undefined) => (v ? parseInt(v, 10) || 0 : 0);
  const a = agg ?? {};

  const buckets: Record<string, number> = {};
  for (const b of DURATION_BUCKETS) {
    buckets[b] = toNum(a[axis2Bucket(b)]);
  }

  const steps: Record<string, number> = {};
  for (const s of HARDEST_STEPS) {
    steps[s] = toNum(a[axis3Step(s)]);
  }

  return {
    axis1DistinctCount: axis1Count,
    axis2: {
      started: toNum(a[AXIS2_STARTED]),
      completed: toNum(a[AXIS2_COMPLETED]),
      failed: toNum(a[AXIS2_FAILED]),
      buckets,
    },
    axis3: {
      total: toNum(a[AXIS3_TOTAL]),
      steps,
    },
  };
}
