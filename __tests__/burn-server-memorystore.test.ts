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

// claimAndUpsert — the §2.3 enforcing matrix AT THE STORE LEVEL. claim.ts
// unit-tests decideClaim in isolation; these prove the store WIRES it correctly:
//   - a minted/matched claim performs the SAME upsert (board + history written)
//   - a rejected claim writes NOTHING (no card, no claim, board untouched)
//   - the mergeNumerator precedence merge survives the claim gate (§3.5 P1)
//   - claims are per-canonical-handle (one token never unlocks another handle)
// legacyLocked at the store level is exercised in the file/redis stores (claims
// are seedable there) + claim.ts; memory is e2e-only and starts unclaimed.
describe("MemoryBurnStore.claimAndUpsert — §2.3 matrix + write side-effects", () => {
  const TOKEN = "A".repeat(43); // valid 43-char base64url
  const OTHER = "B".repeat(43);
  // Canonical handle (post-canonicalHandle): no @, lowercase.
  const ALICE: ImportedEntry = { ...VALID_ENTRY, handle: "alice" };

  it("unclaimed + valid token → claimed, writes the card + history", async () => {
    const res = await store.claimAndUpsert(ALICE, TOKEN);
    expect(res.status).toBe("claimed");
    if (res.status === "claimed") {
      expect(res.entries).toHaveLength(1);
      expect(res.entries[0].handle).toBe("alice");
    }
    expect(await store.readEntries()).toHaveLength(1);
    expect(await store.readHistory()).toHaveLength(1);
  });

  it("re-upload with the SAME token → ok, updates the same card (no split)", async () => {
    await store.claimAndUpsert(ALICE, TOKEN);
    const updated: ImportedEntry = {
      ...ALICE,
      totalTokens: 99999,
      importedAt: "2026-05-21T12:00:00Z",
    };
    const res = await store.claimAndUpsert(updated, TOKEN);
    expect(res.status).toBe("ok");
    if (res.status === "ok") expect(res.entries).toHaveLength(1);
    const board = await store.readEntries();
    expect(board).toHaveLength(1);
    expect(board[0].totalTokens).toBe(99999);
  });

  it("re-upload with a WRONG token → mismatch, writes nothing", async () => {
    await store.claimAndUpsert(ALICE, TOKEN);
    const impostor: ImportedEntry = { ...ALICE, totalTokens: 1 };
    const res = await store.claimAndUpsert(impostor, OTHER);
    expect(res.status).toBe("mismatch");
    expect("entries" in res).toBe(false);
    const board = await store.readEntries();
    expect(board).toHaveLength(1);
    expect(board[0].totalTokens).toBe(VALID_ENTRY.totalTokens); // untouched
  });

  it("re-upload with a MISSING token on a claimed handle → mismatch, no write", async () => {
    await store.claimAndUpsert(ALICE, TOKEN);
    const res = await store.claimAndUpsert({ ...ALICE, totalTokens: 7 }, undefined);
    expect(res.status).toBe("mismatch");
    expect((await store.readEntries())[0].totalTokens).toBe(VALID_ENTRY.totalTokens);
  });

  it("unclaimed + missing token → invalid, writes nothing", async () => {
    const res = await store.claimAndUpsert(ALICE, undefined);
    expect(res.status).toBe("invalid");
    expect(await store.readEntries()).toEqual([]);
  });

  it("unclaimed + malformed token → invalid, never mints, writes nothing", async () => {
    const res = await store.claimAndUpsert(ALICE, "tooshort");
    expect(res.status).toBe("invalid");
    expect(await store.readEntries()).toEqual([]);
    // and the handle is still unclaimed: a valid token now mints fresh
    expect((await store.claimAndUpsert(ALICE, TOKEN)).status).toBe("claimed");
  });

  it("preserves mergeNumerator precedence through the claim gate (§3.5 P1)", async () => {
    // First: CLI numerator 153 claims @alice.
    await store.claimAndUpsert({ ...ALICE, fixes: 153, fixesSource: "cli" }, TOKEN);
    // Then the SAME claimant re-uploads the SAME week with a LOWER browser count.
    const res = await store.claimAndUpsert(
      { ...ALICE, fixes: 5, fixesSource: "browser-fsa" },
      TOKEN,
    );
    expect(res.status).toBe("ok");
    const board = await store.readEntries();
    expect(board[0].fixes).toBe(153); // cli(2) > browser-fsa(1) — not clobbered
    expect(board[0].fixesSource).toBe("cli");
  });

  it("claims are per-canonical-handle — @alice's token does NOT unlock @bob", async () => {
    await store.claimAndUpsert(ALICE, TOKEN);
    const bob: ImportedEntry = { ...VALID_ENTRY, handle: "bob" };
    // bob is unclaimed; alice's token is a VALID format → mints bob fresh.
    expect((await store.claimAndUpsert(bob, TOKEN)).status).toBe("claimed");
    // and bob now rejects a different token.
    expect((await store.claimAndUpsert(bob, OTHER)).status).toBe("mismatch");
  });

  it("persists displayHandle onto the card AND the history point when present", async () => {
    const withDisplay: ImportedEntry = {
      ...ALICE,
      displayHandle: "Alice",
    };
    await store.claimAndUpsert(withDisplay, TOKEN);
    const board = await store.readEntries();
    expect(board[0].handle).toBe("alice");
    expect(board[0].displayHandle).toBe("Alice");
    const hist = await store.readHistory();
    expect(hist[0].handle).toBe("alice");
    expect(hist[0].displayHandle).toBe("Alice");
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
