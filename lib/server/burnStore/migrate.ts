// burnStore/migrate.ts — PURE planner for the A5 key-canonicalizing migration.
//
// THE A5 PROBLEM. Before PR2 the route stored handles RAW (`@Foo`, `Foo`, `FOO`
// each became their own leaderboard field + `burn:hist:<raw>` key). PR2 makes
// `claimAndUpsert` write the CANONICAL key (`foo`). The first canonical upsert of
// an existing handle would therefore SPLIT every legacy row: a stale raw orphan
// (`burn:leaderboard[@Foo]`) plus a new canonical row (`burn:leaderboard[foo]`),
// and — worse — the trend would VANISH, because Redis `readHistory()` discovers
// hist keys FROM the leaderboard's fields (redisStore.ts:333) and would look up
// `burn:hist:foo` (empty) while the points sit under `burn:hist:@Foo`.
//
// This module computes — with NO IO and NO side effects — exactly what must be
// rewritten to collapse every raw alias onto its canonical key BEFORE the gate
// flips to enforcing, then legacy-lock each canonical handle (grandfathered:
// no token was minted at upload time, so v1 recovery is manual). The store-
// specific executors (Upstash / `.data`) live in scripts/migrate-legacy-locks.ts
// and only READ → call planMigration → EXECUTE the returned plan. Keeping the
// decision logic pure is what makes the highest-risk unit unit-testable without
// a live Redis (unlike backfill-breakdown.ts, whose logic the test had to copy).
//
// SECURITY: operates only on already-DERIVED stored shapes (ImportedEntry /
// ImportHistoryPoint) — never the raw envelope, content, paths, or secrets. It
// never sees a claim TOKEN; it only writes the metadata-thin `legacy-locked`
// marker (claim hashes are irrelevant to grandfathering).

import type { ImportedEntry } from "@/lib/data";
import type { ImportHistoryPoint } from "@/lib/server/burnStore/types";
import { canonicalHandle, displayFormFor } from "@/lib/server/handle";
import { mergeNumerator } from "@/lib/server/burnStore/mergeNumerator";

// Mirror of fileStore/redisStore KEEP_PER_HANDLE. The migration must trim merged
// history to the SAME cap the live upsert enforces, or a collapsed handle would
// carry >12 weekly points until its next import re-trimmed it.
export const KEEP_PER_HANDLE = 12;

// The claim state of a canonical handle, abstracted away from each store's
// concrete encoding (Redis: `legacy-locked` | `sha256-v1:<hex>` | absent; file:
// ClaimRecord.kind | absent). The planner only needs these three buckets.
export type ClaimState = "none" | "legacyLocked" | "active";

// One leaderboard field as read from a store: the RAW field key (the hash field
// in Redis / `entry.handle` in the file array) and its stored entry. `rawHandle`
// is authoritative — `entry.handle` may equal it today but we key off the field.
export interface RawCard {
  rawHandle: string;
  entry: ImportedEntry;
}

// One hist key's full content: the RAW key suffix (`burn:hist:<rawHandle>`) and
// every weekly point under it.
export interface RawHistory {
  rawHandle: string;
  points: ImportHistoryPoint[];
}

export interface MigrationInput {
  cards: RawCard[];
  histories: RawHistory[];
  // Claim state lookup BY CANONICAL handle. Missing handle → "none".
  claimState: (canonical: string) => ClaimState;
}

export type GroupStatus =
  // Raw aliases remain, OR the canonical handle is not yet legacy-locked → write.
  | "migrate"
  // Single canonical field, no raw alias hist key, claim already legacy-locked.
  | "skip-clean"
  // An ACTIVE claim exists for this canonical handle. Never clobber a real
  // claimant's card/token — leave the whole group untouched and warn. (Should
  // not occur pre-flip; a defensive guard against running post-enforcing.)
  | "skip-active-claim";

