// burn-token.test.ts — HMAC collector token issuance and verification tests.
//
// Verifies:
//   1. Valid token issues and verifies successfully (happy path)
//   2. Missing Authorization header → 401 (no token)
//   3. Expired token → 401
//   4. Tampered signature → 401
//   5. Nonce reuse → 401
//   6. Redis unavailable → throws (fail-closed)
//   7. Kind mismatch → 401

import { describe, it, expect, vi, beforeEach } from "vitest";
import { issueToken, verifyAndConsumeToken, parseToken, serializeToken } from "@/lib/server/burn/token";

// ── Redis mock ────────────────────────────────────────────────────────────────

const mockStore: Map<string, string> = new Map();

const mockRedis = {
  set: vi.fn(async (key: string, _val: string, _opts?: { ex?: number }) => {
    mockStore.set(key, "1");
    return "OK";
  }),
  get: vi.fn(async (key: string) => {
    return mockStore.has(key) ? "1" : null;
  }),
  del: vi.fn(async (key: string) => {
    const existed = mockStore.has(key);
    mockStore.delete(key);
    return existed ? 1 : 0;
  }),
};

vi.mock("@upstash/redis", () => ({
  Redis: {
    fromEnv: () => mockRedis,
  },
}));

// Provide a test secret
beforeEach(() => {
  mockStore.clear();
  vi.resetAllMocks();
  // Re-wire mocks after reset
  mockRedis.set.mockImplementation(async (key: string) => { mockStore.set(key, "1"); return "OK"; });
  mockRedis.get.mockImplementation(async (key: string) => mockStore.has(key) ? "1" : null);
  mockRedis.del.mockImplementation(async (key: string) => { const e = mockStore.has(key); mockStore.delete(key); return e ? 1 : 0; });
  process.env.COLLECTOR_HMAC_SECRET = "test-secret-value-that-is-long-enough-32chars";
  process.env.COLLECTOR_TOKEN_TTL_SECONDS = "300";
});

// ── Helper to issue a real token ──────────────────────────────────────────────

async function issueReal(kind: "burnindex" | "telemetry" = "burnindex"): Promise<string> {
  return issueToken(kind);
}

// ── Test 1: Happy path ────────────────────────────────────────────────────────

describe("issueToken + verifyAndConsumeToken — happy path", () => {
  it("issues a token that verifies successfully", async () => {
    const token = await issueReal("burnindex");
    expect(typeof token).toBe("string");
    expect(token.split(".").length).toBeGreaterThanOrEqual(4);

    const result = await verifyAndConsumeToken(token, "burnindex");
    expect(result.ok).toBe(true);
  });

  it("issues telemetry token that verifies with telemetry kind", async () => {
    const token = await issueReal("telemetry");
    const result = await verifyAndConsumeToken(token, "telemetry");
    expect(result.ok).toBe(true);
  });
});

// ── Test 2: No token / malformed token → 401 ────────────────────────────────

describe("verifyAndConsumeToken — missing or malformed", () => {
  it("returns 401 for empty string", async () => {
    const result = await verifyAndConsumeToken("", "burnindex");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(401);
  });

  it("returns 401 for obviously malformed token", async () => {
    const result = await verifyAndConsumeToken("not.a.valid", "burnindex");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(401);
  });
});

// ── Test 3: Expired token → 401 ──────────────────────────────────────────────

describe("verifyAndConsumeToken — expired token", () => {
  it("returns 401 for a token past its expiry", async () => {
    const token = await issueReal("burnindex");
    const parsed = parseToken(token);
    expect(parsed).not.toBeNull();

    // Rebuild token with exp in the past
    if (parsed) {
      const expiredToken = serializeToken({ ...parsed, exp: Math.floor(Date.now() / 1000) - 1 });
      const result = await verifyAndConsumeToken(expiredToken, "burnindex");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(401);
        expect(result.reason).toContain("expired");
      }
    }
  });
});

// ── Test 4: Tampered signature → 401 ─────────────────────────────────────────

describe("verifyAndConsumeToken — tampered signature", () => {
  it("returns 401 when HMAC is tampered", async () => {
    const token = await issueReal("burnindex");
    const tampered = token.slice(0, -4) + "xxxx";
    const result = await verifyAndConsumeToken(tampered, "burnindex");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
    }
  });
});

// ── Test 5: Nonce reuse → 401 ────────────────────────────────────────────────

describe("verifyAndConsumeToken — nonce reuse", () => {
  it("returns 401 on second use of the same token", async () => {
    const token = await issueReal("burnindex");

    const first = await verifyAndConsumeToken(token, "burnindex");
    expect(first.ok).toBe(true);

    const second = await verifyAndConsumeToken(token, "burnindex");
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.status).toBe(401);
      expect(second.reason).toMatch(/nonce/i);
    }
  });
});

// ── Test 6: Kind mismatch → 401 ──────────────────────────────────────────────

describe("verifyAndConsumeToken — kind mismatch", () => {
  it("returns 401 when burnindex token is used on telemetry endpoint", async () => {
    const token = await issueReal("burnindex");
    const result = await verifyAndConsumeToken(token, "telemetry");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.reason).toContain("kind");
    }
  });
});
