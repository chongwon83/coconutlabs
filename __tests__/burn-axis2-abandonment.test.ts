// burn-axis2-abandonment.test.ts — verifies Axis 2 abandonment calculation.
//
// Abandonment = Math.max(0, started - completed - failed)
// Checks:
//   1. Normal: started=5, completed=3, failed=1 → abandoned=1
//   2. Zero: started=2, completed=1, failed=1 → abandoned=0
//   3. Clamp: skew case started < completed + failed → abandoned=0 (no negative)
//   4. All started, none resolved → abandoned=started
//   5. No events → abandoned=0

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  recordAutoDetectStarted,
  recordAutoDetectCompleted,
  recordAutoDetectFailed,
  getMetricsSnapshot,
} from "@/lib/server/burn/metrics";

// ── Redis mock ────────────────────────────────────────────────────────────────

const store: Map<string, Map<string, number>> = new Map();

const mockRedis = {
  sadd: vi.fn(async () => 0),
  scard: vi.fn(async () => 0),
  hincrby: vi.fn(async (key: string, field: string, increment: number) => {
    const hash = store.get(key) ?? new Map<string, number>();
    const cur = hash.get(field) ?? 0;
    hash.set(field, cur + increment);
    store.set(key, hash);
    return cur + increment;
  }),
  hgetall: vi.fn(async (key: string) => {
    const hash = store.get(key);
    if (!hash) return null;
    const out: Record<string, string> = {};
    for (const [k, v] of hash) out[k] = String(v);
    return out;
  }),
};

vi.mock("@upstash/redis", () => ({
  Redis: { fromEnv: () => mockRedis },
}));

beforeEach(() => {
  store.clear();
  vi.resetAllMocks();
  mockRedis.hincrby.mockImplementation(async (key: string, field: string, increment: number) => {
    const hash = store.get(key) ?? new Map<string, number>();
    const cur = hash.get(field) ?? 0;
    hash.set(field, cur + increment);
    store.set(key, hash);
    return cur + increment;
  });
  mockRedis.hgetall.mockImplementation(async (key: string) => {
    const hash = store.get(key);
    if (!hash) return null;
    const out: Record<string, string> = {};
    for (const [k, v] of hash) out[k] = String(v);
    return out;
  });
  process.env.UPSTASH_REDIS_REST_URL = "https://test.upstash.io";
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fire(started: number, completed: number, failed: number) {
  for (let i = 0; i < started; i++) await recordAutoDetectStarted();
  for (let i = 0; i < completed; i++) await recordAutoDetectCompleted("0-1m");
  for (let i = 0; i < failed; i++) await recordAutoDetectFailed("0-1m");
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Axis 2 abandonment calculation", () => {
  it("normal case: 5 started, 3 completed, 1 failed → abandoned=1", async () => {
    await fire(5, 3, 1);
    const snap = await getMetricsSnapshot();
    expect(snap.axis2.started).toBe(5);
    expect(snap.axis2.completed).toBe(3);
    expect(snap.axis2.failed).toBe(1);
    expect(snap.axis2.abandoned).toBe(1);
  });

  it("zero abandonment: 2 started, 1 completed, 1 failed → abandoned=0", async () => {
    await fire(2, 1, 1);
    const snap = await getMetricsSnapshot();
    expect(snap.axis2.abandoned).toBe(0);
  });

  it("clamps to 0 when counters skew (completed+failed > started)", async () => {
    // Simulate counter skew: manually set completed+failed > started
    await fire(1, 0, 0);
    // Record two completions (possible in edge case / counter skew)
    await recordAutoDetectCompleted("0-1m");
    await recordAutoDetectCompleted("0-1m");
    const snap = await getMetricsSnapshot();
    // started=1, completed=2, failed=0 → Math.max(0, 1-2-0) = 0
    expect(snap.axis2.abandoned).toBe(0);
  });

  it("all started, none resolved → abandoned=started", async () => {
    await fire(4, 0, 0);
    const snap = await getMetricsSnapshot();
    expect(snap.axis2.abandoned).toBe(4);
  });

  it("no events → all zeros including abandoned", async () => {
    const snap = await getMetricsSnapshot();
    expect(snap.axis2.started).toBe(0);
    expect(snap.axis2.completed).toBe(0);
    expect(snap.axis2.failed).toBe(0);
    expect(snap.axis2.abandoned).toBe(0);
  });
});
