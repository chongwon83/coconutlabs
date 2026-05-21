// lib/server/burn/rateLimiter.ts — sliding-window rate limiter for token issuance.
//
// Uses a Redis sorted-set (ZADD + ZREMRANGEBYSCORE + ZCARD) with score = unix
// timestamp (ms). Each check removes expired entries and counts the remainder.
//
// Fail-closed: if Redis is unavailable the caller should reject the request
// rather than allow unlimited issuance.

import { Redis } from "@upstash/redis";

const DEFAULT_WINDOW_MS = 60_000; // 1 minute
const DEFAULT_MAX_REQUESTS = 5;

let _redis: Redis | undefined;

function getRedis(): Redis {
  if (_redis === undefined) _redis = Redis.fromEnv();
  return _redis;
}

function getMaxRequests(): number {
  const raw = process.env.COLLECTOR_TOKEN_ISSUE_RATE_PER_MIN;
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_REQUESTS;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAtMs: number;
}

// Checks the rate limit for `key` (typically an IP address).
// Throws if Redis is unavailable — callers should return 503.
export async function checkRateLimit(key: string): Promise<RateLimitResult> {
  const redis = getRedis();
  const maxRequests = getMaxRequests();
  const now = Date.now();
  const windowStart = now - DEFAULT_WINDOW_MS;
  const rateKey = `burn:ratelimit:token:${key}`;

  // Pipeline: remove stale, add current, count, expire key
  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(rateKey, 0, windowStart);
  pipeline.zadd(rateKey, { score: now, member: `${now}-${Math.random()}` });
  pipeline.zcard(rateKey);
  pipeline.pexpire(rateKey, DEFAULT_WINDOW_MS);

  const results = await pipeline.exec();
  const count = (results[2] as number) ?? 0;

  const allowed = count <= maxRequests;
  return {
    allowed,
    remaining: Math.max(0, maxRequests - count),
    resetAtMs: now + DEFAULT_WINDOW_MS,
  };
}