export interface GroupPlan {
  canonical: string;
  status: GroupStatus;
  // >1 distinct alias card collapsed onto this canonical key.
  collision: boolean;
  // The winning card, re-keyed to canonical (+ displayHandle when casing
  // differs). null only for skip-active-claim (we keep the store's rows as-is).
  canonicalCard: ImportedEntry | null;
  // Merged history for the canonical key: one point per weekKey (newest
  // importedAt wins), handle canonicalized, group display applied, trimmed to
  // KEEP_PER_HANDLE. Empty when the group has no weekly history.
  canonicalHistory: ImportHistoryPoint[];
  // weekKeys ALREADY present under the canonical hist key that are NOT in the
  // merged set (lost a collision, or trimmed past the cap). The Redis executor
  // HDELs these so a re-run can't leave a stale canonical point.
  staleCanonicalWeekKeys: string[];
  // Raw NON-canonical leaderboard fields to HDEL (guard: raw !== canonical, so an
  // already-canonical row never deletes itself).
  removeCardFields: string[];
  // Raw NON-canonical hist keys to DEL (same guard). Their points are already
  // merged into canonicalHistory before deletion.
  removeHistKeys: string[];
  // Write the `legacy-locked` claim for this canonical handle?
  writeClaim: boolean;
  notes: string[];
}

export interface MigrationPlan {
  groups: GroupPlan[];
  // Raw fields/keys whose handle cannot be canonicalized (e.g. an underscore the
  // new charset rejects). Left UNTOUCHED — a future upload of such a handle 400s
  // at the route, so the row is unreachable but never split. Reported, not acted.
  uncanonicalizable: { rawHandle: string; kind: "card" | "history" }[];
  // Canonical keys that have history but NO leaderboard card. Orphan history that
  // readHistory would never surface (no leaderboard field to discover it from).
  // Reported, left as-is — out of scope for a key-collapse migration.
  orphanHistoryWithoutCard: string[];
}

// Newest card by importedAt, with the VES numerator FOLDED across every alias in
// the group. Naively picking the newest card alone would regress a SAME-WEEK
// alias's higher-precedence CLI count (mergeNumerator only carries a count when
// `since` matches, and a browser-fsa newest card would otherwise erase an older
// same-week CLI count — the exact "VES column disappeared" failure mergeNumerator
// exists to prevent). Different-week aliases are unaffected: mergeNumerator
// returns the winner's own numerator, so newest-week semantics still hold.
function foldWinner(cards: RawCard[], canonical: string): RawCard {
  const sorted = [...cards].sort((a, b) => {
    const byTime = b.entry.importedAt.localeCompare(a.entry.importedAt);
    if (byTime !== 0) return byTime;
    // importedAt TIE → deterministic, crash-replay-stable order. A naive sort
    // leaves the winner at the mercy of snapshot field order (Redis hgetall is
    // unordered), so a crash after op-1 — which injects the canonical row at the
    // winner's OWN importedAt — could let a different card win the rerun and
    // diverge. Prefer the already-canonical row (a prior run's self-healed
    // winner carries that run's exact payload + casing, so reruns lock onto it),
    // then break remaining ties by rawHandle for a total order.
    const aCanon = a.rawHandle === canonical ? 0 : 1;
    const bCanon = b.rawHandle === canonical ? 0 : 1;
    if (aCanon !== bCanon) return aCanon - bCanon;
    return a.rawHandle.localeCompare(b.rawHandle);
  });
  let entry = sorted[0].entry;
  for (const loser of sorted.slice(1)) {
    // existing = older alias, incoming = running winner: keeps the winner's card
    // fields, lifts the higher-precedence numerator only when same-week.
    entry = { ...entry, ...mergeNumerator(loser.entry, entry) };
  }
  return { rawHandle: sorted[0].rawHandle, entry };
}

// The original casing to render for a group. Prefer a displayHandle the winner
// already carries (a prior migration run wrote the canonical row with
// displayHandle="Foo"; on crash-replay that row can win the importedAt tie, and
// its raw form "foo" === canonical would otherwise lose the casing) — but only
// when it canonicalizes back to THIS group, else fall back to the winner's own
// raw casing. Guarantees the same display whether the winner is the original raw
// alias or the self-healed canonical row.
function chooseDisplay(winner: RawCard, canonical: string): string {
  const carried = winner.entry.displayHandle;
  if (carried != null && canonicalHandle(carried) === canonical) {
    return carried;
  }
  return displayFormFor(winner.rawHandle);
}

