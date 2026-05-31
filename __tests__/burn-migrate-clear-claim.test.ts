// burn-migrate-clear-claim.test.ts — Gate B (owner self-reclaim) safety.
//
// Two units, both pure / fake-Redis (no live Upstash):
//   - clearClaim(): HDELs exactly ONE legacy-locked claim, leaves every other
//     field byte-identical, and REFUSES any target that is absent or active
//     (clearing an active claim would let anyone steal the row).
//   - isMigrationComplete(): the H1 re-apply guard predicate. It must stay TRUE
//     for the post-Gate-B plan — where the cleared handle re-appears as a
//     `migrate` group (claim=none ⇒ writeClaim=true) but with ZERO raw-alias
//     removals — so a stray `--apply` is refused and never re-locks the row.
//     It must be FALSE for the genuine first migration (raw aliases present),
//     a regression guard that we didn't break the real migration's apply path.

import { describe, it, expect } from "vitest";
import type { ImportedEntry } from "@/lib/data";
import {
  clearClaim,
  isMigrationComplete,
  CLAIMS_KEY,
  LEADERBOARD_KEY,
  histKey,
  type RedisLike,
} from "@/lib/server/burnStore/migrateExec";
import { planMigration } from "@/lib/server/burnStore/migrate";
import { LEGACY_LOCKED_STRING, CLAIM_SCHEME } from "@/lib/server/claim";

const W1 = "2026-05-11T00:00:00Z";
const W2 = "2026-05-18T00:00:00Z";
const ACTIVE = `${CLAIM_SCHEME}:${"a".repeat(64)}`; // a non-"legacy-locked" value

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

// Fake Redis (hash-only), mirrors @upstash/redis JSON auto-parse on read — bare
// scheme strings like "legacy-locked" round-trip as strings.
function tryParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

class FakeRedis implements RedisLike {
  hashes = new Map<string, Map<string, string>>();

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
    if (m.size === 0) this.hashes.delete(key);
    return n;
  }
  async del(key: string): Promise<number> {
    return this.hashes.delete(key) ? 1 : 0;
  }
}

function seedThreeLocked(redis: FakeRedis): void {
  redis.seedHash(CLAIMS_KEY, {
    chongwon83: LEGACY_LOCKED_STRING,
    mpapa: LEGACY_LOCKED_STRING,
    pms0505: LEGACY_LOCKED_STRING,
  });
}

