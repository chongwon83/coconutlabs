// emailStore/redisStore.ts — EmailStore backed by Upstash Redis.
//
// Production implementation, mirroring burnStore's RedisBurnStore. Vercel's
// filesystem is ephemeral/per-instance, so getEmailStore() picks this when
// UPSTASH_REDIS_REST_URL is present.
//
// Storage: one HASH at `burn:emails:v1`, field = normalized email, value =
// JSON(EmailSubscription). HSETNX gives atomic, race-free dedupe (only writes
// when the field is absent) — no read-modify-write window across instances.
//
// SECURITY: every value written is an explicit JSON.stringify of a projected
// EmailSubscription — never a spread of unknown data.

import type { Redis } from "@upstash/redis";
import { normalizeEmail } from "@/lib/email";
import type { EmailStore, EmailSubscription } from "@/lib/server/emailStore/types";

const EMAILS_KEY = "burn:emails:v1";

function project(sub: EmailSubscription): EmailSubscription {
  return {
    email: normalizeEmail(sub.email),
    handle: sub.handle ?? null,
    source: sub.source,
    subscribedAt: sub.subscribedAt,
  };
}

export class RedisEmailStore implements EmailStore {
  readonly #redis: Redis;

  constructor(redis: Redis) {
    this.#redis = redis;
  }

  async addEmail(sub: EmailSubscription): Promise<void> {
    const row = project(sub);
    // HSETNX: atomic "set only if field absent" — the dedupe guarantee.
    await this.#redis.hsetnx(EMAILS_KEY, row.email, JSON.stringify(row));
  }

  async hasEmail(email: string): Promise<boolean> {
    const exists = await this.#redis.hexists(EMAILS_KEY, normalizeEmail(email));
    return exists === 1;
  }
}
