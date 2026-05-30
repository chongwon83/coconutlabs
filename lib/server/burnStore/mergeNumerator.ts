// mergeNumerator.ts — pure precedence merge for the VES numerator (`fixes`).
//
// All three BurnStore implementations (file/memory/redis) replace a handle's
// card wholesale on re-import. Without this helper, a later upload that omits
// the numerator — or carries a lower browser-counted one — would erase or lower
// a CLI count imported earlier. (This is the root cause of the prior "VES
// column disappeared after re-upload" incident.) The helper isolates the
// numerator so the merged card keeps the authoritative count regardless of
// which surface re-imported.
//
// Precedence (rank): cli (2) > browser-fsa (1) > absent (0).
//  - A higher-rank incoming count wins.
//  - A lower-rank incoming count NEVER overwrites or lowers the existing one
//    (absent can't erase present; browser-fsa can't clobber/lower cli).
//  - Equal rank, cli: newest import wins (incoming).
//  - Equal rank, browser-fsa: keep the larger count (max) — more repos scanned.
//  - Different `since` (different week): no carry. The numerator belongs to a
//    specific window, so the incoming card's own count stands.
//
// LEGACY ROW TRAP: rows persisted before `fixesSource` existed have `fixes` set
// but `fixesSource` undefined, and never passed through envelope validation.
// rankSource() treats fixes-present + source-absent as CLI(2) so the first
// browser-fsa upload cannot clobber a legacy CLI count. Each store's
// hydrateEntry() also backfills "cli" on read, in lockstep with this rule.

import type { ImportedEntry } from "@/lib/data";

export type NumeratorSource = "cli" | "browser-fsa";

// The minimal numerator-bearing shape the merge reads. ImportedEntry satisfies
// it structurally; tests can pass plain object literals.
export interface NumeratorFields {
  fixes?: number;
  fixesSource?: NumeratorSource;
  since?: string | null;
}

// The patch the caller spreads over the incoming entry.
type NumeratorPatch = Pick<ImportedEntry, "fixes" | "fixesSource">;

// Rank a numerator by trust. Absent (no count) is 0. A present count whose
// source is missing is treated as CLI — see LEGACY ROW TRAP above.
export function rankSource(e: NumeratorFields | null | undefined): 0 | 1 | 2 {
  if (e == null || e.fixes == null) return 0;
  if (e.fixesSource === "browser-fsa") return 1;
  return 2; // "cli" OR (fixes present && source absent = legacy CLI)
}

// An entry's own numerator, normalized: a present count with an absent source
// becomes "cli"; an absent count yields an empty patch.
function ownNumerator(e: NumeratorFields): NumeratorPatch {
  if (e.fixes == null) return {};
  return { fixes: e.fixes, fixesSource: e.fixesSource ?? "cli" };
}

// Compute the numerator fields the merged card should carry. Callers spread the
// result over the incoming entry: `{ ...incoming, ...mergeNumerator(prev, in) }`.
// Returns `{}` only when both sides are numerator-absent (incoming then stays
// absent); otherwise a concrete { fixes, fixesSource }.
export function mergeNumerator(
  existing: NumeratorFields | null | undefined,
  incoming: NumeratorFields,
): NumeratorPatch {
  // No prior card, or a different week: the incoming card's own numerator stands.
  if (existing == null) return ownNumerator(incoming);
  if (existing.since !== incoming.since) return ownNumerator(incoming);

  const rE = rankSource(existing);
  const rI = rankSource(incoming);
  if (rI > rE) return ownNumerator(incoming);
  if (rI < rE) return ownNumerator(existing); // absent can't erase; browser can't lower cli

  // Equal rank, same week.
  if (rI === 2) return ownNumerator(incoming); // newest cli wins
  if (rI === 1) {
    // both browser-fsa: keep the larger count (more repos granted/scanned)
    const fixes = Math.max(existing.fixes as number, incoming.fixes as number);
    return { fixes, fixesSource: "browser-fsa" };
  }
  return {}; // both absent
}
