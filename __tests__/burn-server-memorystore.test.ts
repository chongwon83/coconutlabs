// burn-server-memorystore.test.ts — MemoryBurnStore parity contract.
//
// MemoryBurnStore exists for ONE reason: e2e tests need a BurnStore that
// doesn't touch .data/burn-*.json (would pollute the dev leaderboard) and
// doesn't need a Redis account. If its behavior drifts from FileBurnStore,
// e2e passes can mask real production-path bugs.
//
// These tests pin the parity contract:
//   1. upsertEntry dedupes by handle (newest replaces older)
//   2. upsertEntry returns the full list newest-first
//   3. upsertEntry triggers history write only when period==="week" + since!==null
//   4. history dedupes by (handle, weekKey), caps at KEEP_PER_HANDLE=12 per handle
//   5. reads return DEFENSIVE COPIES — caller mutation must not corrupt store
//
// SECURITY note inherited from types.ts: this store, like fileStore, must hold
// only the typed projections (ImportedEntry / ImportHistoryPoint). We do not
// assert that property here — projectEntry / Lua scripts live elsewhere and
// have their own tests (burn-redis-store, burn-server-whitelist).

import { describe, it, expect, beforeEach } from "vitest";
import type { ImportedEntry } from "@/lib/data";
import { MemoryBurnStore } from "@/lib/server/burnStore/memoryStore";
import type { ImportHistoryPoint } from "@/lib/server/burnStore/types";

const VALID_ENTRY: ImportedEntry = {
  handle: "@alice",
  avatar: "https://example.com/avatar.png",
  verif: "Device-synced",
  totalTokens: 12345,
  estimatedCostUsd: 0.42,
  period: "week",
  since: "2026-05-11T00:00:00Z",
  until: "2026-05-18T00:00:00Z",
  importedAt: "2026-05-20T12:00:00Z",
  toolsUsed: ["claude-code"],
  breakdown: [],
};

let store: MemoryBurnStore;

beforeEach(() => {
  store = new MemoryBurnStore();
});

describe("MemoryBurnStore — empty state", () => {
  it("readEntries() returns [] on a fresh store", async () => {
    expect(await store.readEntries()).toEqual([]);
  });
  it("readHistory() returns [] on a fresh store", async () => {
    expect(await store.readHistory()).toEqual([]);
  });
});

describe("MemoryBurnStore.upsertEntry — leaderboard semantics", () => {
  it("appends a new entry and returns it", async () => {
    const result = await store.upsertEntry(VALID_ENTRY);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(VALID_ENTRY);
    expect(await store.readEntries()).toEqual([VALID_ENTRY]);
  });

  it("dedupes by handle — re-upsert replaces the older card", async () => {
    await store.upsertEntry(VALID_ENTRY);
    const updated: ImportedEntry = {
      ...VALID_ENTRY,
      totalTokens: 99999,
      importedAt: "2026-05-21T12:00:00Z",
    };
    const result = await store.upsertEntry(updated);
    expect(result).toHaveLength(1);
    expect(result[0].totalTokens).toBe(99999);
  });

  it("keeps distinct handles separately and sorts newest-importedAt first", async () => {
    const older: ImportedEntry = { ...VALID_ENTRY, handle: "@old", importedAt: "2026-05-19T00:00:00Z" };
    const newer: ImportedEntry = { ...VALID_ENTRY, handle: "@new", importedAt: "2026-05-21T00:00:00Z" };
    await store.upsertEntry(older);
    const result = await store.upsertEntry(newer);
    expect(result.map((e) => e.handle)).toEqual(["@new", "@old"]);
  });
});

