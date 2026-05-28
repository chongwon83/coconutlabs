// burn-api-period-gate.test.ts — Axis: server-side period enforcement on POST /api/burnindex.
//
// The leaderboard only accepts week-period envelopes. Other periods are valid
// JSON (validateSummary passes them) but must be rejected at the route level
// before touching the store.

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import type { ImportedEntry } from "@/lib/data";

// ── Mock server-side dependencies ────────────────────────────────────────────
// These are never reached for the period-gate rejection path, but the route
// module imports them at load time, so they need to resolve without errors.

vi.mock("@/lib/server/store", () => ({
  readEntries: vi.fn().mockResolvedValue([] as ImportedEntry[]),
  upsertEntry: vi.fn().mockResolvedValue([] as ImportedEntry[]),
}));
vi.mock("@/lib/server/trend", () => ({
  trendByHandle: vi.fn().mockResolvedValue(new Map()),
}));
vi.mock("@/lib/server/burn/metrics", () => ({
  recordSubmission: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/server/burn/token", () => ({
  verifyAndConsumeToken: vi.fn().mockResolvedValue({ ok: true }),
}));

// Import after mocks are in place.
const { POST } = await import("@/app/api/burnindex/route");

// ── Fixtures ──────────────────────────────────────────────────────────────────

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

function makeEnvelope(period: string, since: string | null, until: string | null) {
  return {
    schemaVersion: "3",
    generatedAt: "2026-05-20T00:00:00Z",
    periodWindow: { period, since, until },
    rows: [BASE_ROW],
    grandTotal: { totalTokens: 150, estimatedCostUsd: 0.0015 },
  };
}

function makeRequest(handle: string, envelope: object): NextRequest {
  return new Request("http://localhost/api/burnindex", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // verifyAndConsumeToken is mocked to return {ok:true} — any Bearer value works
      "Authorization": "Bearer test-token",
    },
    body: JSON.stringify({ handle, raw: JSON.stringify(envelope) }),
  }) as unknown as NextRequest;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/burnindex — period gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("week envelope is accepted (201)", async () => {
    const env = makeEnvelope("week", "2026-05-14T00:00:00Z", "2026-05-20T00:00:00Z");
    const res = await POST(makeRequest("@testuser", env));
    expect(res.status).toBe(201);
  });

  it("day envelope is rejected (400)", async () => {
    const env = makeEnvelope("day", "2026-05-19T00:00:00Z", "2026-05-20T00:00:00Z");
    const res = await POST(makeRequest("@testuser", env));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/week/i);
  });

  it("month envelope is rejected (400)", async () => {
    const env = makeEnvelope("month", "2026-05-01T00:00:00Z", "2026-05-31T23:59:59Z");
    const res = await POST(makeRequest("@testuser", env));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/week/i);
  });

  it("year envelope is rejected (400)", async () => {
    const env = makeEnvelope("year", "2026-01-01T00:00:00Z", "2026-12-31T00:00:00Z");
    const res = await POST(makeRequest("@testuser", env));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/week/i);
  });

  it("all envelope is rejected (400)", async () => {
    // period=all requires null bounds
    const env = makeEnvelope("all", null, null);
    // grandTotal must match row sum
    const allEnv = { ...env, grandTotal: { totalTokens: 150, estimatedCostUsd: 0.0015 } };
    const res = await POST(makeRequest("@testuser", allEnv));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/week/i);
  });

  it("store is not called when period gate rejects", async () => {
    const { upsertEntry } = await import("@/lib/server/store");
    const env = makeEnvelope("day", "2026-05-19T00:00:00Z", "2026-05-20T00:00:00Z");
    await POST(makeRequest("@testuser", env));
    expect(upsertEntry).not.toHaveBeenCalled();
  });
});
