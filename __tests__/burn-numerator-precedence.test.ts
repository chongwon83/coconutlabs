// burn-numerator-precedence.test.ts — the precedence merge applied END TO END
// through each of the three BurnStore implementations (memory / redis / file).
//
// burn-merge-numerator.test.ts proves the pure helper; this proves every store
// actually calls it on re-import so a browser-fsa or numerator-absent upload
// cannot clobber a CLI count — AND that the merge protects ONLY the numerator
// (card/denominator fields still take the incoming import). This is the
// regression guard for the "VES column disappeared after re-upload" class.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { MemoryBurnStore } from "@/lib/server/burnStore/memoryStore";
import { RedisBurnStore } from "@/lib/server/burnStore/redisStore";
import type { ImportedEntry } from "@/lib/data";
import type { BurnStore } from "@/lib/server/burnStore/types";

const W1 = "2026-05-11T00:00:00Z";

function entry(handle: string, overrides: Partial<ImportedEntry> = {}): ImportedEntry {
  return {
    handle,
    avatar: "x",
    verif: "Device-synced",
    totalTokens: 1000,
    estimatedCostUsd: 1,
    period: "week",
    since: W1,
    until: "2026-05-18T00:00:00Z",
    importedAt: "2026-05-20T12:00:00Z",
    toolsUsed: [],
    breakdown: [],
    ...overrides,
  };
}

const cliEntry = (h: string, fixes: number, importedAt: string, tokens = 1000) =>
  entry(h, { fixes, fixesSource: "cli", importedAt, totalTokens: tokens });
const browserEntry = (h: string, fixes: number, importedAt: string, tokens = 1000) =>
  entry(h, { fixes, fixesSource: "browser-fsa", importedAt, totalTokens: tokens });
const absentEntry = (h: string, importedAt: string, tokens = 1000) =>
  entry(h, { importedAt, totalTokens: tokens });

// The full precedence story, run against any BurnStore. Each upsert returns the
// leaderboard; we read our card back by handle.
async function assertPrecedence(store: BurnStore): Promise<void> {
  const find = (list: ImportedEntry[]) => list.find((e) => e.handle === "@a")!;

  // 1) CLI imports first: 153 commits.
  await store.upsertEntry(cliEntry("@a", 153, "2026-05-20T10:00:00Z", 1000));

  // 2) Browser re-import (40) with a NEW token total must NOT clobber the
  //    numerator, but the card/denominator must take the incoming value.
  const c1 = find(await store.upsertEntry(browserEntry("@a", 40, "2026-05-20T11:00:00Z", 2000)));
  expect(c1.fixes).toBe(153);
  expect(c1.fixesSource).toBe("cli");
  expect(c1.totalTokens).toBe(2000);

  // 3) Numerator-absent re-import cannot erase the present count either.
  const c2 = find(await store.upsertEntry(absentEntry("@a", "2026-05-20T12:00:00Z", 3000)));
  expect(c2.fixes).toBe(153);
  expect(c2.fixesSource).toBe("cli");
  expect(c2.totalTokens).toBe(3000);

  // 4) A fresh CLI count DOES update (newest cli wins).
  const c3 = find(await store.upsertEntry(cliEntry("@a", 200, "2026-05-20T13:00:00Z")));
  expect(c3.fixes).toBe(200);
  expect(c3.fixesSource).toBe("cli");
}

// A stateful fake Redis that actually persists the leaderboard HSET so a second
// upsert sees the first. It interprets UPSERT_LUA's leaderboard write (HSET
// KEYS[1] ARGV[1]=handle ARGV[2]=entryJson) — that is all the merge path needs.
function makeStatefulRedis() {
  const lb: Record<string, ImportedEntry> = {};
  const hist: Record<string, Record<string, unknown>> = {};
  return {
    async eval(_script: string, keys: string[], argv: string[]) {
      const [lbKey, histK] = keys;
      const [handle, entryJson, isWeek, weekKey, pointJson] = argv;
      void lbKey;
      lb[handle] = JSON.parse(entryJson) as ImportedEntry;
      if (isWeek === "1" && pointJson) {
        hist[histK] = hist[histK] ?? {};
        hist[histK][weekKey] = JSON.parse(pointJson);
      }
      return 1;
    },
    async hget<T>(_key: string, field: string): Promise<T | null> {
      return (lb[field] ?? null) as T | null;
    },
    async hgetall<T>(_key: string): Promise<T | null> {
      return (Object.keys(lb).length ? { ...lb } : null) as T | null;
    },
    async hkeys(_key: string): Promise<string[]> {
      return Object.keys(lb);
    },
  };
}

describe("numerator precedence — MemoryBurnStore", () => {
  it("protects the numerator across browser/absent re-imports", async () => {
    await assertPrecedence(new MemoryBurnStore());
  });
});

describe("numerator precedence — RedisBurnStore", () => {
  it("protects the numerator across browser/absent re-imports", async () => {
    const fake = makeStatefulRedis();
    await assertPrecedence(new RedisBurnStore(fake as unknown as never));
  });
});

// FileBurnStore captures process.cwd() into module constants at import, so we
// spy cwd() into a tmpdir and re-import per test (mirrors store-tools-pass-through).
describe("numerator precedence — FileBurnStore", () => {
  let tmpRoot: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let FileBurnStoreCtor: any;

  beforeEach(async () => {
    tmpRoot = mkdtempSync(path.join(tmpdir(), "burn-numerator-"));
    vi.spyOn(process, "cwd").mockReturnValue(tmpRoot);
    vi.resetModules();
    const mod = await import("@/lib/server/burnStore/fileStore");
    FileBurnStoreCtor = mod.FileBurnStore;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("protects the numerator across browser/absent re-imports", async () => {
    await assertPrecedence(new FileBurnStoreCtor());
  });
});
