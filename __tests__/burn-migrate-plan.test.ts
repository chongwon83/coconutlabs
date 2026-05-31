// burn-migrate-plan.test.ts — the A5 migration PLANNER (pure, no IO).
//
// planMigration is the brain of the key-canonicalizing migration: it decides how
// raw alias rows (`@Foo`/`Foo`/`FOO`) collapse onto one canonical key (`foo`)
// WITHOUT splitting the row or losing the trend. These tests lock the four codex-
// flagged hazards at the pure level:
//   - newest-card-wins BUT numerator folded across same-week aliases (no VES loss)
//   - per-weekKey history merge by newest importedAt (collision can't lose a point)
//   - displayHandle = chosen original casing, on card AND history
//   - idempotency: skip ONLY when no raw alias remains AND already legacy-locked
//   - rename hist keys (Q4: readHistory derives keys from leaderboard fields)
// Plus: uncanonicalizable handles, orphan history, active-claim guard, legacy-lock.

import { describe, it, expect } from "vitest";
import type { ImportedEntry } from "@/lib/data";
import type { ImportHistoryPoint } from "@/lib/server/burnStore/types";
import {
  planMigration,
  renderPlan,
  KEEP_PER_HANDLE,
  type ClaimState,
  type RawCard,
  type RawHistory,
} from "@/lib/server/burnStore/migrate";

const W1 = "2026-05-11T00:00:00Z";
const W2 = "2026-05-18T00:00:00Z";

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

function card(rawHandle: string, overrides: Partial<ImportedEntry> = {}): RawCard {
  return { rawHandle, entry: entry(rawHandle, overrides) };
}

function point(overrides: Partial<ImportHistoryPoint> = {}): ImportHistoryPoint {
  return {
    handle: "foo",
    weekKey: W1,
    totalTokens: 100,
    importedAt: "2026-05-20T12:00:00Z",
    ...overrides,
  };
}

function hist(rawHandle: string, points: ImportHistoryPoint[]): RawHistory {
  return { rawHandle, points };
}

// Default: nothing claimed → every handle mintable/lockable.
const noClaims: (h: string) => ClaimState = () => "none";

describe("planMigration — alias collapse + winner selection", () => {
  it("collapses @Foo/Foo/FOO onto canonical foo; newest importedAt wins; displayHandle = winner casing", () => {
    const plan = planMigration({
      cards: [
        card("@Foo", { importedAt: "2026-05-20T01:00:00Z", totalTokens: 1 }),
        card("Foo", { importedAt: "2026-05-20T03:00:00Z", totalTokens: 2 }), // newest
        card("FOO", { importedAt: "2026-05-20T02:00:00Z", totalTokens: 3 }),
      ],
      histories: [],
      claimState: noClaims,
    });

    expect(plan.groups).toHaveLength(1);
    const g = plan.groups[0];
    expect(g.canonical).toBe("foo");
    expect(g.status).toBe("migrate");
    expect(g.collision).toBe(true);
    expect(g.canonicalCard?.handle).toBe("foo");
    expect(g.canonicalCard?.displayHandle).toBe("Foo"); // winner = "Foo"
    expect(g.canonicalCard?.totalTokens).toBe(2); // newest card's payload
    // ALL three raw fields are removed — the canonical "foo" field is freshly
    // written, and the winner's own raw field "Foo" (!= "foo") is an alias too.
    expect(g.removeCardFields.sort()).toEqual(["@Foo", "FOO", "Foo"]);
    expect(g.writeClaim).toBe(true);
  });

  it("an already-canonical winner drops any stale displayHandle", () => {
    const plan = planMigration({
      cards: [card("foo", { displayHandle: "foo" })],
      histories: [],
      claimState: noClaims,
    });
    expect(plan.groups[0].canonicalCard?.displayHandle).toBeUndefined();
  });

  it("crash-replay: a self-healed canonical row preserves display casing regardless of card order (codex challenge)", () => {
    // Crash after Redis op-1 leaves BOTH the original raw `Foo` AND the
    // self-created canonical `foo` (displayHandle "Foo", SAME importedAt). The
    // rerun snapshot (Redis hgetall is unordered) can present them either way;
    // the plan must converge to display "Foo" — not silently drop it when the
    // self-healed `foo` row wins the importedAt tie.
    const rawFoo = card("Foo", { importedAt: "2026-01-01T00:00:00Z" });
    const healedFoo = card("foo", {
      importedAt: "2026-01-01T00:00:00Z",
      displayHandle: "Foo",
    });
    for (const cards of [
      [rawFoo, healedFoo],
      [healedFoo, rawFoo],
    ]) {
      const plan = planMigration({ cards, histories: [], claimState: noClaims });
      const c = plan.groups[0].canonicalCard;
      expect(c?.handle).toBe("foo");
      expect(c?.displayHandle).toBe("Foo"); // casing survives the tie, both orders
      // The stale raw `Foo` field is still cleaned; canonical `foo` is overwritten.
      expect(plan.groups[0].removeCardFields).toEqual(["Foo"]);
    }
  });
});

