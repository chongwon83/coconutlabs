// importHistory.ts — per-handle weekly import history feeding the trend.
//
// Each weekly import contributes one point. trend.ts derives the sparkline
// and % change from a handle's successive weekly imports — no daily cron.
//
// Persistence lives behind a BurnStore (see getStore()). Recording a history
// point is NOT a separate call: upsertEntry absorbs it atomically so the
// leaderboard and history can never drift. This module exposes only the READ
// side — readHistory and the historyByHandle derivation.
//
// SECURITY: holds ONLY {handle, weekKey, totalTokens, importedAt}. No raw
// envelope, raw content, file paths, or secrets ever reach this layer.

import { getStore } from "@/lib/server/burnStore";
import type { ImportHistoryPoint } from "@/lib/server/burnStore/types";

export type { ImportHistoryPoint };

// Every weekly import history point across all handles. Empty store → [].
export async function readHistory(): Promise<ImportHistoryPoint[]> {
  return getStore().readHistory();
}

// Group history by handle, each list sorted oldest → newest by weekKey. A
// pure derivation shared verbatim regardless of which BurnStore backs it.
export async function historyByHandle(): Promise<
  Map<string, ImportHistoryPoint[]>
> {
  const all = await readHistory();
  const byHandle = new Map<string, ImportHistoryPoint[]>();
  for (const p of all) {
    const arr = byHandle.get(p.handle) ?? [];
    arr.push(p);
    byHandle.set(p.handle, arr);
  }
  for (const arr of byHandle.values()) {
    arr.sort((a, b) => a.weekKey.localeCompare(b.weekKey));
  }
  return byHandle;
}
