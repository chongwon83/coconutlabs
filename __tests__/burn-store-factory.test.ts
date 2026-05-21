// burn-store-factory.test.ts — getStore() env-branch + memoization contract.
//
// getStore() is the single seam where "where does this data live?" is decided.
// Wrong branch in production = silent data loss (FileStore writes to Vercel's
// ephemeral /tmp; next deploy wipes it). Wrong branch in local dev = calls to
// a non-existent Redis URL and crash on every save.
//
// Branch rule (redisStore.ts comment):
//   - UPSTASH_REDIS_REST_URL present → RedisBurnStore
//   - absent                        → FileBurnStore
//
// MEMOIZATION: the factory builds the store on first call only. This test
// must use vi.resetModules() between cases because the cached store lives in
// module scope — without a reset, the second test would just see the first
// test's instance regardless of env.
//
// The @upstash/redis client requires URL + TOKEN at Redis.fromEnv() time, so
// when we set UPSTASH_REDIS_REST_URL we also set UPSTASH_REDIS_REST_TOKEN.
// (Both must be hex/url-shaped enough to pass the constructor — a placeholder
// string is fine since the test never makes a network call.)

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const ENV_KEYS = ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "BURN_STORE", "NODE_ENV"] as const;
const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
  // Clear cached module state so each test re-enters the factory cold.
  vi.resetModules();
});

afterEach(() => {
  const env = process.env as Record<string, string | undefined>;
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete env[k];
    else env[k] = savedEnv[k];
  }
});

describe("getStore — env branch selection", () => {
  it("returns a FileBurnStore when UPSTASH_REDIS_REST_URL is absent (local dev)", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const { getStore } = await import("@/lib/server/burnStore/index");
    const { FileBurnStore } = await import("@/lib/server/burnStore/fileStore");

    const store = getStore();
    expect(store).toBeInstanceOf(FileBurnStore);
  });

  it("returns a FileBurnStore when UPSTASH_REDIS_REST_URL is empty string", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "";
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const { getStore } = await import("@/lib/server/burnStore/index");
    const { FileBurnStore } = await import("@/lib/server/burnStore/fileStore");

    // process.env.X = "" is falsy — same branch as "absent"
    const store = getStore();
    expect(store).toBeInstanceOf(FileBurnStore);
  });

  it("returns a RedisBurnStore when UPSTASH_REDIS_REST_URL is set", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://fake-redis.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token-for-test";

    const { getStore } = await import("@/lib/server/burnStore/index");
    const { RedisBurnStore } = await import("@/lib/server/burnStore/redisStore");

    const store = getStore();
    expect(store).toBeInstanceOf(RedisBurnStore);
  });

  it("returns a MemoryBurnStore when BURN_STORE=memory (e2e isolation)", async () => {
    process.env.BURN_STORE = "memory";
    // Setting Upstash URL alongside must NOT take precedence — BURN_STORE=memory
    // is the explicit e2e override, checked first in the factory.
    process.env.UPSTASH_REDIS_REST_URL = "https://fake-redis.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token-for-test";

    const { getStore } = await import("@/lib/server/burnStore/index");
    const { MemoryBurnStore } = await import("@/lib/server/burnStore/memoryStore");

    const store = getStore();
    expect(store).toBeInstanceOf(MemoryBurnStore);
  });

  it("throws when BURN_STORE=memory in NODE_ENV=production", async () => {
    process.env.BURN_STORE = "memory";
    // NODE_ENV is readonly in @types/node — cast required for test override.
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";

    const { getStore } = await import("@/lib/server/burnStore/index");
    expect(() => getStore()).toThrow(/forbidden in production/);
  });

  it("BURN_STORE=anything-else does NOT route to MemoryBurnStore", async () => {
    // The factory matches the literal string 'memory'. Any other value (typo,
    // legacy flag) falls through to the existing Redis/File branches — this
    // prevents a stray BURN_STORE=memry from silently using fileStore in prod.
    process.env.BURN_STORE = "in-memory";
    delete process.env.UPSTASH_REDIS_REST_URL;

    const { getStore } = await import("@/lib/server/burnStore/index");
    const { FileBurnStore } = await import("@/lib/server/burnStore/fileStore");

    const store = getStore();
    expect(store).toBeInstanceOf(FileBurnStore);
  });
});

describe("getStore — memoization (lazy, build-once)", () => {
  it("returns the SAME instance across multiple calls (FileStore branch)", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    const { getStore } = await import("@/lib/server/burnStore/index");

    const a = getStore();
    const b = getStore();
    const c = getStore();
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("returns the SAME instance across multiple calls (RedisStore branch)", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://fake-redis.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token-for-test";
    const { getStore } = await import("@/lib/server/burnStore/index");

    const a = getStore();
    const b = getStore();
    expect(a).toBe(b);
  });

  it("env change AFTER first getStore() does NOT switch branches (memoized)", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    const { getStore } = await import("@/lib/server/burnStore/index");
    const { FileBurnStore } = await import("@/lib/server/burnStore/fileStore");

    const first = getStore();
    expect(first).toBeInstanceOf(FileBurnStore);

    // Flip env after the cache is warm. getStore() must STILL return the
    // FileStore — that's the memo contract. Switching at runtime would risk
    // mid-request data-store swaps, which is exactly what the cache prevents.
    process.env.UPSTASH_REDIS_REST_URL = "https://fake-redis.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token-for-test";

    const second = getStore();
    expect(second).toBe(first);
    expect(second).toBeInstanceOf(FileBurnStore);
  });
});
