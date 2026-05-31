// burn-claim.test.ts — the claim-token security core. Proves:
//  - token format is rejected BEFORE hashing (bounds body junk, spec §2.4)
//  - hash is domain-separated sha256 (spec §2.5) so a leaked collector-token
//    hash can't be replayed as a claim hash
//  - constant-time compare on fixed-length digests
//  - Redis plain-string projection round-trips (A2: metadata-thin shape)
//  - decideClaim implements the FULL §2.3 matrix (the single source of the
//    400/409/201 decision shared by memory + file stores; Redis reimplements
//    the same matrix in Lua)

import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import {
  isValidTokenFormat,
  hashToken,
  tokenHashEquals,
  toSchemeString,
  parseSchemeString,
  makeActiveRecord,
  makeLegacyRecord,
  decideClaim,
  CLAIM_SCHEME,
  LEGACY_LOCKED_STRING,
} from "@/lib/server/claim";
import type { ClaimRecord } from "@/lib/server/claim";

const TOKEN_A = "A".repeat(43); // 43-char base64url shape
const TOKEN_B = "B".repeat(43);
const NOW = "2026-05-31T00:00:00.000Z";

describe("isValidTokenFormat — §2.4", () => {
  it("accepts a 43-char base64url token", () => {
    expect(isValidTokenFormat(TOKEN_A)).toBe(true);
    expect(isValidTokenFormat("aZ09-_".padEnd(43, "x"))).toBe(true);
  });
  it("rejects wrong length", () => {
    expect(isValidTokenFormat("A".repeat(42))).toBe(false);
    expect(isValidTokenFormat("A".repeat(44))).toBe(false);
    expect(isValidTokenFormat("")).toBe(false);
  });
  it("rejects illegal base64url characters (+ / = space)", () => {
    expect(isValidTokenFormat("+".repeat(43))).toBe(false);
    expect(isValidTokenFormat("/".repeat(43))).toBe(false);
    expect(isValidTokenFormat("=".repeat(43))).toBe(false);
    expect(isValidTokenFormat("A".repeat(42) + " ")).toBe(false);
  });
  it("rejects non-string defensively", () => {
    expect(isValidTokenFormat(undefined)).toBe(false);
    expect(isValidTokenFormat(null)).toBe(false);
    expect(isValidTokenFormat(123)).toBe(false);
  });
});

describe("hashToken — domain-separated sha256 (§2.5)", () => {
  it("is deterministic + domain-separated (NOT a bare sha256 of the token)", () => {
    const expected = createHash("sha256")
      .update("coconutlabs-claim-v1\0" + TOKEN_A)
      .digest("hex");
    const bare = createHash("sha256").update(TOKEN_A).digest("hex");
    expect(hashToken(TOKEN_A)).toBe(expected);
    expect(hashToken(TOKEN_A)).not.toBe(bare); // domain sep actually applied
  });
  it("different tokens → different hashes", () => {
    expect(hashToken(TOKEN_A)).not.toBe(hashToken(TOKEN_B));
  });
  it("produces a 64-char hex digest", () => {
    expect(hashToken(TOKEN_A)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("tokenHashEquals — constant-time, defensive", () => {
  it("true for identical digests, false for different", () => {
    expect(tokenHashEquals(hashToken(TOKEN_A), hashToken(TOKEN_A))).toBe(true);
    expect(tokenHashEquals(hashToken(TOKEN_A), hashToken(TOKEN_B))).toBe(false);
  });
  it("false for malformed (length-mismatched) hex without throwing", () => {
    expect(tokenHashEquals(hashToken(TOKEN_A), "deadbeef")).toBe(false);
    expect(tokenHashEquals("", hashToken(TOKEN_A))).toBe(false);
    expect(tokenHashEquals("zz", "zz")).toBe(false); // non-hex
  });
});

describe("Redis plain-string projection (A2) — round-trip", () => {
  it("active → 'sha256-v1:<hex>' and back", () => {
    const rec = makeActiveRecord("foo", hashToken(TOKEN_A), NOW);
    const s = toSchemeString(rec);
    expect(s).toBe(`${CLAIM_SCHEME}:${hashToken(TOKEN_A)}`);
    const parsed = parseSchemeString(s);
    expect(parsed).toEqual({
      kind: "active",
      scheme: CLAIM_SCHEME,
      tokenHash: hashToken(TOKEN_A),
    });
  });
  it("legacyLocked → 'legacy-locked' and back (no tokenHash)", () => {
    const rec = makeLegacyRecord("foo", true, NOW);
    expect(toSchemeString(rec)).toBe(LEGACY_LOCKED_STRING);
    expect(parseSchemeString(LEGACY_LOCKED_STRING)).toEqual({
      kind: "legacyLocked",
    });
  });
  it("unknown / corrupt string → null (caller treats as locked)", () => {
    expect(parseSchemeString("sha256-v2:abc")).toBeNull();
    expect(parseSchemeString("garbage")).toBeNull();
    expect(parseSchemeString("")).toBeNull();
    expect(parseSchemeString(`${CLAIM_SCHEME}:`)).toBeNull(); // empty hash
    expect(parseSchemeString(`${CLAIM_SCHEME}:nothex`)).toBeNull();
  });
});

describe("decideClaim — the §2.3 matrix", () => {
  const active: ClaimRecord = makeActiveRecord("foo", hashToken(TOKEN_A), NOW);
  const locked: ClaimRecord = makeLegacyRecord("foo", false, NOW);
  const ctx = { handleKey: "foo", now: NOW };

  it("unclaimed + valid token → claimed (mint), record is active", () => {
    const d = decideClaim(null, TOKEN_A, ctx);
    expect(d.status).toBe("claimed");
    if (d.status === "claimed") {
      expect(d.record.kind).toBe("active");
      expect(d.record.handleKey).toBe("foo");
      if (d.record.kind === "active") {
        expect(d.record.tokenHash).toBe(hashToken(TOKEN_A));
        expect(d.record.scheme).toBe(CLAIM_SCHEME);
      }
    }
  });
  it("unclaimed + missing token → invalid (400)", () => {
    expect(decideClaim(null, undefined, ctx).status).toBe("invalid");
    expect(decideClaim(null, "", ctx).status).toBe("invalid");
  });
  it("unclaimed + malformed token → invalid (400)", () => {
    expect(decideClaim(null, "tooshort", ctx).status).toBe("invalid");
  });
  it("active + matching token → ok (upsert/201)", () => {
    expect(decideClaim(active, TOKEN_A, ctx).status).toBe("ok");
  });
  it("active + missing token → mismatch (409)", () => {
    expect(decideClaim(active, undefined, ctx).status).toBe("mismatch");
  });
  it("active + wrong token → mismatch (409)", () => {
    expect(decideClaim(active, TOKEN_B, ctx).status).toBe("mismatch");
  });
  it("active + malformed token → invalid (400, never hash junk)", () => {
    expect(decideClaim(active, "tooshort", ctx).status).toBe("invalid");
  });
  it("legacyLocked → legacyLocked (409) regardless of token", () => {
    expect(decideClaim(locked, TOKEN_A, ctx).status).toBe("legacyLocked");
    expect(decideClaim(locked, undefined, ctx).status).toBe("legacyLocked");
  });
});
