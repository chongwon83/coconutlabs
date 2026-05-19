// trend.ts — derives the 7-day trend from daily leaderboard snapshots.
//
// scripts/snapshot.mjs appends one dated snapshot of per-handle totalTokens
// per run. This module reads them and computes, per handle, the % change over
// the last 7 snapshots plus the series for the sparkline.
//
// Until 7 snapshots exist no handle has a trend — trendByHandle returns an
// empty map and the UI renders "—". That is an honest limit of a store that
// has not been running long enough, not a bug.

import { promises as fs } from "node:fs";
import path from "node:path";
import type { TrendDir } from "@/lib/data";

interface Snapshot {
  date: string;
  totals: Record<string, number>;
}

export interface HandleTrend {
  dir: TrendDir;
  pct: number; // signed % change across the window, 1-decimal
  series: number[]; // per-snapshot totalTokens, oldest → newest
}

const SNAP_PATH = path.join(process.cwd(), ".data", "snapshots.json");
const WINDOW = 7;

async function readSnapshots(): Promise<Snapshot[]> {
  try {
    const raw = await fs.readFile(SNAP_PATH, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Snapshot[]) : [];
  } catch {
    return [];
  }
}

// Per-handle trend over the last WINDOW snapshots. With fewer than WINDOW
// snapshots the map is empty; a handle whose oldest value is 0 is skipped
// (no baseline to divide by — better "—" than a fake %).
export async function trendByHandle(): Promise<Map<string, HandleTrend>> {
  const recent = (await readSnapshots()).slice(-WINDOW);
  const result = new Map<string, HandleTrend>();
  if (recent.length < WINDOW) return result;

  const handles = new Set<string>();
  for (const s of recent) for (const h of Object.keys(s.totals)) handles.add(h);

  for (const handle of handles) {
    const series = recent.map((s) => s.totals[handle] ?? 0);
    const first = series[0];
    if (first <= 0) continue;
    const last = series[series.length - 1];
    const pct = ((last - first) / first) * 100;
    const dir: TrendDir = pct > 0.5 ? "up" : pct < -0.5 ? "down" : "flat";
    result.set(handle, { dir, pct: Math.round(pct * 10) / 10, series });
  }
  return result;
}
