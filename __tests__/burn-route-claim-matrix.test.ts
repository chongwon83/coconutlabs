// burn-route-claim-matrix.test.ts — POST /api/burnindex CLAIM_MODE gate (PR2 §5).
//
// This proves the ROUTE wiring, not the claim decision (the store layer's
// burn-{memory,file,redis}-store-claim tests own that). The claim store and the
// collector-token verifier are BOTH mocked so each row of the §5 matrix is a
// pure route-behavior assertion:
//
//   readonly window (CLAIM_MODE=claims_disabled_readonly, the default):
//     (a) valid week body            → 503, and verifyAndConsumeToken NOT called
//                                       (A1: the collector nonce is NEVER burned)
//     (b) non-week body              → 400 (helper validates before the 503)
//     (c) malformed claim token      → 400 — FORMAT check only, NOT the nonce
//     (d) missing handle             → 400
//     (e) no Authorization at all    → still 503 (readonly skips auth entirely)
//
//   enforcing (CLAIM_MODE=claims_enforcing):
//     (f) store→claimed              → 201, nonce burned exactly once, token + a
//                                       CANONICAL handle reach claimAndUpsert
//     (g) store→ok (returning)       → 201
//     (h) store→mismatch             → 409
//     (i) store→legacyLocked         → 409
//     (j) store→invalid              → 400
//     (k) missing Authorization      → 401, nonce NOT consumed, store NOT called
//
// SECURITY assertion woven through: the claim-event log records the canonical
// handle but NEVER the presented claim token (a bearer secret).

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { NextRequest } from "next/server";
import type { ImportedEntry } from "@/lib/data";

// ── Mocks: claim store + collector-token verifier are both controllable ──────
const mockClaimAndUpsert =
  vi.fn<
    (
      entry: ImportedEntry,
      token: string | undefined,
    ) => Promise<{ status: string; entries?: ImportedEntry[] }>
  >();
const mockVerify =
  vi.fn<
    (raw: string, kind: string) => Promise<{ ok: boolean; status?: number }>
  >();

vi.mock("@/lib/server/store", () => ({
  readEntries: vi.fn().mockResolvedValue([] as ImportedEntry[]),
  claimAndUpsert: (e: ImportedEntry, t: string | undefined) =>
    mockClaimAndUpsert(e, t),
}));
vi.mock("@/lib/server/trend", () => ({
  trendByHandle: vi.fn().mockResolvedValue(new Map()),
}));
vi.mock("@/lib/server/burn/metrics", () => ({
  recordSubmission: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/server/burn/token", () => ({
  verifyAndConsumeToken: (raw: string, kind: string) => mockVerify(raw, kind),
}));

const { POST } = await import("@/app/api/burnindex/route");

// ── Fixtures ─────────────────────────────────────────────────────────────────
const VALID_TOKEN = "A".repeat(43); // 43-char base64url — passes isValidTokenFormat

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

function makeEnvelope(period = "week", since = "2026-05-14T00:00:00Z", until = "2026-05-20T00:00:00Z") {
  return {
    schemaVersion: "3",
    generatedAt: "2026-05-20T00:00:00Z",
    periodWindow: { period, since, until },
    rows: [BASE_ROW],
    grandTotal: { totalTokens: 150, estimatedCostUsd: 0.0015 },
  };
}

function makeReq(opts: {
  handle?: string;
  claimToken?: string;
  envelope?: object;
  auth?: string | null; // null = omit header
  rawOverride?: unknown; // to test missing/non-string raw
}): NextRequest {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const auth = opts.auth === undefined ? `Bearer collector-xyz` : opts.auth;
  if (auth !== null) headers["Authorization"] = auth;
  const body: Record<string, unknown> = {};
  if (opts.handle !== undefined) body.handle = opts.handle;
  body.raw =
    "rawOverride" in opts
      ? opts.rawOverride
      : JSON.stringify(opts.envelope ?? makeEnvelope());
  if (opts.claimToken !== undefined) body.claimToken = opts.claimToken;
  return new Request("http://localhost/api/burnindex", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

let infoSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockVerify.mockResolvedValue({ ok: true });
  mockClaimAndUpsert.mockResolvedValue({ status: "claimed", entries: [] });
  // Silence + capture the claim-event log so we can assert it never leaks tokens.
  infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  infoSpy.mockRestore();
  delete process.env.CLAIM_MODE;
});

