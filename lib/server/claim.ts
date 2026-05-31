// claim.ts — claim-token identity core (spec §2.2–2.5, §2.8).
//
// A claim token is a 256-bit random value the BROWSER mints and persists in IDB
// before its first upload (lib/client/burn/claimToken.ts). The server NEVER sees
// or stores the token — only a domain-separated sha256 of it. Proving you hold
// the token that first claimed @handle is the v1 identity model (NOT real
// ownership; OAuth is deferred to v2, spec §2.11).
//
// ClaimRecord is the LOGICAL model (carries createdAt + collision). Redis stores
// a metadata-thin projection — the plain script-readable string `sha256-v1:<hex>`
// or `legacy-locked` (A2) — so the atomic Lua claim gate needs no cjson. The file
// store + migration report keep the full union. Never query createdAt/collision
// from prod Redis; re-version the string (`sha256-v2:`) if prod ever needs them.

import { createHash, timingSafeEqual } from "node:crypto";

// 256-bit random → base64url is exactly 43 chars (no padding). Bounds body junk
// and prevents hashing arbitrary/weak strings (§2.4).
const TOKEN_FORMAT_RE = /^[A-Za-z0-9_-]{43}$/;

// Domain separation: a claim-token hash must never collide with any other
// sha256 in the system (e.g. a collector-token hash), so a leak in one context
// can't be replayed in another. The NUL keeps the prefix unambiguous.
const CLAIM_DOMAIN_SEP = "coconutlabs-claim-v1\0";

export const CLAIM_SCHEME = "sha256-v1" as const;
export const LEGACY_LOCKED_STRING = "legacy-locked" as const;

// sha256 hex digest length (32 bytes → 64 hex chars).
const HEX_DIGEST_RE = /^[0-9a-f]{64}$/;

export type ClaimRecord =
  | {
      kind: "active";
      handleKey: string;
      tokenHash: string;
      scheme: typeof CLAIM_SCHEME;
      createdAt: string;
    }
  | {
      kind: "legacyLocked";
      handleKey: string;
      collision: boolean;
      createdAt: string;
    };

/** True only for a well-formed 43-char base64url token. Defensive against non-strings. */
export function isValidTokenFormat(token: unknown): token is string {
  return typeof token === "string" && TOKEN_FORMAT_RE.test(token);
}

/** Domain-separated sha256 of the token → 64-char hex. Never log the input. */
export function hashToken(token: string): string {
  return createHash("sha256").update(CLAIM_DOMAIN_SEP + token).digest("hex");
}

/**
 * Constant-time compare of two sha256 hex digests. Returns false (never throws)
 * for malformed/length-mismatched input — timingSafeEqual throws on unequal
 * buffer lengths, so we guard the format first.
 */
export function tokenHashEquals(aHex: string, bHex: string): boolean {
  if (!HEX_DIGEST_RE.test(aHex) || !HEX_DIGEST_RE.test(bHex)) return false;
  return timingSafeEqual(Buffer.from(aHex, "hex"), Buffer.from(bHex, "hex"));
}

export function makeActiveRecord(
  handleKey: string,
  tokenHash: string,
  now: string,
): ClaimRecord {
  return { kind: "active", handleKey, tokenHash, scheme: CLAIM_SCHEME, createdAt: now };
}

export function makeLegacyRecord(
  handleKey: string,
  collision: boolean,
  now: string,
): ClaimRecord {
  return { kind: "legacyLocked", handleKey, collision, createdAt: now };
}

/** Project a ClaimRecord to the Redis plain-string shape (A2 — metadata-thin). */
export function toSchemeString(record: ClaimRecord): string {
  return record.kind === "legacyLocked"
    ? LEGACY_LOCKED_STRING
    : `${record.scheme}:${record.tokenHash}`;
}

/**
 * Parse the Redis plain-string back to its claim kind. Returns null for unknown
 * / corrupt strings (incl. unrecognized scheme or non-hex hash) — the caller
 * treats null as "locked / un-writable" so corruption fails safe, never open.
 */
export function parseSchemeString(
  s: string,
):
  | { kind: "active"; scheme: typeof CLAIM_SCHEME; tokenHash: string }
  | { kind: "legacyLocked" }
  | null {
  if (s === LEGACY_LOCKED_STRING) return { kind: "legacyLocked" };
  const prefix = `${CLAIM_SCHEME}:`;
  if (s.startsWith(prefix)) {
    const tokenHash = s.slice(prefix.length);
    return HEX_DIGEST_RE.test(tokenHash)
      ? { kind: "active", scheme: CLAIM_SCHEME, tokenHash }
      : null;
  }
  return null;
}

export type ClaimDecision =
  | { status: "claimed"; record: ClaimRecord } // first mint → write new claim + entry → 201
  | { status: "ok" } // matching token → upsert entry → 201
  | { status: "mismatch" } // claimed, token missing/wrong → 409
  | { status: "legacyLocked" } // grandfathered, manual recovery → 409
  | { status: "invalid" }; // missing-on-unclaimed / malformed token → 400

/**
 * The §2.3 enforcing-mode matrix, shared by memory + file stores (Redis
 * reimplements it in Lua). `presentedToken` may be undefined (missing) — the
 * 400-vs-409 split depends on BOTH the token AND whether the handle is claimed:
 *   - malformed token (present, bad format) → invalid (400) — never hash junk
 *   - unclaimed + missing token            → invalid (400)
 *   - unclaimed + valid token              → claimed (mint, 201)
 *   - legacyLocked                         → legacyLocked (409)
 *   - active + missing/mismatch token      → mismatch (409)
 *   - active + matching token              → ok (201)
 */
export function decideClaim(
  existing: ClaimRecord | null,
  presentedToken: string | undefined,
  ctx: { handleKey: string; now: string },
): ClaimDecision {
  const provided = typeof presentedToken === "string" && presentedToken.length > 0;
  if (provided && !isValidTokenFormat(presentedToken)) return { status: "invalid" };

  if (existing === null) {
    if (!provided) return { status: "invalid" }; // unclaimed + missing → 400
    return {
      status: "claimed",
      record: makeActiveRecord(ctx.handleKey, hashToken(presentedToken!), ctx.now),
    };
  }

  if (existing.kind === "legacyLocked") return { status: "legacyLocked" };

  // existing.kind === "active"
  if (!provided) return { status: "mismatch" }; // claimed + missing → 409
  return tokenHashEquals(existing.tokenHash, hashToken(presentedToken!))
    ? { status: "ok" }
    : { status: "mismatch" };
}
