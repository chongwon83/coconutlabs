// burn-redis-store-claim.test.ts — RedisBurnStore.claimAndUpsert (spec §2.3).
//
// claim.ts unit-tests decideClaim; the memory/file claim tests prove that exact
// matrix at their persistence layers. The real Lua only runs on Upstash, so this
// file proves the redis path two ways:
//
//   1. A STATEFUL fake whose eval() faithfully reimplements CLAIM_UPSERT_LUA's
//      gate (claim read first → conditional card/history/claim writes → int
//      code). It persists leaderboard/history/claims hashes so the full §2.3
//      matrix, the mergeNumerator precedence merge, displayHandle, crash-recovery
//      self-heal, and per-handle isolation are exercised end to end. Keep the JS
//      mirror in lockstep with the Lua — it is the parity oracle.
//   2. RECORDING-stub contract tests pinning the EXACT EVAL wiring the real Lua
//      depends on: KEYS=[leaderboard, hist, claims], the 8-ARGV layout, the
//      presented value as the domain-separated `sha256-v1:<hex>` (never the raw
//      token), and the never-hash-junk short-circuit (a malformed token returns
//      `invalid` WITHOUT any Redis call). The 1 prod-like real-Lua smoke lives in
//      the migration step (plan §G1).

import { describe, it, expect, beforeEach } from "vitest";
import { RedisBurnStore } from "@/lib/server/burnStore/redisStore";
import type { ImportedEntry } from "@/lib/data";
import type { BurnStore } from "@/lib/server/burnStore/types";
import {
  hashToken,
  CLAIM_SCHEME,
  LEGACY_LOCKED_STRING,
} from "@/lib/server/claim";

const TOKEN = "A".repeat(43); // valid 43-char base64url
const OTHER = "B".repeat(43);
const W1 = "2026-05-11T00:00:00Z";
const activeStr = (token: string) => `${CLAIM_SCHEME}:${hashToken(token)}`;

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