// Re-key a winning card to canonical, attaching displayHandle ONLY when the
// chosen original casing differs (parity with buildImportedEntry / the stores).
function canonicalizeCard(
  winner: ImportedEntry,
  canonical: string,
  display: string,
): ImportedEntry {
  const card: ImportedEntry = { ...winner, handle: canonical };
  if (display !== canonical) {
    card.displayHandle = display;
  } else {
    // A prior raw row may have carried a stale displayHandle equal to canonical;
    // drop it so canonical rows stay display-less (the stores' invariant).
    delete card.displayHandle;
  }
  return card;
}

// Merge every point across a group's hist keys into one canonical series: one
// point per weekKey (newest importedAt wins the collision), handle canonicalized,
// the group's chosen display applied uniformly (render parity with the card),
// sorted ascending, trimmed to the newest KEEP_PER_HANDLE.
function mergeHistory(
  points: ImportHistoryPoint[],
  canonical: string,
  display: string,
): ImportHistoryPoint[] {
  const byWeek = new Map<string, ImportHistoryPoint>();
  for (const p of points) {
    const prev = byWeek.get(p.weekKey);
    if (prev == null || p.importedAt.localeCompare(prev.importedAt) > 0) {
      byWeek.set(p.weekKey, p);
    }
  }
  return [...byWeek.values()]
    .map((p) => {
      const point: ImportHistoryPoint = {
        handle: canonical,
        weekKey: p.weekKey,
        totalTokens: p.totalTokens,
        importedAt: p.importedAt,
        ...(display !== canonical ? { displayHandle: display } : {}),
      };
      return point;
    })
    .sort((a, b) => a.weekKey.localeCompare(b.weekKey))
    .slice(-KEEP_PER_HANDLE);
}

/**
 * Compute the full migration plan from a store snapshot. PURE — no IO, no
 * mutation of the inputs. The executor decides apply-vs-dry-run; this only says
 * WHAT must change. Idempotent by construction: a group is "skip-clean" ONLY when
 * no raw alias field/key remains AND the claim is already legacy-locked, so a
 * crashed re-run with residual aliases still re-plans them (the over-broad
 * "canonical field + claim exists = skip" would strand them).
 */
