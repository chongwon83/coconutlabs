// store-tools-pass-through.test.ts — Track A.2 toolsUsed round-trip contract.
//
// PR Track A (2026-05-25) added `ImportedEntry.toolsUsed`. The three BurnStore
// implementations diverge on hydration:
//
//   • MemoryBurnStore  — in-process Map, no serialization round-trip, no
//                        hydrateEntry. What you upsert is what you read.
//   • FileBurnStore    — JSON file persistence. hydrateEntry coerces a
//                        toolsUsed-missing blob (legacy pre-A.1 write) to [].
//   • RedisBurnStore   — Redis HSET persistence. Same hydrateEntry shape, plus
//                        projectEntry on the WRITE side coerces `toolsUsed ??
//                        []` so an undefined-via-cast input still stores [].
//
// BurnIndexSection's filter tabs call `.includes()` on toolsUsed unconditionally
// — a missing field would crash the leaderboard render, so the hydration
// defense is load-bearing and gets a regression test here.
//
// SECURITY: pure store contracts — Redis is mocked, File uses a per-test
// tmpdir that is deleted in afterEach.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { MemoryBurnStore } from "@/lib/server/burnStore/memoryStore";
import { RedisBurnStore } from "@/lib/server/burnStore/redisStore";
import type { ImportedEntry } from "@/lib/data";

const BASE_ENTRY: Omit<ImportedEntry, "toolsUsed" | "handle"> = {
  avatar: "AL",
  verif: "Device-synced",
  totalTokens: 12345,
  estimatedCostUsd: 0.42,
  period: "week",
  since: "2026-05-18T00:00:00Z",
  until: "2026-05-25T00:00:00Z",
  importedAt: "2026-05-25T12:00:00Z",
  breakdown: [],
};

function entry(
  handle: string,
  toolsUsed: ImportedEntry["toolsUsed"],
  overrides: Partial<ImportedEntry> = {},
): ImportedEntry {
  return { ...BASE_ENTRY, handle, toolsUsed, ...overrides };
}

// ---------------------------------------------------------------------------
// MemoryBurnStore — no serialization, what you upsert is what you read.
// No hydrateEntry needed: in-process Map cannot contain a legacy blob.
// ---------------------------------------------------------------------------
describe("MemoryBurnStore — toolsUsed round-trip", () => {
  let store: MemoryBurnStore;

  beforeEach(() => {
    store = new MemoryBurnStore();
  });

  it("preserves single-tool toolsUsed verbatim", async () => {
    await store.upsertEntry(entry("@alice", ["claude-code"]));
    const out = await store.readEntries();
    expect(out).toHaveLength(1);
    expect(out[0].toolsUsed).toEqual(["claude-code"]);
  });

  it("preserves both-tools toolsUsed in original order", async () => {
    await store.upsertEntry(entry("@bob", ["claude-code", "codex"]));
    const out = await store.readEntries();
    expect(out[0].toolsUsed).toEqual(["claude-code", "codex"]);
  });

  it("preserves empty toolsUsed as []", async () => {
    await store.upsertEntry(entry("@carol", []));
    const out = await store.readEntries();
    expect(out[0].toolsUsed).toEqual([]);
  });

  it("re-upsert overwrites with new toolsUsed value (single → both)", async () => {
    await store.upsertEntry(entry("@dave", ["codex"]));
    await store.upsertEntry(
      entry("@dave", ["claude-code", "codex"], {
        importedAt: "2026-05-25T13:00:00Z",
      }),
    );
    const out = await store.readEntries();
    expect(out).toHaveLength(1);
    expect(out[0].toolsUsed).toEqual(["claude-code", "codex"]);
  });
});

// ---------------------------------------------------------------------------
// RedisBurnStore — mocked client. The on-the-wire JSON (argv[1]) is the
// projection; readEntries hydrates missing toolsUsed defensively.
// Mirrors the makeRedisStub pattern in burn-redis-store.test.ts so both files
// stay readable side-by-side.
// ---------------------------------------------------------------------------
function makeRedisStub() {
  const calls: { method: string; args: unknown[] }[] = [];
  const stub = {
    calls,
    hgetallReturn: null as Record<string, ImportedEntry> | null,
    hkeysReturn: [] as string[],
    async eval(script: string, keys: string[], argv: string[]) {
      calls.push({ method: "eval", args: [script, keys, argv] });
      return 1;
    },
    async hgetall<T>(key: string): Promise<T | null> {
      calls.push({ method: "hgetall", args: [key] });
      return this.hgetallReturn as T | null;
    },
    async hkeys(key: string): Promise<string[]> {
      calls.push({ method: "hkeys", args: [key] });
      return this.hkeysReturn;
    },
  };
  return stub;
}

