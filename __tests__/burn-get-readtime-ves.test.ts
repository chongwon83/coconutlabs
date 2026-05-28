// burn-get-readtime-ves.test.ts — GET /api/burnindex derives `ves` at read time.
//
// After the challenge decommission (schema v3), the VES numerator is a
// device-measured commit count persisted on the entry as `fixes` at import.
// GET no longer joins a challenge store; it derives `ves` from the stored
// `fixes` and the current `estimatedCostUsd` via computeVes. Invariants:
//   • entry WITH fixes → ves = fixes / cost (computeVes).
//   • entry WITHOUT fixes → ves stays absent → UI renders "—" (never 0).
//   • cost <= 0 with fixes present → computeVes returns null → ves absent.
//   • the route imports nothing from lib/server/challenge.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { ImportedEntry } from "@/lib/data";

// readEntries is the only GET dependency we vary per test; trend is empty so
// it never overwrites the fields under test.
const readEntriesMock = vi.fn<() => Promise<ImportedEntry[]>>();

vi.mock("@/lib/server/store", () => ({
  readEntries: () => readEntriesMock(),
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

const { GET } = await import("@/app/api/burnindex/route");

function entry(overrides: Partial<ImportedEntry>): ImportedEntry {
  return {
    handle: "@dev",
    avatar: "x",
    verif: "Device-synced",
    totalTokens: 1000,
    estimatedCostUsd: 4,
    period: "week",
    since: "2026-05-11T00:00:00Z",
    until: "2026-05-18T00:00:00Z",
    importedAt: "2026-05-20T00:00:00Z",
    toolsUsed: ["claude-code"],
    breakdown: [],
    ...overrides,
  };
}

async function getEntries(): Promise<Array<ImportedEntry & { ves?: number }>> {
  const res = await GET();
  const body = (await res.json()) as { entries: Array<ImportedEntry & { ves?: number }> };
  return body.entries;
}

describe("GET /api/burnindex — read-time ves from stored fixes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("derives ves = fixes / cost when fixes is present", async () => {
    readEntriesMock.mockResolvedValue([entry({ fixes: 8, estimatedCostUsd: 4 })]);
    const [card] = await getEntries();
    expect(card.fixes).toBe(8);
    expect(card.ves).toBe(2); // 8 / 4
  });

  it("leaves ves absent when fixes is missing (UI renders —)", async () => {
    readEntriesMock.mockResolvedValue([entry({})]);
    const [card] = await getEntries();
    expect("fixes" in card).toBe(false);
    expect(card.ves).toBeUndefined();
  });

  it("leaves ves absent when cost <= 0 even if fixes present", async () => {
    readEntriesMock.mockResolvedValue([entry({ fixes: 5, estimatedCostUsd: 0 })]);
    const [card] = await getEntries();
    expect(card.fixes).toBe(5);
    expect(card.ves).toBeUndefined();
  });

  it("treats a real fixes=0 as present (ves=0), not absent", async () => {
    readEntriesMock.mockResolvedValue([entry({ fixes: 0, estimatedCostUsd: 4 })]);
    const [card] = await getEntries();
    expect(card.fixes).toBe(0);
    expect(card.ves).toBe(0);
  });
});

describe("GET /api/burnindex — no challenge dependency remains", () => {
  it("route source imports nothing from lib/server/challenge", () => {
    const routePath = fileURLToPath(
      new URL("../app/api/burnindex/route.ts", import.meta.url),
    );
    const src = readFileSync(routePath, "utf8");
    expect(src).not.toContain("server/challenge");
    expect(src).not.toContain("verifiedFixesByHandle");
  });
});