export function planMigration(input: MigrationInput): MigrationPlan {
  const uncanonicalizable: MigrationPlan["uncanonicalizable"] = [];
  const orphanHistoryWithoutCard: string[] = [];

  // Group cards by canonical key; collect un-canonicalizable fields.
  const cardGroups = new Map<string, RawCard[]>();
  for (const card of input.cards) {
    const canonical = canonicalHandle(card.rawHandle);
    if (canonical === null) {
      uncanonicalizable.push({ rawHandle: card.rawHandle, kind: "card" });
      continue;
    }
    const list = cardGroups.get(canonical) ?? [];
    list.push(card);
    cardGroups.set(canonical, list);
  }

  // Group hist keys by canonical key; collect un-canonicalizable hist keys.
  const histGroups = new Map<string, RawHistory[]>();
  for (const hist of input.histories) {
    const canonical = canonicalHandle(hist.rawHandle);
    if (canonical === null) {
      uncanonicalizable.push({ rawHandle: hist.rawHandle, kind: "history" });
      continue;
    }
    const list = histGroups.get(canonical) ?? [];
    list.push(hist);
    histGroups.set(canonical, list);
  }

  const groups: GroupPlan[] = [];
  // Plan in canonical-key order for a deterministic report.
  const canonicalKeys = [...new Set([...cardGroups.keys(), ...histGroups.keys()])].sort();

  for (const canonical of canonicalKeys) {
    const cards = cardGroups.get(canonical) ?? [];
    const hists = histGroups.get(canonical) ?? [];

    // History with no anchoring leaderboard card: out of scope (readHistory could
    // never surface it). Report and leave the raw hist key as-is.
    if (cards.length === 0) {
      orphanHistoryWithoutCard.push(canonical);
      continue;
    }

    const claim = input.claimState(canonical);

    // Defensive: an ACTIVE claim must never be clobbered. Pre-flip there are none;
    // if the migration is mis-run post-enforcing, freeze the whole group.
    if (claim === "active") {
      groups.push({
        canonical,
        status: "skip-active-claim",
        collision: cards.length > 1,
        canonicalCard: null,
        canonicalHistory: [],
        staleCanonicalWeekKeys: [],
        removeCardFields: [],
        removeHistKeys: [],
        writeClaim: false,
        notes: [
          "active claim present — left untouched; investigate (migration is a pre-flip step).",
        ],
      });
      continue;
    }

    const winner = foldWinner(cards, canonical);
    const display = chooseDisplay(winner, canonical);
    const canonicalCard = canonicalizeCard(winner.entry, canonical, display);

    const allPoints = hists.flatMap((h) => h.points);
    const canonicalHistory = mergeHistory(allPoints, canonical, display);

    // weekKeys already under the canonical hist key but not in the merged set —
    // a collision loser or a trimmed point. The Redis executor HDELs these.
    const canonicalHist = hists.find((h) => h.rawHandle === canonical);
    const mergedWeekKeys = new Set(canonicalHistory.map((p) => p.weekKey));
    const staleCanonicalWeekKeys = (canonicalHist?.points ?? [])
      .map((p) => p.weekKey)
      .filter((wk) => !mergedWeekKeys.has(wk));

    const removeCardFields = cards
      .map((c) => c.rawHandle)
      .filter((r) => r !== canonical);
    const removeHistKeys = hists
      .map((h) => h.rawHandle)
      .filter((r) => r !== canonical);

    const rawAliasRemains =
      removeCardFields.length > 0 || removeHistKeys.length > 0;
    const writeClaim = claim !== "legacyLocked";

    // Clean ONLY when nothing aliases AND the claim is already locked. Otherwise
    // a residual alias (crashed prior run) or a missing lock keeps it actionable.
    if (!rawAliasRemains && !writeClaim) {
      groups.push({
        canonical,
        status: "skip-clean",
        collision: false,
        canonicalCard,
        canonicalHistory,
        staleCanonicalWeekKeys,
        removeCardFields: [],
        removeHistKeys: [],
        writeClaim: false,
        notes: ["already canonical + legacy-locked"],
      });
      continue;
    }

    const notes: string[] = [];
    if (removeCardFields.length > 0) {
      notes.push(`collapse fields [${removeCardFields.join(", ")}] → ${canonical}`);
    }
    if (removeHistKeys.length > 0) {
      notes.push(
        `rename hist [${removeHistKeys.map((r) => `burn:hist:${r}`).join(", ")}] → burn:hist:${canonical}`,
      );
    }
    if (staleCanonicalWeekKeys.length > 0) {
      notes.push(`drop stale canonical weekKeys [${staleCanonicalWeekKeys.join(", ")}]`);
    }
    if (writeClaim) notes.push("legacy-lock");

    groups.push({
      canonical,
      status: "migrate",
      collision: cards.length > 1,
      canonicalCard,
      canonicalHistory,
      staleCanonicalWeekKeys,
      removeCardFields,
      removeHistKeys,
      writeClaim,
      notes,
    });
  }

  return { groups, uncanonicalizable, orphanHistoryWithoutCard };
}

/** Render a plan as human-readable dry-run lines (pure — testable). */
export function renderPlan(plan: MigrationPlan): string[] {
  const lines: string[] = [];
  let migrateCount = 0;
  let skipClean = 0;
  let skipActive = 0;

  for (const g of plan.groups) {
    if (g.status === "skip-clean") {
      skipClean++;
      lines.push(`  SKIP-CLEAN  ${g.canonical}  (already canonical + legacy-locked)`);
    } else if (g.status === "skip-active-claim") {
      skipActive++;
      lines.push(`  WARN        ${g.canonical}  active claim — left untouched (investigate)`);
    } else {
      migrateCount++;
      const collide = g.collision ? "  [collision]" : "";
      lines.push(`  MIGRATE     ${g.canonical}${collide}`);
      for (const note of g.notes) lines.push(`              - ${note}`);
    }
  }

  for (const u of plan.uncanonicalizable) {
    lines.push(
      `  WARN        cannot canonicalize ${u.kind} "${u.rawHandle}" — left untouched (future uploads 400)`,
    );
  }
  for (const c of plan.orphanHistoryWithoutCard) {
    lines.push(`  WARN        history "${c}" has no leaderboard card — left untouched`);
  }

  lines.push("");
  lines.push(
    `  summary: ${migrateCount} migrate, ${skipClean} skip-clean, ${skipActive} active-skip, ` +
      `${plan.uncanonicalizable.length} uncanonicalizable, ${plan.orphanHistoryWithoutCard.length} orphan-history`,
  );
  return lines;
}