describe("planMigration — numerator fold (no VES regression)", () => {
  it("a same-week CLI count on an OLDER alias survives a newer browser-fsa winner", () => {
    const plan = planMigration({
      cards: [
        card("@Foo", {
          importedAt: "2026-05-20T01:00:00Z",
          since: W1,
          fixes: 100,
          fixesSource: "cli",
        }),
        card("foo", {
          importedAt: "2026-05-20T05:00:00Z", // newest
          since: W1,
          fixes: 5,
          fixesSource: "browser-fsa",
        }),
      ],
      histories: [],
      claimState: noClaims,
    });
    const c = plan.groups[0].canonicalCard;
    expect(c?.fixes).toBe(100); // cli(2) > browser-fsa(1), same week
    expect(c?.fixesSource).toBe("cli");
  });

  it("a DIFFERENT-week older CLI count does NOT carry (newest week's numerator stands)", () => {
    const plan = planMigration({
      cards: [
        card("@Foo", {
          importedAt: "2026-05-13T01:00:00Z",
          since: W1,
          fixes: 100,
          fixesSource: "cli",
        }),
        card("foo", {
          importedAt: "2026-05-20T05:00:00Z", // newest, different week
          since: W2,
          fixes: undefined,
          fixesSource: undefined,
        }),
      ],
      histories: [],
      claimState: noClaims,
    });
    const c = plan.groups[0].canonicalCard;
    expect(c?.since).toBe(W2);
    expect(c?.fixes).toBeUndefined();
  });
});

describe("planMigration — history merge + key rename (Q4)", () => {
  it("merges same-weekKey points across alias hist keys, newest importedAt wins, canonicalizes handle + display", () => {
    const plan = planMigration({
      cards: [
        card("@Foo", { importedAt: "2026-05-20T01:00:00Z" }),
        card("Foo", { importedAt: "2026-05-20T05:00:00Z" }), // winner → display "Foo"
      ],
      histories: [
        hist("@Foo", [
          point({ handle: "@Foo", weekKey: W1, totalTokens: 10, importedAt: "2026-05-20T01:00:00Z" }),
        ]),
        hist("Foo", [
          point({ handle: "Foo", weekKey: W1, totalTokens: 20, importedAt: "2026-05-20T05:00:00Z" }),
        ]),
      ],
      claimState: noClaims,
    });
    const g = plan.groups[0];
    expect(g.canonicalHistory).toHaveLength(1);
    const p = g.canonicalHistory[0];
    expect(p.weekKey).toBe(W1);
    expect(p.totalTokens).toBe(20); // newest importedAt wins the collision
    expect(p.handle).toBe("foo");
    expect(p.displayHandle).toBe("Foo");
    // Both raw hist keys flagged for rename → canonical (Q4: readHistory derives
    // hist keys from leaderboard fields, so they MUST move).
    expect(g.removeHistKeys.sort()).toEqual(["@Foo", "Foo"]);
  });

  it("trims merged history to KEEP_PER_HANDLE and flags trimmed canonical weekKeys as stale", () => {
    const many: ImportHistoryPoint[] = [];
    for (let i = 0; i < KEEP_PER_HANDLE + 3; i++) {
      const wk = `2026-${String(i + 1).padStart(2, "0")}-01T00:00:00Z`;
      many.push(point({ handle: "foo", weekKey: wk, importedAt: wk }));
    }
    const plan = planMigration({
      cards: [card("foo")],
      histories: [hist("foo", many)],
      claimState: noClaims,
    });
    const g = plan.groups[0];
    expect(g.canonicalHistory).toHaveLength(KEEP_PER_HANDLE);
    // The 3 oldest weekKeys are trimmed → reported stale so the executor HDELs them.
    expect(g.staleCanonicalWeekKeys).toHaveLength(3);
    // Kept set is the NEWEST 12 by weekKey.
    const kept = g.canonicalHistory.map((p) => p.weekKey);
    expect(kept[0] > g.staleCanonicalWeekKeys.sort().at(-1)!).toBe(true);
  });
});

