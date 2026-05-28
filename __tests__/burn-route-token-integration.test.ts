// burn-route-token-integration.test.ts — route-layer real-token verification.
//
// Axis: prevents silent drift of the HMAC collector token spec.
//
// Why this file exists:
//   - __tests__/burn-token.test.ts covers verifyAndConsumeToken at the FUNCTION
//     level (input → output) but never calls it via a route handler.
//   - __tests__/burn-api-period-gate.test.ts mocks @/lib/server/burn/token
//     wholesale so the period-gate behavior can be exercised in isolation; the
//     route never reaches the real token verifier in that file.
//   - e2e specs (onboarding-30s.spec.ts, burn-import-fsa-picker.spec.ts) use
//     route.fulfill to stub /api/burnindex + /api/telemetry/auto-detect
//     responses entirely, so the real verifier is never invoked there either.
//
// Result before this file: if the token spec drifts (new kind, extra claim,
// header parsing change, exp validation tweak), unit + e2e stay green but
// prod returns 401/500. This file routes a real-issued token through the
// real route handler so any such drift trips a test immediately.
//
// INVARIANT (do not violate — the file's entire value depends on it):
//   1. @/lib/server/burn/token MUST NOT be mocked here.
//   2. verifyAndConsumeToken MUST NOT be replaced with a vi.fn returning ok.
//   3. Tokens MUST be produced via real issueToken(kind), not hand-rolled
//      strings (a hand-rolled HMAC would skip the secret check).
// Adding a mock of the token module here would make this file 100% redundant
// with burn-token.test.ts and the cycle's value would be zero.
//
// The period-gate file's mock-the-token approach is intentional THERE
// (period-gate is the unit under test, not the token); we explicitly do NOT
// adopt that anti-pattern in this file.

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import type { ImportedEntry } from "@/lib/data";
import {
  issueToken,
  parseToken,
  serializeToken,
} from "@/lib/server/burn/token";

// ── Redis mock (in-memory Map) ────────────────────────────────────────────────
// Copied from __tests__/burn-token.test.ts:17-38. The token module's nonce
// store is the only side-effect we replace; the HMAC + parsing path runs real.

const mockStore: Map<string, string> = new Map();

const mockRedis = {
  set: vi.fn(async (key: string, _val: string, _opts?: { ex?: number }) => {
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
  Redis: {
    fromEnv: () => mockRedis,
  },
}));

// ── Downstream mocks (route module load-time deps) ───────────────────────────
// Pattern copied from __tests__/burn-api-period-gate.test.ts:15-27. These
// imports resolve so the route module loads; the request paths that reach
// them are exercised only where it matters (case 1 / case 8 / case 9).
// NOTE: @/lib/server/burn/token is DELIBERATELY ABSENT from this list.

vi.mock("@/lib/server/store", () => ({
  readEntries: vi.fn().mockResolvedValue([] as ImportedEntry[]),
  upsertEntry: vi.fn().mockResolvedValue([] as ImportedEntry[]),
}));
vi.mock("@/lib/server/trend", () => ({
  trendByHandle: vi.fn().mockResolvedValue(new Map()),
}));
vi.mock("@/lib/server/burn/metrics", () => ({
  recordSubmission: vi.fn().mockResolvedValue(undefined),
  recordAutoDetectStarted: vi.fn().mockResolvedValue(undefined),
  recordAutoDetectCompleted: vi.fn().mockResolvedValue(undefined),
  recordAutoDetectFailed: vi.fn().mockResolvedValue(undefined),
  recordSurveyResponse: vi.fn().mockResolvedValue(undefined),
}));

// ── Env + mock reset ──────────────────────────────────────────────────────────

beforeEach(() => {
  mockStore.clear();
  vi.clearAllMocks();
  // Re-wire Redis mock after clearAllMocks (which resets the implementations).
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
  process.env.COLLECTOR_HMAC_SECRET =
    "test-secret-value-that-is-long-enough-32chars";
  process.env.COLLECTOR_TOKEN_TTL_SECONDS = "300";
});

// ── Envelope fixtures (period-gate.test.ts:37-62 shape) ──────────────────────

const BASE_ROW = {
  tool: "claude-code" as const,
  model: "claude-opus-4-7",
  tokenCount: { input: 100, output: 50, cacheRead: 0, cacheWrite: 0, cachedInput: 0 },
  estimatedCostUsd: 0.0015,
  timestampBucket: "2026-05-20",
  sessionCount: 3,
  activeDays: 2,
  projectHash: "abc123def456",
  verification: {
    tokenSource: "device" as const,
    costBasis: "estimated" as const,
    priceConfidence: "high" as const,
    level: "Device-synced" as const,
  },
};

function makeWeekEnvelope() {
  return {
    schemaVersion: "3",
    generatedAt: "2026-05-20T00:00:00Z",
    periodWindow: {
      period: "week",
      since: "2026-05-14T00:00:00Z",
      until: "2026-05-20T00:00:00Z",
    },
    rows: [BASE_ROW],
    grandTotal: { totalTokens: 150, estimatedCostUsd: 0.0015 },
  };
}

function burnindexRequest(token: string | null, envelope: object): NextRequest {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token !== null) headers["Authorization"] = `Bearer ${token}`;
  return new Request("http://localhost/api/burnindex", {
    method: "POST",
    headers,
    body: JSON.stringify({ handle: "@testuser", raw: JSON.stringify(envelope) }),
  }) as unknown as NextRequest;
}

// Valid telemetry event matching the auto_detect_started shape.
function makeTelemetryEvent() {
  return {
    event: "auto_detect_started",
    schemaVersion: 1,
    weekKey: "2026-05-20",
    session_id: "a".repeat(32),
    fsaSupported: true,
  };
}