describe("MemoryBurnStore.upsertEntry — history side-effect", () => {
  it("records a history point when period='week' and since is set", async () => {
    await store.upsertEntry(VALID_ENTRY);
    const hist = await store.readHistory();
    expect(hist).toHaveLength(1);
    expect(hist[0]).toEqual<ImportHistoryPoint>({
      handle: "@alice",
      weekKey: "2026-05-11T00:00:00Z",
      totalTokens: 12345,
      importedAt: "2026-05-20T12:00:00Z",
    });
  });

  it("does NOT record history when period is not 'week'", async () => {
    const monthEntry: ImportedEntry = {
      ...VALID_ENTRY,
      period: "month",
      since: "2026-05-01T00:00:00Z",
    };
    await store.upsertEntry(monthEntry);
    expect(await store.readHistory()).toEqual([]);
  });

  it("does NOT record history when since is null", async () => {
    const noSince: ImportedEntry = { ...VALID_ENTRY, since: null };
    await store.upsertEntry(noSince);
    expect(await store.readHistory()).toEqual([]);
  });

  it("dedupes history by (handle, weekKey) — re-upsert same week replaces the point", async () => {
    await store.upsertEntry(VALID_ENTRY);
    const updated: ImportedEntry = {
      ...VALID_ENTRY,
      totalTokens: 22222,
      importedAt: "2026-05-21T08:00:00Z",
    };
    await store.upsertEntry(updated);
    const hist = await store.readHistory();
    expect(hist).toHaveLength(1);
    expect(hist[0].totalTokens).toBe(22222);
    expect(hist[0].importedAt).toBe("2026-05-21T08:00:00Z");
  });

  it("caps history at 12 points per handle (KEEP_PER_HANDLE), keeps newest weekKeys", async () => {
    // Write 15 distinct weeks for one handle — first 3 must drop off.
    for (let i = 0; i < 15; i++) {
      const month = String(Math.floor(i / 4) + 1).padStart(2, "0");
      const day = String(((i % 4) * 7) + 1).padStart(2, "0");
      const weekKey = `2026-${month}-${day}T00:00:00Z`;
      await store.upsertEntry({
        ...VALID_ENTRY,
        since: weekKey,
        until: weekKey,
        importedAt: weekKey,
        totalTokens: 1000 + i,
      });
    }
    const hist = (await store.readHistory()).filter((p) => p.handle === "@alice");
    expect(hist).toHaveLength(12);
    // Oldest 3 dropped — totalTokens 1000/1001/1002 must be gone.
    expect(hist.map((p) => p.totalTokens)).not.toContain(1000);
    expect(hist.map((p) => p.totalTokens)).not.toContain(1001);
    expect(hist.map((p) => p.totalTokens)).not.toContain(1002);
    expect(hist.map((p) => p.totalTokens)).toContain(1014);
  });

  it("history cap is per-handle — handle A's 12 points do not evict handle B", async () => {
    for (let i = 0; i < 12; i++) {
      const weekKey = `2026-01-${String(i * 2 + 1).padStart(2, "0")}T00:00:00Z`;
      await store.upsertEntry({ ...VALID_ENTRY, handle: "@a", since: weekKey });
    }
    await store.upsertEntry({ ...VALID_ENTRY, handle: "@b", since: "2026-02-01T00:00:00Z" });
    const hist = await store.readHistory();
    expect(hist.filter((p) => p.handle === "@a")).toHaveLength(12);
    expect(hist.filter((p) => p.handle === "@b")).toHaveLength(1);
  });
});

describe("MemoryBurnStore — defensive copies on read", () => {
  it("mutating readEntries() result does NOT corrupt the store", async () => {
    await store.upsertEntry(VALID_ENTRY);
    const snap = await store.readEntries();
    snap.pop();
    snap.push({ ...VALID_ENTRY, handle: "@injected" });
    const fresh = await store.readEntries();
    expect(fresh).toHaveLength(1);
    expect(fresh[0].handle).toBe("@alice");
  });

  it("mutating readHistory() result does NOT corrupt the store", async () => {
    await store.upsertEntry(VALID_ENTRY);
    const snap = await store.readHistory();
    snap.length = 0;
    expect(await store.readHistory()).toHaveLength(1);
  });
});
