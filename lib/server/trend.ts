// trend.ts — derives the trend from each handle's weekly import history.
//
// Each weekly import contributes one point (see lib/server/importHistory.ts).
// This module reads a handle's successive weekly imports and computes the %
// change over the last WINDOW imports plus the series for the sparkline. No
// daily cron — the trend's natural unit is the user's own weekly imports.
//
// A handle with fewer than MIN_POINTS imports has no trend — trendByHandle
// omits it and the UI renders "—". That is an honest limit of a handle that
// has not imported enough weeks yet, not a bug. Note: the last WINDOW imports
// are not necessarily WINDOW *consecutive* weeks — a known PoC limitation.
//
// The trend is keyed by handle, not by the card's period. Only `week` imports
// are recorded (see recordImportHistory), so a handle whose latest card is a
// month/year import still shows its last known *weekly* trend — by design,
// since the trend's unit is always the week. The GET joins it by handle.

import type { TrendDir } from "@/lib/data";
import { historyByHandle } from "@/lib/server/importHistory";

export interface HandleTrend {
  dir: TrendDir;
  pct: number; // signed % change across the window, 1-decimal
  series: number[]; // per-import totalTokens, oldest → newest
}

const WINDOW = 7; // max points (weeks) in the sparkline
const MIN_POINTS = 2; // need ≥2 imports to compute any delta

// Per-handle trend over the last WINDOW weekly imports. A handle with fewer
// than MIN_POINTS imports is omitted; a handle whose oldest value is 0 is
// skipped (no baseline to divide by — better "—" than a fake %).
export async function trendByHandle(): Promise<Map<string, HandleTrend>> {
  const byHandle = await historyByHandle();
  const result = new Map<string, HandleTrend>();
  for (const [handle, points] of byHandle) {
    const recent = points.slice(-WINDOW);
    if (recent.length < MIN_POINTS) continue;
    const series = recent.map((p) => p.totalTokens);
    const first = series[0];
    if (first <= 0) continue;
    const last = series[series.length - 1];
    const pct = ((last - first) / first) * 100;
    const dir: TrendDir = pct > 0.5 ? "up" : pct < -0.5 ? "down" : "flat";
    result.set(handle, { dir, pct: Math.round(pct * 10) / 10, series });
  }
  return result;
}
