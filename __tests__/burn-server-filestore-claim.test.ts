// burn-server-filestore-claim.test.ts — FileBurnStore.claimAndUpsert (spec §2.3)
// at the persistence layer. claim.ts unit-tests decideClaim; burn-server-
// memorystore tests the in-process wiring. This proves the FILE store:
//   - persists the claim to .data/claims.json (the FULL ClaimRecord union, A2)
//   - writes nothing (card OR claim) on a rejected claim — durability of refusal
//   - honors a seeded legacyLocked record (the migration's output shape) → 409
//   - self-heals a crash that wrote the claim but not the card (mint ordering)
//   - keeps the mergeNumerator precedence merge through the gate (§3.5 P1)
//
// Isolation: FileBurnStore captures process.cwd() into module path constants at
// import, so we spy cwd() → a tmpdir and re-import per test (mirrors
// burn-numerator-precedence). claim.ts is pure (no module state), so the
// statically-imported hash helpers and the store's own copy agree.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { ImportedEntry } from "@/lib/data";
import type { BurnStore } from "@/lib/server/burnStore/types";
import {
  hashToken,
  makeActiveRecord,
  makeLegacyRecord,
} from "@/lib/server/claim";
import type { ClaimRecord } from "@/lib/server/claim";

const TOKEN = "A".repeat(43); // valid 43-char base64url
const OTHER = "B".repeat(43);
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

let tmpRoot: string;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let FileBurnStoreCtor: any;

const claimsPath = () => path.join(tmpRoot, ".data", "claims.json");
function seedClaims(map: Record<string, ClaimRecord>): void {
  mkdirSync(path.join(tmpRoot, ".data"), { recursive: true });
  writeFileSync(claimsPath(), JSON.stringify(map, null, 2), "utf-8");
}
function readClaimsFile(): Record<string, ClaimRecord> {
  return JSON.parse(readFileSync(claimsPath(), "utf-8"));
}

beforeEach(async () => {
  tmpRoot = mkdtempSync(path.join(tmpdir(), "burn-claim-"));
  vi.spyOn(process, "cwd").mockReturnValue(tmpRoot);
  vi.resetModules();
  const mod = await import("@/lib/server/burnStore/fileStore");
  FileBurnStoreCtor = mod.FileBurnStore;
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(tmpRoot, { recursive: true, force: true });
});

describe("FileBurnStore.claimAndUpsert — mint + persistence", () => {
  it("unclaimed + valid token → claimed; writes card, history, and an active claim to disk", async () => {
    const store: BurnStore = new FileBurnStoreCtor();
    const res = await store.claimAndUpsert(entry("alice"), TOKEN);
    expect(res.status).toBe("claimed");
    if (res.status === "claimed") expect(res.entries).toHaveLength(1);

    expect(await store.readEntries()).toHaveLength(1);
    expect(await store.readHistory()).toHaveLength(1);

    // The FULL union is on disk, keyed by canonical handle, hash domain-separated.
    const claims = readClaimsFile();
    expect(claims.alice.kind).toBe("active");
    if (claims.alice.kind === "active") {
      expect(claims.alice.handleKey).toBe("alice");
      expect(claims.alice.tokenHash).toBe(hashToken(TOKEN));
      expect(claims.alice.scheme).toBe("sha256-v1");
      expect(typeof claims.alice.createdAt).toBe("string");
    }
  });

  it("re-upload with the SAME token → ok; the claim PERSISTS across a fresh store instance", async () => {
    const a: BurnStore = new FileBurnStoreCtor();
    await a.claimAndUpsert(entry("alice"), TOKEN);

    // A brand-new instance reads claims.json from disk — proves durability.
    const b: BurnStore = new FileBurnStoreCtor();
    const res = await b.claimAndUpsert(
      entry("alice", { totalTokens: 99999, importedAt: "2026-05-21T12:00:00Z" }),
      TOKEN,
    );
    expect(res.status).toBe("ok");
    const board = await b.readEntries();
    expect(board).toHaveLength(1);
    expect(board[0].totalTokens).toBe(99999);
  });
});

describe("FileBurnStore.claimAndUpsert — refusal writes nothing", () => {
  it("wrong token on a claimed handle → mismatch; card untouched, no extra claim", async () => {
    const store: BurnStore = new FileBurnStoreCtor();
    await store.claimAndUpsert(entry("alice", { totalTokens: 1000 }), TOKEN);
    const res = await store.claimAndUpsert(entry("alice", { totalTokens: 7 }), OTHER);
    expect(res.status).toBe("mismatch");
    expect("entries" in res).toBe(false);
    expect((await store.readEntries())[0].totalTokens).toBe(1000);
    // claim record is still the original active one (not overwritten)
    const rec = readClaimsFile().alice;
    expect(rec.kind).toBe("active");
    if (rec.kind === "active") expect(rec.tokenHash).toBe(hashToken(TOKEN));
  });

  it("unclaimed + missing token → invalid; no card, no claims file created", async () => {
    const store: BurnStore = new FileBurnStoreCtor();
    const res = await store.claimAndUpsert(entry("alice"), undefined);
    expect(res.status).toBe("invalid");
    expect(await store.readEntries()).toEqual([]);
    expect(existsSync(claimsPath())).toBe(false);
  });

  it("unclaimed + malformed token → invalid; never mints", async () => {
    const store: BurnStore = new FileBurnStoreCtor();
    expect((await store.claimAndUpsert(entry("alice"), "tooshort")).status).toBe(
      "invalid",
    );
    expect(await store.readEntries()).toEqual([]);
    // a valid token still mints fresh afterward
    expect((await store.claimAndUpsert(entry("alice"), TOKEN)).status).toBe(
      "claimed",
    );
  });

  it("seeded legacyLocked record → legacyLocked (409) regardless of token; no write", async () => {
    seedClaims({ ghost: makeLegacyRecord("ghost", false, "2026-01-01T00:00:00Z") });
    const store: BurnStore = new FileBurnStoreCtor();
    expect((await store.claimAndUpsert(entry("ghost"), TOKEN)).status).toBe(
      "legacyLocked",
    );
    expect((await store.claimAndUpsert(entry("ghost"), undefined)).status).toBe(
      "legacyLocked",
    );
    expect(await store.readEntries()).toEqual([]);
  });
});

describe("FileBurnStore.claimAndUpsert — crash recovery + numerator merge", () => {
  it("self-heals a claim-without-card crash: same token re-upload writes the missing card", async () => {
    // Simulate the mint half-completing: claims.json has the active record but
    // no leaderboard.json was ever written (crash between the two writes).
    seedClaims({
      alice: makeActiveRecord("alice", hashToken(TOKEN), "2026-01-01T00:00:00Z"),
    });
    const store: BurnStore = new FileBurnStoreCtor();
    expect(await store.readEntries()).toEqual([]); // no card yet

    const res = await store.claimAndUpsert(entry("alice"), TOKEN);
    expect(res.status).toBe("ok"); // matching token → upsert, NOT a re-mint
    expect(await store.readEntries()).toHaveLength(1);
  });

  it("preserves mergeNumerator precedence through the claim gate (§3.5 P1)", async () => {
    const store: BurnStore = new FileBurnStoreCtor();
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
    const store: BurnStore = new FileBurnStoreCtor();
    await store.claimAndUpsert(entry("alice", { displayHandle: "Alice" }), TOKEN);
    const board = await store.readEntries();
    expect(board[0].displayHandle).toBe("Alice");
    const hist = await store.readHistory();
    expect(hist[0].displayHandle).toBe("Alice");
  });
});
