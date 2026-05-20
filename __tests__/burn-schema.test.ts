// burn-schema.test.ts — schema invariant verification for Burn Summary envelopes.
//
// Every envelope produced by the collect layer must pass validateSummary with
// `additionalProperties: false` enforced on the root object and every row.
// These tests exercise the schema gate with well-formed, under-specified, and
// over-specified inputs.

import { describe, it, expect } from "vitest";
import { validateSummary } from "@/lib/validateSummary";

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

// Canonical valid envelope used as the baseline for all tests.
const BASE_ENVELOPE = {
  schemaVersion: "2" as const,
  generatedAt: "2026-05-20T00:00:00Z",
  periodWindow: { period: "week" as const, since: "2026-05-14T00:00:00Z", until: "2026-05-20T00:00:00Z" },
  rows: [
    {
      tool: "claude-code" as const,
      model: "claude-opus-4-7",
      tokenCount: { input: 100, output: 50, cacheRead: 0, cacheWrite: 0, cachedInput: 0 },
      totalTokens: 150,
      estimatedCostUsd: 0.0015,
      timestampBucket: "2026-05-20",
      sessionCount: 3,
      activeDays: 2,
      projectHash: "abc123def456",
      verification: { tokenSource: "device" as const, costBasis: "estimated" as const, priceConfidence: "high" as const, level: "Device-synced" as const },
    },
  ],
  grandTotal: { totalTokens: 150, estimatedCostUsd: 0.0015 },
};

describe("validateSummary — schema invariants", () => {
  it("baseline valid envelope passes", () => {
    expect(validateSummary(JSON.stringify(BASE_ENVELOPE)).ok).toBe(true);
  });

  it("schemaVersion must be '2'", () => {
    const bad = { ...BASE_ENVELOPE, schemaVersion: "1" };
    expect(validateSummary(JSON.stringify(bad)).ok).toBe(false);
  });

  it("missing required root field (rows) fails", () => {
    const { rows: _rows, ...rest } = BASE_ENVELOPE;
    expect(validateSummary(JSON.stringify(rest)).ok).toBe(false);
  });

  it("missing required row field (tool) fails", () => {
    const { tool: _tool, ...rowRest } = BASE_ENVELOPE.rows[0];
    const bad = { ...BASE_ENVELOPE, rows: [rowRest] };
    expect(validateSummary(JSON.stringify(bad)).ok).toBe(false);
  });

  it("unknown root key is rejected (additionalProperties: false)", () => {
    const bad = { ...BASE_ENVELOPE, extra: "should-not-be-here" };
    expect(validateSummary(JSON.stringify(bad)).ok).toBe(false);
  });

  it("unknown row key is rejected (additionalProperties: false)", () => {
    const badRow = { ...BASE_ENVELOPE.rows[0], rawPath: "/home/user/secret" };
    const bad = { ...BASE_ENVELOPE, rows: [badRow] };
    expect(validateSummary(JSON.stringify(bad)).ok).toBe(false);
  });

  it("empty rows array is rejected", () => {
    const bad = { ...BASE_ENVELOPE, rows: [] };
    expect(validateSummary(JSON.stringify(bad)).ok).toBe(false);
  });

  it("rows with invalid tool value are rejected", () => {
    const badRow = { ...BASE_ENVELOPE.rows[0], tool: "unknown-tool" };
    const bad = { ...BASE_ENVELOPE, rows: [badRow] };
    expect(validateSummary(JSON.stringify(bad)).ok).toBe(false);
  });

  it("codex tool row passes", () => {
    const codexRow = {
      tool: "codex" as const,
      model: "gpt-5.2",
      tokenCount: { input: 200, output: 80, cacheRead: 10, cacheWrite: 0, cachedInput: 0 },
      totalTokens: 290,
      estimatedCostUsd: 0.003,
      timestampBucket: "2026-05-20",
      sessionCount: 1,
      activeDays: 1,
      projectHash: "def456abc123",
      verification: { tokenSource: "device" as const, costBasis: "estimated" as const, priceConfidence: "low" as const, level: "Estimated" as const },
    };
    const env = { ...BASE_ENVELOPE, rows: [codexRow], grandTotal: { totalTokens: 290, estimatedCostUsd: 0.003 } };
    expect(validateSummary(JSON.stringify(env)).ok).toBe(true);
  });

  it("non-JSON input fails gracefully", () => {
    expect(validateSummary("not json at all").ok).toBe(false);
  });

  it("null input fails gracefully", () => {
    expect(validateSummary("null").ok).toBe(false);
  });

  it("array input fails gracefully", () => {
    expect(validateSummary("[]").ok).toBe(false);
  });

  it("multiple valid rows pass", () => {
    const row2 = {
      tool: "codex" as const,
      model: "gpt-5.2",
      tokenCount: { input: 50, output: 20, cacheRead: 5, cacheWrite: 0, cachedInput: 0 },
      totalTokens: 75,
      estimatedCostUsd: 0.001,
      timestampBucket: "2026-05-20",
      sessionCount: 1,
      activeDays: 1,
      projectHash: "fedcba654321",
      verification: { tokenSource: "device" as const, costBasis: "estimated" as const, priceConfidence: "low" as const, level: "Estimated" as const },
    };
    const env = {
      ...BASE_ENVELOPE,
      rows: [BASE_ENVELOPE.rows[0], row2],
      grandTotal: { totalTokens: 225, estimatedCostUsd: 0.0025 },
    };
    expect(validateSummary(JSON.stringify(env)).ok).toBe(true);
  });
});
