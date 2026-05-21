// burnStore/index.ts — getStore() factory: the single entry point.
//
// store.ts / importHistory.ts / challenge.ts all delegate here. getStore()
// picks the implementation by environment, in priority order:
//   - BURN_STORE=memory             → MemoryBurnStore (E2E ONLY, process-local)
//   - UPSTASH_REDIS_REST_URL present → RedisBurnStore (Vercel / production)
//   - neither                       → FileBurnStore   (local dev, no account)
//
// SECURITY: production must NEVER set BURN_STORE=memory. The memory branch is
// an explicit, audited Vercel env-var; it bypasses both Redis and File stores.
//
// LAZY + MEMOIZED: the store is built on the FIRST call, not at module load.
// Redis.fromEnv() throws when the env vars are absent; calling it at module
// top-level would break `next build` (build runs without runtime env). The
// memo means we still construct the Redis client only once per process.

import { Redis } from "@upstash/redis";
import type { BurnStore } from "@/lib/server/burnStore/types";
import { FileBurnStore } from "@/lib/server/burnStore/fileStore";
import { MemoryBurnStore } from "@/lib/server/burnStore/memoryStore";
import { RedisBurnStore } from "@/lib/server/burnStore/redisStore";

let cached: BurnStore | undefined;

export function getStore(): BurnStore {
  if (cached !== undefined) return cached;

  // Runtime guard: BURN_STORE=memory is checked BEFORE the Upstash URL, so a
  // stray Vercel env var would silently route all writes to a process-local Map
  // (cold-start = data loss, no persistence). Fail fast instead of losing data.
  if (process.env.BURN_STORE === "memory" && process.env.NODE_ENV === "production") {
    throw new Error(
      "BURN_STORE=memory is forbidden in production environments. " +
        "Remove or unset the BURN_STORE variable in your Vercel project " +
        "environment variables dashboard, then redeploy.",
    );
  }

  if (process.env.BURN_STORE === "memory") {
    cached = new MemoryBurnStore();
  } else if (process.env.UPSTASH_REDIS_REST_URL) {
    cached = new RedisBurnStore(Redis.fromEnv());
  } else {
    cached = new FileBurnStore();
  }
  return cached;
}
