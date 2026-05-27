// burn-redis-store.test.ts — RedisBurnStore projection + atomic-EVAL contract.
//
// This is the ONLY guard against "an extra runtime property rides into Redis":
// route.ts hands us an ImportedEntry that is structurally typed, but TypeScript
// can't stop a caller from passing an object literal with extra enumerable
// keys. JSON.stringify of the raw param would persist those keys. The store
// MUST rebuild field-by-field via projectEntry / projectChallenge before
// stringifying — that rebuild is what we exercise here.
//
// We mock the @upstash/redis client with a hand-rolled recorder. The store
// only uses .eval, .hgetall, .hkeys, .lrange, so a minimal object is enough.
// Each test asserts:
//   1. The Lua script is invoked with the expected KEYS + ARGV layout.
//   2. The ARGV that should be the projected JSON contains ONLY the 9 (or 7
//      for challenge) declared fields — no extras passed in by the caller.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { RedisBurnStore } from "@/lib/server/burnStore/redisStore";
import type { ImportedEntry } from "@/lib/data";
import type { ChallengeRecord } from "@/lib/server/burnStore/types";

// Minimal recording Redis stub. eval/hgetall/hkeys/lrange are the only
// methods RedisBurnStore touches; everything else is intentionally absent so
// any accidental new dependency surfaces as a TypeError immediately.
function makeRedisStub() {
  const calls: { method: string; args: unknown[] }[] = [];
  const stub = {
    calls,
    hgetallReturn: null as Record<string, ImportedEntry> | null,
    hkeysReturn: [] as string[],
    lrangeReturn: [] as ChallengeRecord[],

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
    async lrange<T>(key: string, start: number, stop: number): Promise<T[]> {
      calls.push({ method: "lrange", args: [key, start, stop] });
      return this.lrangeReturn as T[];
    },
  };
  return stub;
}

// A canonical 9-field ImportedEntry with all 5 optional fields populated, so
// projectEntry has the maximum legitimate surface area to copy through.
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
  fixes: 5,
  ves: 11.9,
  trendDir: "up",
  trendPct: 0.12,
  trendSeries: [1, 2, 3, 4, 5, 6, 7],
};

const VALID_CHALLENGE: ChallengeRecord = {
  handle: "@alice",
  challenge: "vibe-eval-12",
  claimedFixes: 7,
  status: "verified",
  verifiedFixes: 5,
  submittedAt: "2026-05-20T12:00:00Z",
  verifiedAt: "2026-05-20T13:00:00Z",
};

let stub: ReturnType<typeof makeRedisStub>;
let store: RedisBurnStore;

beforeEach(() => {
  stub = makeRedisStub();
  // The constructor only stores the reference — no runtime shape check on the
  // Redis instance, which is exactly why the cast through unknown works.
  store = new RedisBurnStore(stub as unknown as never);
});

describe("RedisBurnStore.upsertEntry — atomic Lua EVAL contract", () => {
  it("calls eval with [LEADERBOARD_KEY, histKey] + 6 ARGV in order", async () => {
    stub.hgetallReturn = { "@alice": VALID_ENTRY };
    await store.upsertEntry(VALID_ENTRY);

    const evalCall = stub.calls.find((c) => c.method === "eval");
    expect(evalCall).toBeDefined();
    const [script, keys, argv] = evalCall!.args as [string, string[], string[]];

    expect(typeof script).toBe("string");
    expect(script).toContain("HSET");
    expect(script).toContain("HDEL");
    expect(keys).toEqual(["burn:leaderboard", "burn:hist:@alice"]);
    expect(argv).toHaveLength(6);

    // ARGV layout: handle, entryJson, isWeek, weekKey, pointJson, keep
    expect(argv[0]).toBe("@alice");
    expect(argv[2]).toBe("1"); // week period
    expect(argv[3]).toBe("2026-05-11T00:00:00Z"); // weekKey === since
    expect(argv[5]).toBe("12"); // KEEP_PER_HANDLE
  });

  it("isWeek='0' and pointJson='' when period is not 'week'", async () => {
    const monthEntry: ImportedEntry = {
      ...VALID_ENTRY,
      period: "month",
      since: "2026-05-01T00:00:00Z",
      until: "2026-06-01T00:00:00Z",
    };
    await store.upsertEntry(monthEntry);
    const evalCall = stub.calls.find((c) => c.method === "eval")!;
    const argv = evalCall.args[2] as string[];
    expect(argv[2]).toBe("0");
    expect(argv[3]).toBe(""); // weekKey blank
    expect(argv[4]).toBe(""); // pointJson blank
  });

  it("projectEntry rebuilds — extra runtime keys do NOT reach Redis", async () => {
    // Caller passes an object literal that LOOKS like ImportedEntry but
    // smuggles two extra enumerable properties: a leaked raw envelope and a
    // path. JSON.stringify of the raw object would persist these.
    const dangerous = {
      ...VALID_ENTRY,
      rawEnvelope: { schemaVersion: "2", rows: ["leak"] },
      secretPath: "/Users/me/secret",
    } as ImportedEntry;

    await store.upsertEntry(dangerous);
    const evalCall = stub.calls.find((c) => c.method === "eval")!;
    const argv = evalCall.args[2] as string[];
    const entryJson = argv[1] as string;
    const stored = JSON.parse(entryJson);

    // Allowed: 10 required (incl. toolsUsed from A.1) + 5 optional = 15 known keys
    const allowed = new Set([
      "handle", "avatar", "verif", "totalTokens", "estimatedCostUsd",
      "period", "since", "until", "importedAt", "toolsUsed", "breakdown",
      "fixes", "ves", "trendDir", "trendPct", "trendSeries",
    ]);
    for (const key of Object.keys(stored)) {
      expect(allowed.has(key)).toBe(true);
    }
    expect("rawEnvelope" in stored).toBe(false);
    expect("secretPath" in stored).toBe(false);
    expect(entryJson).not.toContain("/Users/me/secret");
    expect(entryJson).not.toContain("leak");
  });

  it("ImportHistoryPoint is built typed (4 keys), never spread from entry", async () => {
    const dangerous = {
      ...VALID_ENTRY,
      rawEnvelope: { rows: ["leak"] },
    } as ImportedEntry;
    await store.upsertEntry(dangerous);
    const evalCall = stub.calls.find((c) => c.method === "eval")!;
    const argv = evalCall.args[2] as string[];
    const pointJson = argv[4] as string;
    const point = JSON.parse(pointJson);

    expect(Object.keys(point).sort()).toEqual([
      "handle", "importedAt", "totalTokens", "weekKey",
    ]);
    expect(pointJson).not.toContain("leak");
  });

  it("omits undefined optional fields from the stored entry", async () => {
    const minimal: ImportedEntry = {
      handle: "@bob",
      avatar: "x",
      verif: "Self-reported",
      totalTokens: 1,
      estimatedCostUsd: 0,
      period: "all",
      since: null,
      until: null,
      importedAt: "2026-05-20T12:00:00Z",
      toolsUsed: [],
      breakdown: [],
    };
    await store.upsertEntry(minimal);
    const evalCall = stub.calls.find((c) => c.method === "eval")!;
    const argv = evalCall.args[2] as string[];
    const stored = JSON.parse(argv[1] as string);

    expect("fixes" in stored).toBe(false);
    expect("ves" in stored).toBe(false);
    expect("trendDir" in stored).toBe(false);
    expect("trendPct" in stored).toBe(false);
    expect("trendSeries" in stored).toBe(false);
  });
});