describe("planMigration — idempotency", () => {
  it("skip-clean: single canonical field, no alias, already legacy-locked", () => {
    const claimLocked: (h: string) => ClaimState = (h) => (h === "foo" ? "legacyLocked" : "none");
    const plan = planMigration({
      cards: [card("foo")],
      histories: [hist("foo", [point({ handle: "foo" })])],
      claimState: claimLocked,
    });
    const g = plan.groups[0];
    expect(g.status).toBe("skip-clean");
    expect(g.removeCardFields).toEqual([]);
    expect(g.removeHistKeys).toEqual([]);
    expect(g.writeClaim).toBe(false);
  });

  it("a crashed re-run with a RESIDUAL raw alias still re-plans it (not over-broad skip)", () => {
    const claimLocked: (h: string) => ClaimState = (h) => (h === "foo" ? "legacyLocked" : "none");
    const plan = planMigration({
      // canonical row already written + locked, but @Foo alias survived the crash
      cards: [card("foo"), card("@Foo")],
      histories: [hist("@Foo", [point({ handle: "@Foo" })])],
      claimState: claimLocked,
    });
    const g = plan.groups[0];
    expect(g.status).toBe("migrate");
    expect(g.removeCardFields).toEqual(["@Foo"]);
    expect(g.removeHistKeys).toEqual(["@Foo"]);
    expect(g.writeClaim).toBe(false); // already locked — don't re-lock
  });

  it("an unclaimed clean canonical row still migrates to WRITE the legacy lock", () => {
    const plan = planMigration({
      cards: [card("foo")],
      histories: [],
      claimState: noClaims,
    });
    const g = plan.groups[0];
    expect(g.status).toBe("migrate");
    expect(g.removeCardFields).toEqual([]);
    expect(g.writeClaim).toBe(true);
  });
});

describe("planMigration — guards + edge cases", () => {
  it("an active claim freezes the whole group (never clobbered)", () => {
    const active: (h: string) => ClaimState = (h) => (h === "foo" ? "active" : "none");
    const plan = planMigration({
      cards: [card("foo"), card("@Foo")],
      histories: [],
      claimState: active,
    });
    const g = plan.groups[0];
    expect(g.status).toBe("skip-active-claim");
    expect(g.canonicalCard).toBeNull();
    expect(g.removeCardFields).toEqual([]);
    expect(g.writeClaim).toBe(false);
  });

  it("an un-canonicalizable handle (underscore) is reported, never grouped or locked", () => {
    const plan = planMigration({
      cards: [card("@foo_bar"), card("ok")],
      histories: [hist("@foo_bar", [point({ handle: "@foo_bar" })])],
      claimState: noClaims,
    });
    expect(plan.uncanonicalizable).toEqual(
      expect.arrayContaining([
        { rawHandle: "@foo_bar", kind: "card" },
        { rawHandle: "@foo_bar", kind: "history" },
      ]),
    );
    // Only the valid "ok" handle forms a group.
    expect(plan.groups.map((g) => g.canonical)).toEqual(["ok"]);
  });

  it("history with no leaderboard card is reported as orphan, not migrated", () => {
    const plan = planMigration({
      cards: [card("foo")],
      histories: [
        hist("foo", [point({ handle: "foo" })]),
        hist("ghost", [point({ handle: "ghost", weekKey: W1 })]),
      ],
      claimState: noClaims,
    });
    expect(plan.orphanHistoryWithoutCard).toEqual(["ghost"]);
    expect(plan.groups.map((g) => g.canonical)).toEqual(["foo"]);
  });
});

describe("renderPlan", () => {
  it("summarizes migrate / skip / warn lines deterministically", () => {
    const plan = planMigration({
      cards: [card("@Foo"), card("Foo"), card("solo")],
      histories: [],
      claimState: (h) => (h === "solo" ? "legacyLocked" : "none"),
    });
    const lines = renderPlan(plan).join("\n");
    expect(lines).toContain("MIGRATE     foo");
    expect(lines).toContain("[collision]");
    expect(lines).toContain("SKIP-CLEAN  solo");
    expect(lines).toMatch(/summary: 1 migrate, 1 skip-clean/);
  });
});