describe("clearClaim — Gate B owner self-reclaim", () => {
  it("HDELs exactly the owner's claim; the other two stay legacy-locked", async () => {
    const redis = new FakeRedis();
    seedThreeLocked(redis);

    const result = await clearClaim(redis, "chongwon83");
    expect(result.canonical).toBe("chongwon83");

    const claims = (await redis.hgetall<string>(CLAIMS_KEY))!;
    expect("chongwon83" in claims).toBe(false); // owner's claim is ABSENT
    expect(claims.mpapa).toBe(LEGACY_LOCKED_STRING); // others untouched
    expect(claims.pms0505).toBe(LEGACY_LOCKED_STRING);

    // before/after reporting fidelity.
    expect(result.before.chongwon83).toBe(LEGACY_LOCKED_STRING);
    expect("chongwon83" in result.after).toBe(false);
    expect(result.after.mpapa).toBe(LEGACY_LOCKED_STRING);
    expect(result.after.pms0505).toBe(LEGACY_LOCKED_STRING);
  });

  it("canonicalizes the target (@Chongwon83 → chongwon83)", async () => {
    const redis = new FakeRedis();
    seedThreeLocked(redis);

    const result = await clearClaim(redis, "@Chongwon83");
    expect(result.canonical).toBe("chongwon83");
    const claims = (await redis.hgetall<string>(CLAIMS_KEY))!;
    expect("chongwon83" in claims).toBe(false);
    expect(claims.mpapa).toBe(LEGACY_LOCKED_STRING);
  });

  it("REFUSES an absent claim and mutates nothing", async () => {
    const redis = new FakeRedis();
    redis.seedHash(CLAIMS_KEY, { mpapa: LEGACY_LOCKED_STRING });

    await expect(clearClaim(redis, "chongwon83")).rejects.toThrow(/ABSENT/);
    const claims = (await redis.hgetall<string>(CLAIMS_KEY))!;
    expect(claims.mpapa).toBe(LEGACY_LOCKED_STRING); // untouched
  });

  it("REFUSES an active/owned claim (would let anyone steal the row) and leaves it intact", async () => {
    const redis = new FakeRedis();
    redis.seedHash(CLAIMS_KEY, { chongwon83: ACTIVE, mpapa: LEGACY_LOCKED_STRING });

    await expect(clearClaim(redis, "chongwon83")).rejects.toThrow(/not "legacy-locked"/);
    const claims = (await redis.hgetall<string>(CLAIMS_KEY))!;
    expect(claims.chongwon83).toBe(ACTIVE); // active claim NOT removed
    expect(claims.mpapa).toBe(LEGACY_LOCKED_STRING);
  });

  it("rejects an uncanonicalizable handle before reading", async () => {
    const redis = new FakeRedis();
    seedThreeLocked(redis);
    await expect(clearClaim(redis, "@@@")).rejects.toThrow(/canonicalize/);
  });

  it("touches ONLY the claims key — leaderboard card + history are untouched", async () => {
    const redis = new FakeRedis();
    seedThreeLocked(redis);
    redis.seedHash(LEADERBOARD_KEY, { chongwon83: JSON.stringify(entry("chongwon83")) });
    redis.seedHash(histKey("chongwon83"), {
      [W1]: JSON.stringify({ handle: "chongwon83", weekKey: W1, totalTokens: 5, importedAt: "2026-05-20T12:00:00Z" }),
    });

    await clearClaim(redis, "chongwon83");

    const board = (await redis.hgetall<ImportedEntry>(LEADERBOARD_KEY))!;
    expect(board.chongwon83.handle).toBe("chongwon83"); // card intact
    const hist = (await redis.hgetall(histKey("chongwon83")))!;
    expect(Object.keys(hist)).toEqual([W1]); // trend intact
  });
});

describe("isMigrationComplete — H1 re-apply guard predicate", () => {
  it("is FALSE for the genuine first migration (raw aliases to collapse)", () => {
    const plan = planMigration({
      cards: [
        { rawHandle: "@Foo", entry: entry("@Foo") },
        { rawHandle: "foo", entry: entry("foo", { importedAt: "2026-05-20T13:00:00Z" }) },
      ],
      histories: [],
      claimState: () => "none",
    });
    expect(isMigrationComplete(plan)).toBe(false); // → --apply proceeds (regression guard)
    expect(plan.groups[0].removeCardFields).toContain("@Foo");
  });

  it("is TRUE for the fully-migrated state (all skip-clean, zero removals)", () => {
    const plan = planMigration({
      cards: [{ rawHandle: "foo", entry: entry("foo") }],
      histories: [],
      claimState: () => "legacyLocked",
    });
    expect(plan.groups.every((g) => g.status === "skip-clean")).toBe(true);
    expect(isMigrationComplete(plan)).toBe(true); // → --apply refused (no-op anyway)
  });

  it("stays TRUE for the post-Gate-B plan — a no-removal `migrate` group that would re-lock", () => {
    // After Gate B clears chongwon83's claim, the planner sees a canonical-only
    // card with claim=none: a `migrate` group (writeClaim=true) but with ZERO raw
    // aliases to remove. The guard MUST still fire, else `--apply` re-locks the row.
    const plan = planMigration({
      cards: [{ rawHandle: "chongwon83", entry: entry("chongwon83") }],
      histories: [],
      claimState: () => "none",
    });
    const g = plan.groups[0];
    expect(g.status).toBe("migrate"); // it IS actionable...
    expect(g.writeClaim).toBe(true); // ...and would re-HSET legacy-locked...
    expect(g.removeCardFields).toEqual([]); // ...but collapses no raw alias.
    expect(g.removeHistKeys).toEqual([]);
    expect(isMigrationComplete(plan)).toBe(true); // → --apply refused, Gate B preserved
  });
});
