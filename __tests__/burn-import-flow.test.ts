// burn-import-flow.test.ts — runImport orchestrator: buildEnvelope + validateSummary chain.
//
// runImport is a thin coordinator:
//   1. Call buildEnvelope with FSA handles + salt + period.
//   2. JSON.stringify the result, re-validate via validateSummary.
//   3. Surface a clean error if validation rejects (without echoing envelope
//      content into the error message).
//
// Tests:
//   A. buildEnvelope errors propagate (unknown period, no sessions, etc.).
//   B. With a mocked buildEnvelope returning a valid envelope, runImport
//      returns the validateSummary-approved envelope.
//   C. With a mocked buildEnvelope returning a tampered envelope (extra row
//      key), runImport throws "Burn Summary validation failed: …" — the
//      error message must NOT include the raw envelope content.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/client/burn/collect", () => ({
  buildEnvelope: vi.fn(),
}));

import { runImport } from "@/lib/client/burn/import";
import { buildEnvelope } from "@/lib/client/burn/collect";

const buildEnvelopeMock = vi.mocked(buildEnvelope);

const VALID_ENVELOPE = {
  schemaVersion: "3" as const,
  generatedAt: "2026-05-20T00:00:00Z",
  periodWindow: {
    period: "week" as const,
    since: "2026-05-11T00:00:00Z",
    until: "2026-05-18T00:00:00Z",
  },
  rows: [
    {
      tool: "claude-code" as const,
      model: "claude-opus-4-7",
      tokenCount: { input: 100, output: 50, cacheRead: 0, cacheWrite: 0, cachedInput: 0 },
      estimatedCostUsd: 0.0015,
      timestampBucket: "2026-05-15",
      sessionCount: 1,
      activeDays: 1,
      projectHash: "abc123def456",
      verification: {
        tokenSource: "device" as const,
        costBasis: "estimated" as const,
        priceConfidence: "high" as const,
        level: "Device-synced" as const,
      },
    },
  ],
  grandTotal: { totalTokens: 150, estimatedCostUsd: 0.0015 },
};

const VALID_SALT = "deadbeef" + "0".repeat(56);

const ARGS = {
  claudeHandle: null,
  codexHandle: null,
  salt: VALID_SALT,
  period: "week" as const,
};

beforeEach(() => {
  buildEnvelopeMock.mockReset();
});

describe("runImport — happy path", () => {
  it("returns the validated envelope when buildEnvelope succeeds", async () => {
    buildEnvelopeMock.mockResolvedValueOnce(VALID_ENVELOPE);
    const result = await runImport(ARGS);
    expect(result.schemaVersion).toBe("3");
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].projectHash).toBe("abc123def456");
    expect(buildEnvelopeMock).toHaveBeenCalledOnce();
    expect(buildEnvelopeMock).toHaveBeenCalledWith({
      claudeProjectsHandle: null,
      codexSessionsHandle: null,
      salt: VALID_SALT,
      period: "week",
    });
  });
});

describe("runImport — propagates buildEnvelope errors", () => {
  it("surfaces 'unknown period' from buildEnvelope", async () => {
    buildEnvelopeMock.mockRejectedValueOnce(new Error("unknown period"));
    await expect(runImport(ARGS)).rejects.toThrow(/unknown period/);
  });

  it("surfaces 'no sessions in period' from buildEnvelope", async () => {
    buildEnvelopeMock.mockRejectedValueOnce(new Error("no sessions in period 'week'"));
    await expect(runImport(ARGS)).rejects.toThrow(/no sessions in period 'week'/);
  });
});

describe("runImport — validateSummary boundary", () => {
  it("throws 'Burn Summary validation failed: …' when envelope has unexpected row key", async () => {
    const tampered = {
      ...VALID_ENVELOPE,
      rows: [{ ...VALID_ENVELOPE.rows[0], rawPrompt: "leak" }],
    };
    // buildEnvelope is typed to return Envelope; cast through unknown so the
    // mock can return a tampered shape that passes mock typing but fails
    // validateSummary at runtime.
    buildEnvelopeMock.mockResolvedValueOnce(tampered as unknown as typeof VALID_ENVELOPE);
    await expect(runImport(ARGS)).rejects.toThrow(/Burn Summary validation failed/);
  });

  it("error message must NOT leak the raw envelope JSON content", async () => {
    const tampered = {
      ...VALID_ENVELOPE,
      rows: [{ ...VALID_ENVELOPE.rows[0], secretPath: "/Users/me/secret-dir" }],
    };
    buildEnvelopeMock.mockResolvedValueOnce(tampered as unknown as typeof VALID_ENVELOPE);
    let caught: Error | null = null;
    try {
      await runImport(ARGS);
    } catch (e) {
      caught = e as Error;
    }
    expect(caught).not.toBeNull();
    expect(caught!.message).not.toContain("/Users/me/secret-dir");
    // The validateSummary error names the offending key, which is acceptable —
    // but it must not include arbitrary leaked content like the path value.
  });

  it("throws when envelope has unexpected root key", async () => {
    const tampered = {
      ...VALID_ENVELOPE,
      rawContent: "system: you are helpful",
    };
    buildEnvelopeMock.mockResolvedValueOnce(tampered as unknown as typeof VALID_ENVELOPE);
    await expect(runImport(ARGS)).rejects.toThrow(/Burn Summary validation failed/);
  });
});