describe("RedisBurnStore.addChallenge — projection + atomic LPUSH+LTRIM", () => {
  it("calls eval with [CHALLENGES_KEY] + 2 ARGV (recordJson, cap-1)", async () => {
    await store.addChallenge(VALID_CHALLENGE);
    const evalCall = stub.calls.find((c) => c.method === "eval");
    expect(evalCall).toBeDefined();
    const [script, keys, argv] = evalCall!.args as [string, string[], string[]];

    expect(script).toContain("LPUSH");
    expect(script).toContain("LTRIM");
    expect(keys).toEqual(["burn:challenges"]);
    expect(argv).toHaveLength(2);
    expect(argv[1]).toBe("499"); // CHALLENGES_CAP - 1
  });

  it("projectChallenge rebuilds — extra runtime keys do NOT reach Redis", async () => {
    const dangerous = {
      ...VALID_CHALLENGE,
      rawProof: "<full witness payload>",
      ipAddress: "192.168.1.42",
    } as ChallengeRecord;
    await store.addChallenge(dangerous);
    const evalCall = stub.calls.find((c) => c.method === "eval")!;
    const argv = evalCall.args[2] as string[];
    const stored = JSON.parse(argv[0] as string);

    expect(Object.keys(stored).sort()).toEqual([
      "challenge", "claimedFixes", "handle", "status",
      "submittedAt", "verifiedAt", "verifiedFixes",
    ]);
    expect("rawProof" in stored).toBe(false);
    expect("ipAddress" in stored).toBe(false);
    expect(argv[0]).not.toContain("witness payload");
    expect(argv[0]).not.toContain("192.168.1.42");
  });
});

describe("RedisBurnStore.readEntries — sorted newest first", () => {
  it("returns [] when leaderboard hash is missing", async () => {
    stub.hgetallReturn = null;
    const result = await store.readEntries();
    expect(result).toEqual([]);
  });

  it("sorts by importedAt descending (newest first)", async () => {
    const older: ImportedEntry = { ...VALID_ENTRY, handle: "@old", importedAt: "2026-05-19T00:00:00Z" };
    const newer: ImportedEntry = { ...VALID_ENTRY, handle: "@new", importedAt: "2026-05-21T00:00:00Z" };
    stub.hgetallReturn = { "@old": older, "@new": newer };
    const result = await store.readEntries();
    expect(result.map((e) => e.handle)).toEqual(["@new", "@old"]);
  });
});

describe("RedisBurnStore.readHistory — leaderboard handles as universe", () => {
  it("returns [] when no leaderboard handles exist", async () => {
    stub.hkeysReturn = [];
    const result = await store.readHistory();
    expect(result).toEqual([]);
  });
});

describe("RedisBurnStore.readChallenges — newest first via LPUSH order", () => {
  it("LRANGE 0 -1 to fetch the entire list", async () => {
    stub.lrangeReturn = [VALID_CHALLENGE];
    const result = await store.readChallenges();
    expect(result).toEqual([VALID_CHALLENGE]);

    const lr = stub.calls.find((c) => c.method === "lrange")!;
    expect(lr.args).toEqual(["burn:challenges", 0, -1]);
  });
});