// ── Readonly window ──────────────────────────────────────────────────────────
describe("POST /api/burnindex — readonly window (CLAIM_MODE default)", () => {
  beforeEach(() => {
    process.env.CLAIM_MODE = "claims_disabled_readonly";
  });

  it("(a) valid week body → 503 and the collector nonce is NEVER burned", async () => {
    const res = await POST(makeReq({ handle: "@alice", claimToken: VALID_TOKEN }));
    expect(res.status).toBe(503);
    expect(res.headers.get("cache-control")).toBe("no-store");
    // The whole point of the window: no nonce burn, no write.
    expect(mockVerify).not.toHaveBeenCalled();
    expect(mockClaimAndUpsert).not.toHaveBeenCalled();
  });

  it("(b) non-week body → 400 (validated before the 503), nonce not burned", async () => {
    const res = await POST(
      makeReq({ handle: "@alice", envelope: makeEnvelope("day", "2026-05-19T00:00:00Z", "2026-05-20T00:00:00Z") }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/week/i);
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it("(c) malformed claim token → 400 (FORMAT check, not the collector nonce)", async () => {
    const res = await POST(makeReq({ handle: "@alice", claimToken: "tooshort" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/claim token/i);
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it("(d) missing handle → 400, nonce not burned", async () => {
    const res = await POST(makeReq({ claimToken: VALID_TOKEN }));
    expect(res.status).toBe(400);
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it("(e) no Authorization header → still 503 (readonly skips auth entirely)", async () => {
    const res = await POST(makeReq({ handle: "@alice", auth: null }));
    expect(res.status).toBe(503);
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it("logs a readonlyReject event with the canonical handle, never the token", async () => {
    await POST(makeReq({ handle: "@Alice", claimToken: VALID_TOKEN }));
    const line = infoSpy.mock.calls.map((c: unknown[]) => String(c[0])).join("\n");
    expect(line).toContain("readonlyReject");
    expect(line).toContain("alice"); // canonical
    expect(line).not.toContain(VALID_TOKEN); // token must never appear in logs
  });
});

// ── Enforcing ────────────────────────────────────────────────────────────────
describe("POST /api/burnindex — enforcing (CLAIM_MODE=claims_enforcing)", () => {
  beforeEach(() => {
    process.env.CLAIM_MODE = "claims_enforcing";
  });

  it("(f) store→claimed → 201; nonce burned once; CANONICAL handle + token reach the store", async () => {
    mockClaimAndUpsert.mockResolvedValue({ status: "claimed", entries: [] });
    const res = await POST(makeReq({ handle: "@Alice", claimToken: VALID_TOKEN }));
    expect(res.status).toBe(201);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(mockVerify).toHaveBeenCalledTimes(1);
    expect(mockClaimAndUpsert).toHaveBeenCalledTimes(1);
    const [entryArg, tokenArg] = mockClaimAndUpsert.mock.calls[0];
    expect(entryArg.handle).toBe("alice"); // canonicalized, not "@Alice"
    expect(entryArg.displayHandle).toBe("Alice"); // case-preserving display kept
    expect(tokenArg).toBe(VALID_TOKEN); // raw token forwarded (store hashes it)
  });

  it("(g) store→ok (returning claimant) → 201", async () => {
    mockClaimAndUpsert.mockResolvedValue({ status: "ok", entries: [] });
    const res = await POST(makeReq({ handle: "@alice", claimToken: VALID_TOKEN }));
    expect(res.status).toBe(201);
  });

  it("(h) store→mismatch → 409", async () => {
    mockClaimAndUpsert.mockResolvedValue({ status: "mismatch" });
    const res = await POST(makeReq({ handle: "@alice", claimToken: VALID_TOKEN }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/claimed on another device/i);
  });

  it("(i) store→legacyLocked → 409", async () => {
    mockClaimAndUpsert.mockResolvedValue({ status: "legacyLocked" });
    const res = await POST(makeReq({ handle: "@alice", claimToken: VALID_TOKEN }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/locked/i);
  });

  it("(j) store→invalid (no usable token) → 400", async () => {
    mockClaimAndUpsert.mockResolvedValue({ status: "invalid" });
    const res = await POST(makeReq({ handle: "@alice" })); // no claimToken
    expect(res.status).toBe(400);
    expect(mockClaimAndUpsert.mock.calls[0][1]).toBeUndefined(); // missing token forwarded as undefined
  });

  it("(k) missing Authorization → 401; nonce NOT consumed, store NOT called", async () => {
    const res = await POST(makeReq({ handle: "@alice", claimToken: VALID_TOKEN, auth: null }));
    expect(res.status).toBe(401);
    expect(mockVerify).not.toHaveBeenCalled();
    expect(mockClaimAndUpsert).not.toHaveBeenCalled();
  });

  it("invalid collector token → 401 before the claim gate", async () => {
    mockVerify.mockResolvedValue({ ok: false, status: 401 });
    const res = await POST(makeReq({ handle: "@alice", claimToken: VALID_TOKEN }));
    expect(res.status).toBe(401);
    expect(mockClaimAndUpsert).not.toHaveBeenCalled();
  });

  it("collector-token verifier throws (Redis down) → 503, fail-closed", async () => {
    mockVerify.mockRejectedValue(new Error("redis down"));
    const res = await POST(makeReq({ handle: "@alice", claimToken: VALID_TOKEN }));
    expect(res.status).toBe(503);
    expect(mockClaimAndUpsert).not.toHaveBeenCalled();
  });

  it("unexpected store status → 500 fail-closed, no board echoed (codex #3)", async () => {
    // A store bug or a future ClaimUpsertResult variant must NOT fall through to
    // a 400 'invalid' nor leak entries — the default arm fails closed.
    mockClaimAndUpsert.mockResolvedValue({
      status: "wat",
      entries: [{ handle: "alice" } as ImportedEntry],
    } as unknown as { status: string; entries: ImportedEntry[] });
    const res = await POST(makeReq({ handle: "@alice", claimToken: VALID_TOKEN }));
    expect(res.status).toBe(500);
    expect(await res.json()).not.toHaveProperty("entries");
  });

  it("store throws → 500 (nonce already consumed)", async () => {
    mockClaimAndUpsert.mockRejectedValue(new Error("disk full"));
    const res = await POST(makeReq({ handle: "@alice", claimToken: VALID_TOKEN }));
    expect(res.status).toBe(500);
    expect(mockVerify).toHaveBeenCalledTimes(1); // nonce was burned before the throw
  });

  it("a mismatch logs the handle but never the presented token", async () => {
    mockClaimAndUpsert.mockResolvedValue({ status: "mismatch" });
    await POST(makeReq({ handle: "@Alice", claimToken: VALID_TOKEN }));
    const line = infoSpy.mock.calls.map((c: unknown[]) => String(c[0])).join("\n");
    expect(line).toContain("mismatch");
    expect(line).toContain("alice");
    expect(line).not.toContain(VALID_TOKEN);
  });
});
