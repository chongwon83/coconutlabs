// burn-migrate-exec.test.ts — the A5 migration EXECUTORS (Redis ops + file state).
//
// migrate.ts (planner) is unit-tested separately. This proves the IO layer:
//   - Redis op ORDER is crash-safe: canonical writes first, raw HIST keys DEL'd
//     BEFORE raw LEADERBOARD fields (else a re-run can't discover the hist key),
//     claim HSET LAST.
//   - end-to-end on a fake Redis: aliases collapse onto canonical; a readHistory-
//     style discovery (hkeys leaderboard → histKey) returns the canonical trend.
//   - crash convergence: running a PREFIX of the ops then re-planning + finishing
//     yields the same canonical-only state (idempotent).
//   - end-to-end on the FILE store: after migration FileBurnStore.readEntries/
//     readHistory show the canonical row+trend, the legacy lock is on disk, and a
//     re-upload of the handle is 409 legacyLocked (no split, lock holds). A clean
//     re-plan is a no-op.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { ImportedEntry } from "@/lib/data";
import type { ImportHistoryPoint } from "@/lib/server/burnStore/types";
import type { ClaimRecord } from "@/lib/server/claim";
import {
  planRedisOps,
  runRedisOps,
  readRedisSnapshot,
  redisClaimState,
  planFromRedis,
  planFromFile,
  buildFileState,
  writeFileState,
  LEADERBOARD_KEY,
  CLAIMS_KEY,
  histKey,
  type RedisLike,
} from "@/lib/server/burnStore/migrateExec";
import { planMigration } from "@/lib/server/burnStore/migrate";

const W1 = "2026-05-11T00:00:00Z";
const W2 = "2026-05-18T00:00:00Z";
const TOKEN = "A".repeat(43);

function entry(handle: string, overrides: Partial<ImportedEntry> = {}): ImportedEntry {
  return {
    handle,
    avatar: "x",
    verif: "Device-synced",
    totalTokens: 1000,
    estimatedCostUsd: 1,
    period: "week",
    since: W1,
    until: W2,
    importedAt: "2026-05-20T12:00:00Z",
    toolsUsed: [],
    breakdown: [],
    ...overrides,
  };
}

function point(o: Partial<ImportHistoryPoint> = {}): ImportHistoryPoint {
  return { handle: "foo", weekKey: W1, totalTokens: 100, importedAt: "2026-05-20T12:00:00Z", ...o };
}

// ── Fake Redis (hash-only, mirrors @upstash/redis JSON auto-parse on read) ──────

function tryParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s; // bare strings like "legacy-locked" round-trip as strings
  }
}

class FakeRedis implements RedisLike {
  hashes = new Map<string, Map<string, string>>();

  // Seed helper: store the exact JSON-string form prod would persist.
  seedHash(key: string, fields: Record<string, string>): void {
    const m = this.hashes.get(key) ?? new Map<string, string>();
    for (const [f, v] of Object.entries(fields)) m.set(f, v);
    this.hashes.set(key, m);
  }

  async hgetall<T = unknown>(key: string): Promise<Record<string, T> | null> {
    const m = this.hashes.get(key);
    if (m == null || m.size === 0) return null;
    const out: Record<string, T> = {};
    for (const [f, v] of m) out[f] = tryParse(v) as T;
    return out;
  }
  async hkeys(key: string): Promise<string[]> {
    return [...(this.hashes.get(key)?.keys() ?? [])];
  }
  async hset(key: string, kv: Record<string, string>): Promise<number> {
    const m = this.hashes.get(key) ?? new Map<string, string>();
    let added = 0;
    for (const [f, v] of Object.entries(kv)) {
      if (!m.has(f)) added++;
      m.set(f, v);
    }
    this.hashes.set(key, m);
    return added;
  }
  async hdel(key: string, ...fields: string[]): Promise<number> {
    const m = this.hashes.get(key);
    if (m == null) return 0;
    let n = 0;
    for (const f of fields) if (m.delete(f)) n++;
    if (m.size === 0) this.hashes.delete(key); // Redis auto-removes empty hashes
    return n;
  }
  async del(key: string): Promise<number> {
    return this.hashes.delete(key) ? 1 : 0;
  }
}

