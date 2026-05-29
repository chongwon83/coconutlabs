// useColumnSort.ts — generic column-sort state for the Burn Index leaderboard.
//
// Default sort is data-dependent: VES desc once the VES column is revealed
// (≥ VES_REVEAL_THRESHOLD nonzero scores), else most-tokens desc. The caller
// passes that computed `defaultKey`; because entries load async, a reconcile
// effect re-applies the default when it changes — but never after the user has
// manually toggled a column. This hook owns sort state + the comparator;
// BurnIndexSection wires the header button onClick to toggle() and reads
// ariaSort(key) for screen-reader hints.
//
// Direction rules (column switch):
//   handle           → asc  (A→Z reads naturally for names)
//   ves              → desc (biggest first)
//   totalTokens      → desc (biggest first — default while VES is hidden)
//   estimatedCostUsd → desc (biggest first — same mental model)
//   trendPct         → desc (steepest gainers first)
//
// Nullish handling: ves and trendPct can be absent (ves: browser/pre-v3 imports
// with no device-measured fixes, or zero-cost rows; trendPct: <2 weeks of
// history). They sort to the bottom regardless of direction so an empty row
// never displaces a data row when the user toggles.
//
// SECURITY: pure client state. No fetch, no storage. Re-renders on each
// rows-prop change because the parent owns the data source (SWR in Track B).
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type SortKey = "handle" | "ves" | "totalTokens" | "estimatedCostUsd" | "trendPct";
export type SortDir = "asc" | "desc";
export type AriaSort = "ascending" | "descending" | "none";

// The minimum shape a row must satisfy. ImportedEntry already conforms; this
// keeps the hook reusable for future tables without coupling to ImportedEntry.
export type Sortable = {
  handle: string;
  totalTokens: number;
  estimatedCostUsd: number;
  ves?: number | null;
  trendPct?: number | null;
};

export function useColumnSort<T extends Sortable>(
  rows: T[],
  defaultKey: SortKey = "totalTokens",
  defaultDir: SortDir = "desc",
) {
  const [sortKey, setSortKey] = useState<SortKey>(defaultKey);
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir);

  // The default key can change after mount (entries load → VES column reveals
  // → default flips tokens→ves). Re-apply it, but freeze once the user picks a
  // column so an async reveal never yanks the sort out from under them.
  const userTouchedRef = useRef(false);
  useEffect(() => {
    if (userTouchedRef.current) return;
    setSortKey(defaultKey);
    setSortDir(defaultDir);
  }, [defaultKey, defaultDir]);

  const sorted = useMemo(() => {
    const factor = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (sortKey === "handle") {
        return a.handle.localeCompare(b.handle) * factor;
      }
      const av = a[sortKey] as number | null | undefined;
      const bv = b[sortKey] as number | null | undefined;
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return (av - bv) * factor;
    });
  }, [rows, sortKey, sortDir]);

  const toggle = useCallback(
    (key: SortKey) => {
      userTouchedRef.current = true;
      if (sortKey === key) {
        setSortDir(sortDir === "asc" ? "desc" : "asc");
        return;
      }
      setSortKey(key);
      setSortDir(key === "handle" ? "asc" : "desc");
    },
    [sortKey, sortDir],
  );

  const ariaSort = useCallback(
    (key: SortKey): AriaSort => {
      if (key !== sortKey) return "none";
      return sortDir === "asc" ? "ascending" : "descending";
    },
    [sortKey, sortDir],
  );

  return { sorted, sortKey, sortDir, toggle, ariaSort };
}
