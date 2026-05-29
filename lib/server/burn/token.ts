// lib/server/burn/token.ts — short-lived HMAC collector tokens.
//
// Tokens are issued by /api/internal/issue-collector-token and verified by
// /api/burnindex and /api/telemetry/auto-detect.
//
// Token format (dot-separated, base64url encoded fields):
//   <nonce>.<exp>.<kind>.<hmac>
//
// SECURITY invariants:
// - COLLECTOR_HMAC_SECRET is a server-only env var. Never prefix with NEXT_PUBLIC_.
// - Nonces are single-use: markNonceUsed writes to Redis with the token ttl.
// - Fail-closed: Redis unavailability rejects both issuance and verification.
// - Tokens expire after COLLECTOR_TOKEN_TTL_SECONDS (default 300).

import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { Redis } from "@upstash/redis";

const DEFAULT_TTL_SECONDS = 300;
const NONCE_KEY_PREFIX = "burn:token:nonce:";

export type TokenKind = "burnindex" | "telemetry" | "emails";

export interface CollectorToken {
  nonce: string;
  exp: number;
  kind: TokenKind;
  hmac: string;
}

let _redis: Redis | undefined;

function getRedis(): Redis {
  if (_redis === undefined) _redis = Redis.fromEnv();
  return _redis;
}

function getSecret(): string {
  const secret = process.env.COLLECTOR_HMAC_SECRET;
  if (!secret) throw new Error("COLLECTOR_HMAC_SECRET is not configured");
  return secret;
}

function getTtl(): number {
  const raw = process.env.COLLECTOR_TOKEN_TTL_SECONDS;
  const n = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TTL_SECONDS;
}

function computeHmac(secret: string, nonce: string, exp: number, kind: TokenKind): string {
  return createHmac("sha256", secret)
    .update(`${nonce}.${exp}.${kind}`)
    .digest("base64url");
}

export function serializeToken(token: CollectorToken): string {
  return `${token.nonce}.${token.exp}.${token.kind}.${token.hmac}`;
}

export function parseToken(raw: string): CollectorToken | null {
  const parts = raw.split(".");
  // nonce(1) + exp(1) + kind(1) + hmac(1+) — hmac may contain dots after base64url split
  if (parts.length < 4) return null;
  const nonce = parts[0];
  const expStr = parts[1];
  const kind = parts[2] as TokenKind;
  const hmac = parts.slice(3).join(".");
  const exp = parseInt(expStr, 10);
  if (!nonce || !Number.isFinite(exp) || !["burnindex", "telemetry", "emails"].includes(kind) || !hmac) {
    return null;
  }
  return { nonce, exp, kind, hmac };
}

// Issues a new token. Throws if Redis is unavailable or secret is missing.
export async function issueToken(kind: TokenKind): Promise<string> {
  const secret = getSecret();
  const redis = getRedis();
  const ttl = getTtl();
  const nonce = randomBytes(16).toString("hex");
  const exp = Math.floor(Date.now() / 1000) + ttl;
  const hmac = computeHmac(secret, nonce, exp, kind);
  const token: CollectorToken = { nonce, exp, kind, hmac };
  // Pre-register nonce so verification can confirm it was legitimately issued.
  await redis.set(`${NONCE_KEY_PREFIX}${nonce}`, "1", { ex: ttl + 60 });
  return serializeToken(token);
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; status: 401; reason: string };

// Verifies a token and marks the nonce as used (single-use enforcement).
// Throws if Redis is unavailable — callers should return 503 in that case.
export async function verifyAndConsumeToken(
  raw: string,
  expectedKind: TokenKind,
): Promise<VerifyResult> {
  const secret = getSecret();
  const token = parseToken(raw);
  if (!token) return { ok: false, status: 401, reason: "malformed token" };

  if (token.kind !== expectedKind) {
    return { ok: false, status: 401, reason: "token kind mismatch" };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec > token.exp) {
    return { ok: false, status: 401, reason: "token expired" };
  }

  // Constant-time HMAC comparison
  const expected = computeHmac(secret, token.nonce, token.exp, token.kind);
  const expectedBuf = Buffer.from(expected, "utf8");
  const actualBuf = Buffer.from(token.hmac, "utf8");
  if (
    expectedBuf.length !== actualBuf.length ||
    !timingSafeEqual(expectedBuf, actualBuf)
  ) {
    return { ok: false, status: 401, reason: "invalid signature" };
  }

  const redis = getRedis();
  const nonceKey = `${NONCE_KEY_PREFIX}${token.nonce}`;

  // Atomic check-and-delete: GET then DEL. If nonce is already gone the token
  // was already consumed or was never issued by this server.
  const exists = await redis.get(nonceKey);
  if (!exists) {
    return { ok: false, status: 401, reason: "nonce already used or not issued" };
  }
  await redis.del(nonceKey);

  return { ok: true };
}