function seedAliases(redis: FakeRedis): void {
  redis.seedHash(LEADERBOARD_KEY, {
    "@Foo": JSON.stringify(entry("@Foo", { importedAt: "2026-05-20T01:00:00Z", totalTokens: 1 })),
    Foo: JSON.stringify(entry("Foo", { importedAt: "2026-05-20T05:00:00Z", totalTokens: 2 })), // newest
  });
  redis.seedHash(histKey("@Foo"), {
    [W1]: JSON.stringify(point({ handle: "@Foo", weekKey: W1, totalTokens: 10, importedAt: "2026-05-20T01:00:00Z" })),
  });
  redis.seedHash(histKey("Foo"), {
    [W1]: JSON.stringify(point({ handle: "Foo", weekKey: W1, totalTokens: 20, importedAt: "2026-05-20T05:00:00Z" })),
  });
}

describe("planRedisOps — crash-safe ordering", () => {
  it("canonical writes first, raw hist DEL before raw leaderboard HDEL, claim LAST", () => {
    const plan = planMigration({
      cards: [
        { rawHandle: "@Foo", entry: entry("@Foo", { importedAt: "2026-05-20T01:00:00Z" }) },
        { rawHandle: "foo", entry: entry("foo", { importedAt: "2026-05-20T05:00:00Z" }) },
      ],
      histories: [
        { rawHandle: "@Foo", points: [point({ handle: "@Foo" })] },
        { rawHandle: "foo", points: [point({ handle: "foo", importedAt: "2026-05-20T05:00:00Z" })] },
      ],
      claimState: () => "none",
    });
    const ops = planRedisOps(plan);

    const idxCanonCard = ops.findIndex((o) => o.op === "hset" && o.key === LEADERBOARD_KEY && o.field === "foo");
    const idxDelRawHist = ops.findIndex((o) => o.op === "del" && o.key === histKey("@Foo"));
    const idxHdelRawCard = ops.findIndex((o) => o.op === "hdel" && o.key === LEADERBOARD_KEY && o.field === "@Foo");
    const idxClaim = ops.findIndex((o) => o.op === "hset" && o.key === CLAIMS_KEY);

    expect(idxCanonCard).toBeGreaterThanOrEqual(0);
    expect(idxCanonCard).toBeLessThan(idxDelRawHist); // canonical card before any delete
    expect(idxDelRawHist).toBeLessThan(idxHdelRawCard); // hist key gone before its leaderboard field
    expect(idxClaim).toBe(ops.length - 1); // claim is the very last op
  });
});

describe("Redis executor — end-to-end on a fake client", () => {
  it("collapses aliases onto canonical foo; a readHistory-style scan returns the canonical trend", async () => {
    const redis = new FakeRedis();
    seedAliases(redis);

    const plan = await planFromRedis(redis);
    await runRedisOps(redis, planRedisOps(plan));

    // Leaderboard: only the canonical field remains.
    const board = (await redis.hgetall<ImportedEntry>(LEADERBOARD_KEY))!;
    expect(Object.keys(board)).toEqual(["foo"]);
    expect(board.foo.displayHandle).toBe("Foo");
    expect(board.foo.handle).toBe("foo");

    // Raw hist keys are gone; canonical hist holds the newest-importedAt point.
    expect(await redis.hgetall(histKey("@Foo"))).toBeNull();
    const canonHist = (await redis.hgetall<ImportHistoryPoint>(histKey("foo")))!;
    expect(canonHist[W1].totalTokens).toBe(20);
    expect(canonHist[W1].handle).toBe("foo");

    // The Q4 hidden read path: discover hist keys FROM leaderboard fields.
    const handles = await redis.hkeys(LEADERBOARD_KEY);
    const trend: ImportHistoryPoint[] = [];
    for (const h of handles) {
      const hash = await redis.hgetall<ImportHistoryPoint>(histKey(h));
      if (hash) trend.push(...Object.values(hash));
    }
    expect(trend).toHaveLength(1);
    expect(trend[0].handle).toBe("foo");

    // Claim legacy-locked (scheme string).
    const claims = (await redis.hgetall<string>(CLAIMS_KEY))!;
    expect(claims.foo).toBe("legacy-locked");
    expect(redisClaimState(claims)("foo")).toBe("legacyLocked");
  });

  it("converges after a simulated crash mid-run (partial ops → re-plan → finish)", async () => {
    const redis = new FakeRedis();
    seedAliases(redis);

    // Run only the first 2 ops (canonical card + part of history), then "crash".
    const firstPlan = planRedisOps(await planFromRedis(redis));
    await runRedisOps(redis, firstPlan.slice(0, 2));

    // Re-plan from the residual state and finish.
    const plan2 = await planFromRedis(redis);
    await runRedisOps(redis, planRedisOps(plan2));

    const board = (await redis.hgetall<ImportedEntry>(LEADERBOARD_KEY))!;
    expect(Object.keys(board)).toEqual(["foo"]);
    expect(await redis.hgetall(histKey("@Foo"))).toBeNull();
    const claims = (await redis.hgetall<string>(CLAIMS_KEY))!;
    expect(claims.foo).toBe("legacy-locked");

    // A third clean re-plan produces NO migrate ops (true no-op).
    const plan3 = await planFromRedis(redis);
    expect(planRedisOps(plan3)).toEqual([]);
  });

  it("readRedisSnapshot shapes the hgetall/hkeys reads into planner input", async () => {
    const redis = new FakeRedis();
    seedAliases(redis);
    const snap = await readRedisSnapshot(redis);
    expect(snap.cards.map((c) => c.rawHandle).sort()).toEqual(["@Foo", "Foo"]);
    expect(snap.histories.map((h) => h.rawHandle).sort()).toEqual(["@Foo", "Foo"]);
  });
});

