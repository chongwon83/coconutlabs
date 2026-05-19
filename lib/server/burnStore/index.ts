// burnStore/index.ts — getStore() factory: the single entry point.
//
// store.ts / importHistory.ts / challenge.ts all delegate here. getStore()
// picks the implementation by environment:
//   - UPSTASH_REDIS_REST_URL present → RedisBurnStore (Vercel / production)
//   - absent                        → FileBurnStore  (local dev, no account)
//
// LAZY + MEMOIZED: the store is built on the FIRST call, not at module load.
// Redis.fromEnv() throws when the env vars are absent; calling it at module
// top-level would break `next build` (build runs without runtime env). The
// memo means we still construct the Redis client only once per process.

import { Redis } from "@upstash/redis";
import type { BurnStore } from "@/lib/server/burnStore/types";
import { FileBurnStore } from "@/lib/server/burnStore/fileStore";
import { RedisBurnStore } from "@/lib/server/burnStore/redisStore";

let cached: BurnStore | undefined;

export function getStore(): BurnStore {
  if (cached !== undefined) return cached;
  cached = process.env.UPSTASH_REDIS_REST_URL
    ? new RedisBurnStore(Redis.fromEnv())
    : new FileBurnStore();
  return cached;
}
