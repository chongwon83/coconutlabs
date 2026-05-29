// emailStore/index.ts — getEmailStore() factory: the single entry point.
//
// Mirrors burnStore/index.ts getStore() exactly, including the prod-guard and
// the lazy+memoized construction (Redis.fromEnv() throws without env vars, so
// building at module load would break `next build`).
//
// Priority:
//   - BURN_STORE=memory             → MemoryEmailStore (E2E ONLY, process-local)
//   - UPSTASH_REDIS_REST_URL present → RedisEmailStore (Vercel / production)
//   - neither                       → FileEmailStore   (local dev, no account)
//
// SECURITY: production must NEVER set BURN_STORE=memory — fail fast instead of
// silently routing opt-in emails to a process-local Map (cold-start = data loss).

import { Redis } from "@upstash/redis";
import type { EmailStore } from "@/lib/server/emailStore/types";
import { FileEmailStore } from "@/lib/server/emailStore/fileStore";
import { MemoryEmailStore } from "@/lib/server/emailStore/memoryStore";
import { RedisEmailStore } from "@/lib/server/emailStore/redisStore";

let cached: EmailStore | undefined;

export function getEmailStore(): EmailStore {
  if (cached !== undefined) return cached;

  if (process.env.BURN_STORE === "memory" && process.env.NODE_ENV === "production") {
    throw new Error(
      "BURN_STORE=memory is forbidden in production environments. " +
        "Remove or unset the BURN_STORE variable in your Vercel project " +
        "environment variables dashboard, then redeploy.",
    );
  }

  if (process.env.BURN_STORE === "memory") {
    cached = new MemoryEmailStore();
  } else if (process.env.UPSTASH_REDIS_REST_URL) {
    cached = new RedisEmailStore(Redis.fromEnv());
  } else {
    cached = new FileEmailStore();
  }
  return cached;
}