// ── File executor end-to-end ──────────────────────────────────────────────────

let tmpRoot: string;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let FileBurnStoreCtor: any;

function seedFile(
  leaderboard: ImportedEntry[],
  history: ImportHistoryPoint[],
  claims: Record<string, ClaimRecord>,
): void {
  const dir = path.join(tmpRoot, ".data");
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "leaderboard.json"), JSON.stringify(leaderboard, null, 2), "utf-8");
  writeFileSync(path.join(dir, "import-history.json"), JSON.stringify(history, null, 2), "utf-8");
  writeFileSync(path.join(dir, "claims.json"), JSON.stringify(claims, null, 2), "utf-8");
}

describe("File executor — end-to-end via FileBurnStore", () => {
  beforeEach(async () => {
    tmpRoot = mkdtempSync(path.join(tmpdir(), "burn-migrate-"));
    vi.spyOn(process, "cwd").mockReturnValue(tmpRoot);
    vi.resetModules();
    const mod = await import("@/lib/server/burnStore/fileStore");
    FileBurnStoreCtor = mod.FileBurnStore;
  });
  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("collapses raw aliases → canonical row + trend, legacy-locks on disk, and 409s a re-upload", async () => {
    seedFile(
      [
        entry("@Foo", { importedAt: "2026-05-20T01:00:00Z", totalTokens: 1 }),
        entry("Foo", { importedAt: "2026-05-20T05:00:00Z", totalTokens: 2 }),
      ],
      [
        point({ handle: "@Foo", weekKey: W1, totalTokens: 10, importedAt: "2026-05-20T01:00:00Z" }),
        point({ handle: "Foo", weekKey: W1, totalTokens: 20, importedAt: "2026-05-20T05:00:00Z" }),
      ],
      {},
    );

    const { plan, snapshot } = await planFromFile(tmpRoot);
    await writeFileState(tmpRoot, buildFileState(plan, snapshot, "2026-05-31T00:00:00Z"));

    const store = new FileBurnStoreCtor();
    const entries: ImportedEntry[] = await store.readEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].handle).toBe("foo");
    expect(entries[0].displayHandle).toBe("Foo");

    const trend: ImportHistoryPoint[] = await store.readHistory();
    expect(trend).toHaveLength(1);
    expect(trend[0].handle).toBe("foo");
    expect(trend[0].totalTokens).toBe(20); // newest importedAt won the collision

    // Re-upload of the now-locked handle → 409 legacyLocked (resolves to canonical,
    // proving no split, and the lock holds).
    const res = await store.claimAndUpsert(entry("foo"), TOKEN);
    expect(res.status).toBe("legacyLocked");

    // A clean re-plan is a no-op (every group skip-clean).
    const again = await planFromFile(tmpRoot);
    expect(again.plan.groups.every((g) => g.status === "skip-clean")).toBe(true);
  });
});