describe("RedisBurnStore — toolsUsed projection + hydration", () => {
  let stub: ReturnType<typeof makeRedisStub>;
  let store: RedisBurnStore;

  beforeEach(() => {
    stub = makeRedisStub();
    store = new RedisBurnStore(stub as unknown as never);
  });

  it("projectEntry persists toolsUsed verbatim in the EVAL payload", async () => {
    await store.upsertEntry(entry("@alice", ["claude-code", "codex"]));
    const evalCall = stub.calls.find((c) => c.method === "eval")!;
    const argv = evalCall.args[2] as string[];
    const stored = JSON.parse(argv[1] as string);
    expect(stored.toolsUsed).toEqual(["claude-code", "codex"]);
  });

  it("projectEntry coerces undefined-via-cast toolsUsed to [] in stored JSON", async () => {
    // A caller bypassing the buildImportedEntry projection (e.g. legacy import
    // path or a hand-built admin payload) could plausibly hand us an
    // ImportedEntry with toolsUsed: undefined. The `?? []` defense in
    // projectEntry must coerce it before JSON.stringify hits Redis.
    const minimal = {
      ...BASE_ENTRY,
      handle: "@bob",
      // toolsUsed intentionally omitted — TS allows the cast because we lie.
    } as unknown as ImportedEntry;
    await store.upsertEntry(minimal);
    const evalCall = stub.calls.find((c) => c.method === "eval")!;
    const argv = evalCall.args[2] as string[];
    const stored = JSON.parse(argv[1] as string);
    expect(stored.toolsUsed).toEqual([]);
  });

  it("hydrateEntry coerces missing toolsUsed to [] on readEntries", async () => {
    // Simulate a pre-A.1 leaderboard blob: every other ImportedEntry field
    // present, toolsUsed absent. Without hydration, BurnIndexSection's filter
    // tabs would crash on undefined.toolsUsed.includes(...).
    const legacy = { ...BASE_ENTRY, handle: "@legacy" } as unknown as ImportedEntry;
    stub.hgetallReturn = { "@legacy": legacy };
    const out = await store.readEntries();
    expect(out).toHaveLength(1);
    expect(out[0].toolsUsed).toEqual([]);
  });

  it("hydrateEntry passes through a populated toolsUsed unchanged", async () => {
    const populated = entry("@carol", ["codex"]);
    stub.hgetallReturn = { "@carol": populated };
    const out = await store.readEntries();
    expect(out[0].toolsUsed).toEqual(["codex"]);
  });
});

// ---------------------------------------------------------------------------
// FileBurnStore — module-level DATA_DIR captures process.cwd() at import. To
// redirect writes into a per-test tmpdir we spy cwd() BEFORE dynamic import,
// then vi.resetModules() forces the next import to re-evaluate the constants.
// Without this dance every test would clobber the dev .data/leaderboard.json.
// ---------------------------------------------------------------------------
describe("FileBurnStore — toolsUsed round-trip + legacy hydration", () => {
  let tmpRoot: string;
  // Dynamically-loaded constructor; typed as `any` because vitest's dynamic
  // import returns Module<unknown> and we re-import per test.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let FileBurnStoreCtor: any;

  beforeEach(async () => {
    tmpRoot = mkdtempSync(path.join(tmpdir(), "burn-file-store-"));
    vi.spyOn(process, "cwd").mockReturnValue(tmpRoot);
    vi.resetModules();
    const mod = await import("@/lib/server/burnStore/fileStore");
    FileBurnStoreCtor = mod.FileBurnStore;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("round-trips a single-tool entry through JSON file persistence", async () => {
    const store = new FileBurnStoreCtor();
    await store.upsertEntry(entry("@alice", ["claude-code"]));
    const out = await store.readEntries();
    expect(out).toHaveLength(1);
    expect(out[0].toolsUsed).toEqual(["claude-code"]);
  });

  it("round-trips both-tools toolsUsed verbatim", async () => {
    const store = new FileBurnStoreCtor();
    await store.upsertEntry(entry("@bob", ["claude-code", "codex"]));
    const out = await store.readEntries();
    expect(out[0].toolsUsed).toEqual(["claude-code", "codex"]);
  });

  it("round-trips empty toolsUsed as []", async () => {
    const store = new FileBurnStoreCtor();
    await store.upsertEntry(entry("@carol", []));
    const out = await store.readEntries();
    expect(out[0].toolsUsed).toEqual([]);
  });

  it("hydrateEntry coerces missing toolsUsed to [] when reading a legacy file", async () => {
    // Hand-write a pre-A.1 leaderboard.json: same shape as a real one but
    // without toolsUsed. FileBurnStore.readEntries must not crash and must
    // surface toolsUsed: [] so the filter UI .includes() call stays safe.
    const legacy = { ...BASE_ENTRY, handle: "@legacy" };
    const dataDir = path.join(tmpRoot, ".data");
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(
      path.join(dataDir, "leaderboard.json"),
      JSON.stringify([legacy], null, 2),
      "utf-8",
    );
    const store = new FileBurnStoreCtor();
    const out = await store.readEntries();
    expect(out).toHaveLength(1);
    expect(out[0].toolsUsed).toEqual([]);
    // Other fields preserved unchanged — hydrateEntry only fills the gap.
    expect(out[0].handle).toBe("@legacy");
    expect(out[0].totalTokens).toBe(12345);
  });

  it("upsertEntry under withLock also hydrates legacy rows it reads back", async () => {
    // Pre-seed the file with a legacy row (no toolsUsed), then upsert a NEW
    // handle. The legacy row stays in the file; verify hydration applies on
    // the subsequent read so the filter UI never sees `undefined`.
    const legacy = { ...BASE_ENTRY, handle: "@legacy" };
    const dataDir = path.join(tmpRoot, ".data");
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(
      path.join(dataDir, "leaderboard.json"),
      JSON.stringify([legacy], null, 2),
      "utf-8",
    );
    const store = new FileBurnStoreCtor();
    await store.upsertEntry(
      entry("@new", ["codex"], { importedAt: "2026-05-25T13:00:00Z" }),
    );
    const out = await store.readEntries();
    expect(out).toHaveLength(2);
    const byHandle = Object.fromEntries(out.map((e: ImportedEntry) => [e.handle, e]));
    expect(byHandle["@legacy"].toolsUsed).toEqual([]);
    expect(byHandle["@new"].toolsUsed).toEqual(["codex"]);
  });
});
