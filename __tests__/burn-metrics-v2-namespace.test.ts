// burn-metrics-v2-namespace.test.ts — verifies that metrics.ts uses v2 Redis keys only.
//
// Checks:
//   1. recordSubmission writes to burn:metrics:v2:axis1 (not v1 key)
//   2. recordAutoDetectStarted/Completed/Failed write to burn:metrics:v2:agg
//   3. getMetricsSnapshot reads from v2 keys (v1 key never touched)
//   4. v1 keys (burn:metrics:axis1, burn:metrics:agg) are never read or written

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  recordSubmission,
  getAxis1Count,
  recordAutoDetectStarted,
  recordAutoDetectCompleted,
  recordAutoDetectFailed,
  recordSurveyResponse,
  getMetricsSnapshot,
} from "@/lib/server/burn/metrics";

// ── Tracked mock ──────────────────────────────────────────────────────────────

const accessedKeys = new Set<string>();
const store: Map<string, unknown> = new Map();

const mockRedis = {
  sadd: vi.fn(async (key: string, ...members: string[]) => {
    accessedKeys.add(key);
    const set = (store.get(key) as Set<string>) ?? new Set<string>();
    let added = 0;
    for (const m of members) if (!set.has(m)) { set.add(m); added++; }
    store.set(key, set);
    return added;
  }),
  scard: vi.fn(async (key: string) => {
    accessedKeys.add(key);
    const set = store.get(key) as Set<string> | undefined;
    return set ? set.size : 0;
  }),
  hincrby: vi.fn(async (key: string, field: string, increment: number) => {
    accessedKeys.add(key);
    const hash = (store.get(key) as Map<string, number>) ?? new Map<string, number>();
    const cur = hash.get(field) ?? 0;
    hash.set(field, cur + increment);
    store.set(key, hash);
    return cur + increment;
  }),
  hgetall: vi.fn(async (key: string) => {
    accessedKeys.add(key);
    const hash = store.get(key) as Map<string, number> | undefined;
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
  accessedKeys.clear();
  store.clear();
  vi.resetAllMocks();
  // Re-wire after reset
  mockRedis.sadd.mockImplementation(async (key: string, ...members: string[]) => {
    accessedKeys.add(key);
    const set = (store.get(key) as Set<string>) ?? new Set<string>();
    let added = 0;
    for (const m of members) if (!set.has(m)) { set.add(m); added++; }
    store.set(key, set);
    return added;
  });
  mockRedis.scard.mockImplementation(async (key: string) => {
    accessedKeys.add(key);
    return ((store.get(key) as Set<string>)?.size) ?? 0;
  });
  mockRedis.hincrby.mockImplementation(async (key: string, field: string, increment: number) => {
    accessedKeys.add(key);
    const hash = (store.get(key) as Map<string, number>) ?? new Map<string, number>();
    const cur = hash.get(field) ?? 0;
    hash.set(field, cur + increment);
    store.set(key, hash);
    return cur + increment;
  });
  mockRedis.hgetall.mockImplementation(async (key: string) => {
    accessedKeys.add(key);
    const hash = store.get(key) as Map<string, number> | undefined;
    if (!hash) return null;
    const out: Record<string, string> = {};
    for (const [k, v] of hash) out[k] = String(v);
    return out;
  });
  // Provide Redis env so getRedis() doesn't short-circuit to null
  process.env.UPSTASH_REDIS_REST_URL = "https://test.upstash.io";
});

// ── Tests ─────────────────────────────────────────────────────────────────────

const V1_AXIS1 = "burn:metrics:axis1";
const V1_AGG = "burn:metrics:agg";
const V2_AXIS1 = "burn:metrics:v2:axis1";
const V2_AGG = "burn:metrics:v2:agg";

describe("namespace isolation — Axis 1", () => {
  it("recordSubmission writes to v2 axis1 key, not v1", async () => {
    await recordSubmission(["aabbccddeeff"]);
    expect(accessedKeys.has(V2_AXIS1)).toBe(true);
    expect(accessedKeys.has(V1_AXIS1)).toBe(false);
  });

  it("getAxis1Count reads from v2 axis1 key, not v1", async () => {
    await recordSubmission(["aabbccddeeff", "112233445566"]);
    accessedKeys.clear();
    const count = await getAxis1Count();
    expect(count).toBe(2);
    expect(accessedKeys.has(V2_AXIS1)).toBe(true);
    expect(accessedKeys.has(V1_AXIS1)).toBe(false);
  });
});

describe("namespace isolation — Axis 2 & 3", () => {
  it("recordAutoDetectStarted writes to v2 agg key, not v1", async () => {
    await recordAutoDetectStarted();
    expect(accessedKeys.has(V2_AGG)).toBe(true);
    expect(accessedKeys.has(V1_AGG)).toBe(false);
  });

  it("recordAutoDetectCompleted writes to v2 agg key, not v1", async () => {
    await recordAutoDetectCompleted("1-3m");
    expect(accessedKeys.has(V2_AGG)).toBe(true);
    expect(accessedKeys.has(V1_AGG)).toBe(false);
  });

  it("recordAutoDetectFailed writes to v2 agg key, not v1", async () => {
    await recordAutoDetectFailed("0-1m");
    expect(accessedKeys.has(V2_AGG)).toBe(true);
    expect(accessedKeys.has(V1_AGG)).toBe(false);
  });

  it("recordSurveyResponse writes to v2 agg key, not v1", async () => {
    await recordSurveyResponse("terminal_setup");
    expect(accessedKeys.has(V2_AGG)).toBe(true);
    expect(accessedKeys.has(V1_AGG)).toBe(false);
  });
});

describe("namespace isolation — getMetricsSnapshot", () => {
  it("reads from v2 keys only, never touches v1 keys", async () => {
    await recordSubmission(["aabbccddeeff"]);
    await recordAutoDetectStarted();
    await recordAutoDetectCompleted("3-5m");
    accessedKeys.clear();

    const snapshot = await getMetricsSnapshot();
    expect(snapshot.axis1DistinctCount).toBe(1);
    expect(accessedKeys.has(V2_AXIS1)).toBe(true);
    expect(accessedKeys.has(V2_AGG)).toBe(true);
    expect(accessedKeys.has(V1_AXIS1)).toBe(false);
    expect(accessedKeys.has(V1_AGG)).toBe(false);
  });
});