function telemetryRequest(token: string | null, body: object): NextRequest {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token !== null) headers["Authorization"] = `Bearer ${token}`;
  return new Request("http://localhost/api/telemetry/auto-detect", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

// ── /api/burnindex POST — 8 cases (token path covered end-to-end) ───────────

describe("POST /api/burnindex — real token verification", () => {
  it("1) valid issued token + valid week envelope → 201, store called", async () => {
    const { POST } = await import("@/app/api/burnindex/route");
    const { upsertEntry } = await import("@/lib/server/store");
    const token = await issueToken("burnindex");
    const res = await POST(burnindexRequest(token, makeWeekEnvelope()));
    expect(res.status).toBe(201);
    // upsertEntry only fires if the real verifier returned ok — proof the
    // token traversed the real verifyAndConsumeToken path.
    expect(upsertEntry).toHaveBeenCalledTimes(1);
  });

  it("2) missing Authorization → 401, store not called", async () => {
    const { POST } = await import("@/app/api/burnindex/route");
    const { upsertEntry } = await import("@/lib/server/store");
    const res = await POST(burnindexRequest(null, makeWeekEnvelope()));
    expect(res.status).toBe(401);
    expect(upsertEntry).not.toHaveBeenCalled();
  });

  it("3) malformed token → 401", async () => {
    const { POST } = await import("@/app/api/burnindex/route");
    const { upsertEntry } = await import("@/lib/server/store");
    const res = await POST(burnindexRequest("not.a.valid", makeWeekEnvelope()));
    expect(res.status).toBe(401);
    expect(upsertEntry).not.toHaveBeenCalled();
  });

  it("4) expired token → 401", async () => {
    const { POST } = await import("@/app/api/burnindex/route");
    const { upsertEntry } = await import("@/lib/server/store");
    const token = await issueToken("burnindex");
    const parsed = parseToken(token);
    expect(parsed).not.toBeNull();
    // Force exp into the past. The HMAC was signed for the original exp so
    // serializing with a new exp keeps the original (now-stale) signature —
    // either expiry OR signature mismatch must reject this; both are 401.
    const expired = serializeToken({
      ...parsed!,
      exp: Math.floor(Date.now() / 1000) - 60,
    });
    const res = await POST(burnindexRequest(expired, makeWeekEnvelope()));
    expect(res.status).toBe(401);
    expect(upsertEntry).not.toHaveBeenCalled();
  });

  it("5) wrong-kind token (telemetry → burnindex) → 401", async () => {
    const { POST } = await import("@/app/api/burnindex/route");
    const { upsertEntry } = await import("@/lib/server/store");
    const telemetryToken = await issueToken("telemetry");
    const res = await POST(burnindexRequest(telemetryToken, makeWeekEnvelope()));
    expect(res.status).toBe(401);
    expect(upsertEntry).not.toHaveBeenCalled();
  });

  it("6) nonce reuse (same token submitted twice) → 1st 201, 2nd 401", async () => {
    const { POST } = await import("@/app/api/burnindex/route");
    const token = await issueToken("burnindex");

    const first = await POST(burnindexRequest(token, makeWeekEnvelope()));
    expect(first.status).toBe(201);

    const second = await POST(burnindexRequest(token, makeWeekEnvelope()));
    expect(second.status).toBe(401);
  });

  it("7) tampered signature (last 4 chars replaced) → 401", async () => {
    const { POST } = await import("@/app/api/burnindex/route");
    const { upsertEntry } = await import("@/lib/server/store");
    const token = await issueToken("burnindex");
    const tampered = token.slice(0, -4) + "xxxx";
    const res = await POST(burnindexRequest(tampered, makeWeekEnvelope()));
    expect(res.status).toBe(401);
    expect(upsertEntry).not.toHaveBeenCalled();
  });

  it("8) valid token consumed but store throws → 500 (token still consumed)", async () => {
    const { POST } = await import("@/app/api/burnindex/route");
    const store = await import("@/lib/server/store");
    // Simulate a transient store failure AFTER successful token verification.
    vi.mocked(store.upsertEntry).mockRejectedValueOnce(new Error("disk full"));

    const token = await issueToken("burnindex");
    const res = await POST(burnindexRequest(token, makeWeekEnvelope()));
    expect(res.status).toBe(500);

    // The nonce was consumed during verification — replaying the same token
    // must now hit the "nonce already used" rejection (401), proving the
    // token side-effect happened even though business logic later threw.
    const replay = await POST(burnindexRequest(token, makeWeekEnvelope()));
    expect(replay.status).toBe(401);
  });
});

// ── /api/telemetry/auto-detect POST — 2 cases (cross-kind boundary) ─────────

describe("POST /api/telemetry/auto-detect — real token verification", () => {
  it("9) valid issued telemetry token + valid event → 200", async () => {
    const { POST } = await import("@/app/api/telemetry/auto-detect/route");
    const { recordAutoDetectStarted } = await import("@/lib/server/burn/metrics");
    const token = await issueToken("telemetry");
    const res = await POST(telemetryRequest(token, makeTelemetryEvent()));
    expect(res.status).toBe(200);
    // Metrics call only fires if the real verifier returned ok.
    expect(recordAutoDetectStarted).toHaveBeenCalledTimes(1);
  });

  it("10) cross-kind: burnindex token rejected on telemetry endpoint → 401", async () => {
    const { POST } = await import("@/app/api/telemetry/auto-detect/route");
    const { recordAutoDetectStarted } = await import("@/lib/server/burn/metrics");
    const burnindexToken = await issueToken("burnindex");
    const res = await POST(telemetryRequest(burnindexToken, makeTelemetryEvent()));
    expect(res.status).toBe(401);
    expect(recordAutoDetectStarted).not.toHaveBeenCalled();
  });
});