// ── Tier 1: stateful fake mirroring CLAIM_UPSERT_LUA ────────────────────────
// eval() dispatches on keys.length: 3 = claim-gated script, 2 = plain upsert.
// The claim branch is a line-for-line JS port of the Lua so a divergence shows
// up as a failing matrix test. _lb/_hist/_claims are exposed for seeding +
// assertions (seeding a claim/leaderboard = simulating prior state or a crash).
function makeStatefulRedis() {
  const lb: Record<string, ImportedEntry> = {};
  const hist: Record<string, Record<string, unknown>> = {};
  const claims: Record<string, string> = {};
  return {
    _lb: lb,
    _hist: hist,
    _claims: claims,
    async eval(_script: string, keys: string[], argv: string[]) {
      if (keys.length === 3) {
        const [, histK] = keys;
        const [handle, entryJson, isWeek, weekKey, pointJson, keepStr, presented, legacyStr] =
          argv;
        const keep = Number(keepStr);
        const existing = claims[handle]; // HGET KEYS[3] ARGV[1] — undefined = `not claim`
        let minted = false;
        if (existing == null) {
          if (presented === "") return 4; // unclaimed + missing → invalid
          minted = true;
        } else if (existing === legacyStr) {
          return 3; // legacy-locked
        } else {
          if (presented === "") return 2; // claimed + missing → mismatch
          if (existing !== presented) return 2; // claimed + wrong → mismatch
        }
        lb[handle] = JSON.parse(entryJson) as ImportedEntry;
        if (isWeek === "1" && pointJson) {
          hist[histK] = hist[histK] ?? {};
          hist[histK][weekKey] = JSON.parse(pointJson);
          if (Number.isFinite(keep) && keep >= 1) {
            const wkeys = Object.keys(hist[histK]).sort();
            const excess = wkeys.length - keep;
            for (let i = 0; i < excess; i++) delete hist[histK][wkeys[i]];
          }
        }
        if (minted) {
          claims[handle] = presented; // claim written LAST (Q2c)
          return 1; // claimed
        }
        return 0; // ok
      }
      // plain UPSERT_LUA (keys.length === 2)
      const [, histK] = keys;
      const [handle, entryJson, isWeek, weekKey, pointJson] = argv;
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
    async hgetall<T>(key: string): Promise<T | null> {
      if (key.startsWith("burn:hist:")) {
        const h = hist[key];
        return (h && Object.keys(h).length ? { ...h } : null) as T | null;
      }
      return (Object.keys(lb).length ? { ...lb } : null) as T | null;
    },
    async hkeys(_key: string): Promise<string[]> {
      return Object.keys(lb);
    },
  };
}

describe("RedisBurnStore.claimAndUpsert — §2.3 matrix via stateful fake", () => {
  let fake: ReturnType<typeof makeStatefulRedis>;
  let store: BurnStore;

  beforeEach(() => {
    fake = makeStatefulRedis();
    store = new RedisBurnStore(fake as unknown as never);
  });

  it("unclaimed + valid token → claimed; writes card, history, and the claim", async () => {
    const res = await store.claimAndUpsert(entry("alice"), TOKEN);
    expect(res.status).toBe("claimed");
    if (res.status === "claimed") expect(res.entries).toHaveLength(1);

    expect(await store.readEntries()).toHaveLength(1);
    expect(await store.readHistory()).toHaveLength(1);
    // The claim is the domain-separated string, NOT the raw token.
    expect(fake._claims.alice).toBe(activeStr(TOKEN));
    expect(fake._claims.alice).not.toContain(TOKEN);
  });

  it("re-upload with the SAME token → ok; card takes the new import", async () => {
    await store.claimAndUpsert(entry("alice"), TOKEN);
    const res = await store.claimAndUpsert(
      entry("alice", { totalTokens: 99999, importedAt: "2026-05-21T12:00:00Z" }),
      TOKEN,
    );
    expect(res.status).toBe("ok");
    const board = await store.readEntries();
    expect(board).toHaveLength(1);
    expect(board[0].totalTokens).toBe(99999);
  });

  it("wrong token on a claimed handle → mismatch; card untouched, claim unchanged", async () => {
    await store.claimAndUpsert(entry("alice", { totalTokens: 1000 }), TOKEN);
    const res = await store.claimAndUpsert(entry("alice", { totalTokens: 7 }), OTHER);
    expect(res.status).toBe("mismatch");
    expect("entries" in res).toBe(false);
    expect((await store.readEntries())[0].totalTokens).toBe(1000);
    expect(fake._claims.alice).toBe(activeStr(TOKEN)); // not overwritten
  });

  it("missing token on a claimed handle → mismatch; no write", async () => {
    await store.claimAndUpsert(entry("alice", { totalTokens: 1000 }), TOKEN);
    const res = await store.claimAndUpsert(entry("alice", { totalTokens: 7 }), undefined);
    expect(res.status).toBe("mismatch");
    expect((await store.readEntries())[0].totalTokens).toBe(1000);
  });

  it("unclaimed + missing token → invalid; no card, no claim", async () => {
    const res = await store.claimAndUpsert(entry("alice"), undefined);
    expect(res.status).toBe("invalid");
    expect(await store.readEntries()).toEqual([]);
    expect(fake._claims.alice).toBeUndefined();
  });

  it("unclaimed + malformed token → invalid WITHOUT touching Redis (never hash junk)", async () => {
    // A short-circuit in TS: no eval, no hget — the malformed token never reaches
    // the gate and is never hashed (Q2c). A valid token still mints afterward.
    const res = await store.claimAndUpsert(entry("alice"), "tooshort");
    expect(res.status).toBe("invalid");
    expect(await store.readEntries()).toEqual([]);
    expect(fake._claims.alice).toBeUndefined();
    expect((await store.claimAndUpsert(entry("alice"), TOKEN)).status).toBe("claimed");
  });

  it("seeded legacy-locked → legacyLocked (409) regardless of token; no write", async () => {
    fake._claims.ghost = LEGACY_LOCKED_STRING;
    expect((await store.claimAndUpsert(entry("ghost"), TOKEN)).status).toBe("legacyLocked");
    expect((await store.claimAndUpsert(entry("ghost"), undefined)).status).toBe("legacyLocked");
    expect(await store.readEntries()).toEqual([]);
  });

  it("self-heals a claim-without-card crash: same token re-upload writes the missing card", async () => {
    // Simulate a mint that committed the claim but crashed before the card.
    fake._claims.alice = activeStr(TOKEN);
    expect(await store.readEntries()).toEqual([]);
    const res = await store.claimAndUpsert(entry("alice"), TOKEN);
    expect(res.status).toBe("ok"); // matching token → upsert, NOT a re-mint
    expect(await store.readEntries()).toHaveLength(1);
  });

  it("preserves mergeNumerator precedence through the claim gate (§3.5 P1)", async () => {
    await store.claimAndUpsert(entry("alice", { fixes: 153, fixesSource: "cli" }), TOKEN);
    const res = await store.claimAndUpsert(
      entry("alice", { fixes: 5, fixesSource: "browser-fsa" }),
      TOKEN,
    );
    expect(res.status).toBe("ok");
    const board = await store.readEntries();
    expect(board[0].fixes).toBe(153); // cli(2) > browser-fsa(1) — not clobbered
    expect(board[0].fixesSource).toBe("cli");
  });

  it("persists displayHandle onto the card AND the history point", async () => {
    await store.claimAndUpsert(entry("alice", { displayHandle: "Alice" }), TOKEN);
    const board = await store.readEntries();
    expect(board[0].displayHandle).toBe("Alice");
    const hist = await store.readHistory();
    expect(hist[0].displayHandle).toBe("Alice");
  });

  it("trims weekly history to KEEP_PER_HANDLE (12) through the claim gate", async () => {
    // The keep-guard must not break normal trimming: keep="12" is finite >= 1,
    // so 14 distinct weeks (same token) cap at the newest 12, oldest 2 dropped.
    const base = new Date("2026-01-05T00:00:00Z").getTime(); // a Monday
    const week = 7 * 24 * 3600 * 1000;
    for (let i = 0; i < 14; i++) {
      const since = new Date(base + i * week).toISOString();
      const res = await store.claimAndUpsert(
        entry("alice", {
          since,
          until: new Date(base + (i + 1) * week).toISOString(),
          importedAt: since,
        }),
        TOKEN,
      );
      expect(res.status).toBe(i === 0 ? "claimed" : "ok");
    }
    const hist = await store.readHistory();
    expect(hist).toHaveLength(12); // capped at KEEP_PER_HANDLE
    const oldest = hist.map((p) => p.weekKey).sort()[0];
    expect(oldest).toBe(new Date(base + 2 * week).toISOString()); // weeks 0,1 trimmed
  });

  it("isolates claims per handle — alice's token does not unlock bob", async () => {
    await store.claimAndUpsert(entry("alice"), TOKEN);
    // bob is unclaimed → alice's token mints bob fresh (no cross-handle bleed).
    expect((await store.claimAndUpsert(entry("bob"), TOKEN)).status).toBe("claimed");
    // now bob is claimed by TOKEN → OTHER is rejected for bob.
    expect((await store.claimAndUpsert(entry("bob"), OTHER)).status).toBe("mismatch");
    expect(fake._claims.alice).toBe(activeStr(TOKEN));
    expect(fake._claims.bob).toBe(activeStr(TOKEN));
  });
});

// ── Tier 2: recording-stub contract — the EXACT EVAL wiring the Lua needs ────
function makeRecordingStub() {
  const calls: { method: string; args: unknown[] }[] = [];
  return {
    calls,
    async eval(script: string, keys: string[], argv: string[]) {
      calls.push({ method: "eval", args: [script, keys, argv] });
      return 1; // → "claimed"; readEntries() then reads the empty hgetall below
    },
    async hgetall<T>(): Promise<T | null> {
      return null as T | null;
    },
    async hget<T>(): Promise<T | null> {
      return null as T | null;
    },
    async hkeys(): Promise<string[]> {
      return [];
    },
  };
}

describe("RedisBurnStore.claimAndUpsert — EVAL contract (recording stub)", () => {
  let stub: ReturnType<typeof makeRecordingStub>;
  let store: RedisBurnStore;

  beforeEach(() => {
    stub = makeRecordingStub();
    store = new RedisBurnStore(stub as unknown as never);
  });

  it("calls eval with [leaderboard, hist, claims] KEYS + the 8-ARGV layout", async () => {
    await store.claimAndUpsert(entry("alice"), TOKEN);
    const evalCall = stub.calls.find((c) => c.method === "eval");
    expect(evalCall).toBeDefined();
    const [script, keys, argv] = evalCall!.args as [string, string[], string[]];

    expect(keys).toEqual(["burn:leaderboard", "burn:hist:alice", "burn:claims:v1"]);
    expect(argv).toHaveLength(8);
    expect(argv[0]).toBe("alice"); // handle
    expect(argv[2]).toBe("1"); // isWeek
    expect(argv[3]).toBe(W1); // weekKey === since
    expect(argv[5]).toBe("12"); // KEEP_PER_HANDLE
    expect(argv[6]).toBe(activeStr(TOKEN)); // presented = sha256-v1:<hex>
    expect(argv[7]).toBe(LEGACY_LOCKED_STRING);

    // The presented value is the hash, never the raw token.
    expect(argv[6]).not.toContain(TOKEN);
    // Script shape: claim gate reads KEYS[3] first and returns the int matrix.
    expect(script).toContain("KEYS[3]");
    expect(script).toContain("return 4");
    expect(script).toContain("return 1");
    expect(script).toContain("return 0");
  });

  it("missing token → presented ARGV is '' (Lua decides invalid vs mismatch)", async () => {
    await store.claimAndUpsert(entry("alice"), undefined);
    const evalCall = stub.calls.find((c) => c.method === "eval")!;
    const argv = evalCall.args[2] as string[];
    expect(argv[6]).toBe("");
  });

  it("malformed token → returns invalid WITHOUT any Redis call (never hash junk)", async () => {
    const res = await store.claimAndUpsert(entry("alice"), "not-a-valid-token");
    expect(res.status).toBe("invalid");
    expect(stub.calls).toHaveLength(0); // no eval, no hget, no hgetall
  });
});
