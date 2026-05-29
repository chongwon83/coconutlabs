// email-route-token-integration.test.ts — /api/emails real-token verification.
//
// Mirrors burn-route-token-integration.test.ts: routes a REAL-issued collector
// token through the REAL route handler so any drift in the token spec (new kind,
// header parsing, exp/HMAC checks) trips a test rather than only failing in prod.
//
// INVARIANT (same as the burn-route file — the value depends on it):
//   1. @/lib/server/burn/token MUST NOT be mocked here.
//   2. Tokens MUST be produced via real issueToken(kind), never hand-rolled.
//   3. @/lib/email MUST NOT be mocked — server-side email/consent validation is
//      part of what this endpoint guarantees.
// Only the Redis nonce store (side-effect) and the EmailStore (so the test does
// not write to .data/) are mocked.

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { issueToken, parseToken } from "@/lib/server/burn/token";

// ── Redis mock (in-memory Map) — copied from burn-route-token-integration ─────

const mockStore: Map<string, string> = new Map();

const mockRedis = {
  set: vi.fn(async (key: string) => {
    mockStore.set(key, "1");
    return "OK";
  }),
  get: vi.fn(async (key: string) => (mockStore.has(key) ? "1" : null)),
  del: vi.fn(async (key: string) => {
    const existed = mockStore.has(key);
    mockStore.delete(key);
    return existed ? 1 : 0;
  }),
};

vi.mock("@upstash/redis", () => ({
  Redis: { fromEnv: () => mockRedis },
}));

// ── EmailStore mock (route load-time dep; avoids writing .data/emails.json) ───

const mockAddEmail = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/server/emailStore", () => ({
  getEmailStore: () => ({
    addEmail: mockAddEmail,
    hasEmail: vi.fn().mockResolvedValue(false),
  }),
}));

// ── Env + mock reset ──────────────────────────────────────────────────────────

beforeEach(() => {
  mockStore.clear();
  vi.clearAllMocks();
  mockRedis.set.mockImplementation(async (key: string) => {
    mockStore.set(key, "1");
    return "OK";
  });
  mockRedis.get.mockImplementation(async (key: string) =>
    mockStore.has(key) ? "1" : null,
  );
  mockRedis.del.mockImplementation(async (key: string) => {
    const existed = mockStore.has(key);
    mockStore.delete(key);
    return existed ? 1 : 0;
  });
  mockAddEmail.mockResolvedValue(undefined);
  process.env.COLLECTOR_HMAC_SECRET = "test-secret-value-that-is-long-enough-32chars";
  process.env.COLLECTOR_TOKEN_TTL_SECONDS = "300";
});

// ── Request builder ───────────────────────────────────────────────────────────

function emailsRequest(token: string | null, body: object): NextRequest {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token !== null) headers["Authorization"] = `Bearer ${token}`;
  return new Request("http://localhost/api/emails", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

const VALID_BODY = { email: "user@example.com", handle: "@tester", consent: true };

// ── parseToken allowlist: the new "emails" kind round-trips ──────────────────

describe("token: emails kind", () => {
  it("issues an emails-kind token that parseToken accepts", async () => {
    const token = await issueToken("emails");
    const parsed = parseToken(token);
    expect(parsed).not.toBeNull();
    expect(parsed!.kind).toBe("emails");
  });
});

// ── /api/emails POST — real token verification ───────────────────────────────

describe("POST /api/emails — real token verification", () => {
  it("1) valid emails token + valid body → 200, store called once", async () => {
    const { POST } = await import("@/app/api/emails/route");
    const token = await issueToken("emails");
    const res = await POST(emailsRequest(token, VALID_BODY));
    expect(res.status).toBe(200);
    // addEmail only fires if the real verifier returned ok.
    expect(mockAddEmail).toHaveBeenCalledTimes(1);
  });

  it("2) missing Authorization → 401, store not called", async () => {
    const { POST } = await import("@/app/api/emails/route");
    const res = await POST(emailsRequest(null, VALID_BODY));
    expect(res.status).toBe(401);
    expect(mockAddEmail).not.toHaveBeenCalled();
  });

  it("3) malformed token → 401", async () => {
    const { POST } = await import("@/app/api/emails/route");
    const res = await POST(emailsRequest("not.a.valid", VALID_BODY));
    expect(res.status).toBe(401);
    expect(mockAddEmail).not.toHaveBeenCalled();
  });

  it("4) wrong-kind token (telemetry → emails) → 401, store not called", async () => {
    const { POST } = await import("@/app/api/emails/route");
    const telemetryToken = await issueToken("telemetry");
    const res = await POST(emailsRequest(telemetryToken, VALID_BODY));
    expect(res.status).toBe(401);
    expect(mockAddEmail).not.toHaveBeenCalled();
  });

  it("5) nonce reuse (same token twice) → 1st 200, 2nd 401", async () => {
    const { POST } = await import("@/app/api/emails/route");
    const token = await issueToken("emails");
    const first = await POST(emailsRequest(token, VALID_BODY));
    expect(first.status).toBe(200);
    const second = await POST(emailsRequest(token, VALID_BODY));
    expect(second.status).toBe(401);
  });

  it("6) tampered signature → 401", async () => {
    const { POST } = await import("@/app/api/emails/route");
    const token = await issueToken("emails");
    const tampered = token.slice(0, -4) + "xxxx";
    const res = await POST(emailsRequest(tampered, VALID_BODY));
    expect(res.status).toBe(401);
    expect(mockAddEmail).not.toHaveBeenCalled();
  });

  it("7) consent !== true → 400 (server-enforced opt-in), store not called", async () => {
    const { POST } = await import("@/app/api/emails/route");
    const token = await issueToken("emails");
    const res = await POST(
      emailsRequest(token, { email: "user@example.com", consent: false }),
    );
    expect(res.status).toBe(400);
    expect(mockAddEmail).not.toHaveBeenCalled();
  });

  it("8) missing consent → 400, store not called", async () => {
    const { POST } = await import("@/app/api/emails/route");
    const token = await issueToken("emails");
    const res = await POST(emailsRequest(token, { email: "user@example.com" }));
    expect(res.status).toBe(400);
    expect(mockAddEmail).not.toHaveBeenCalled();
  });

  it("9) invalid email + consent → 400, store not called", async () => {
    const { POST } = await import("@/app/api/emails/route");
    const token = await issueToken("emails");
    const res = await POST(
      emailsRequest(token, { email: "not-an-email", consent: true }),
    );
    expect(res.status).toBe(400);
    expect(mockAddEmail).not.toHaveBeenCalled();
  });

  it("10) store write rejects → still 200 (fire-and-forget, additive opt-in)", async () => {
    const { POST } = await import("@/app/api/emails/route");
    mockAddEmail.mockRejectedValueOnce(new Error("redis down"));
    const token = await issueToken("emails");
    const res = await POST(emailsRequest(token, VALID_BODY));
    expect(res.status).toBe(200);
    expect(mockAddEmail).toHaveBeenCalledTimes(1);
  });
});
