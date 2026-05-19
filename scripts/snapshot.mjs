#!/usr/bin/env node
// snapshot.mjs — append today's leaderboard token totals to the snapshot log.
//
// Run daily (cron/launchd or manually). Each run reads the current leaderboard
// store and appends one dated record of per-handle totalTokens to
// .data/snapshots.json. lib/server/trend.ts reads this log to compute the 7d
// trend — the sparkline stays flat until 7 snapshots accumulate (an honest
// limit, not a bug).
//
// Re-running on the same date overwrites that date's record (idempotent).
// Run from the web/ directory — the stores live under web/.data/.

import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), ".data");
const LEADERBOARD = path.join(DATA_DIR, "leaderboard.json");
const SNAPSHOTS = path.join(DATA_DIR, "snapshots.json");

async function readJson(file, fallback) {
  try {
    const parsed = JSON.parse(await readFile(file, "utf-8"));
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

async function main() {
  const entries = await readJson(LEADERBOARD, []);
  const totals = {};
  for (const e of entries) {
    if (e && typeof e.handle === "string") {
      totals[e.handle] = typeof e.totalTokens === "number" ? e.totalTokens : 0;
    }
  }

  const date = new Date().toISOString().slice(0, 10);
  const snapshots = await readJson(SNAPSHOTS, []);
  const next = snapshots.filter((s) => s && s.date !== date);
  next.push({ date, totals });
  next.sort((a, b) => a.date.localeCompare(b.date));

  await mkdir(DATA_DIR, { recursive: true });
  const tmp = `${SNAPSHOTS}.tmp`;
  await writeFile(tmp, JSON.stringify(next, null, 2), "utf-8");
  await rename(tmp, SNAPSHOTS);

  console.log(`snapshot ${date}: ${Object.keys(totals).length} handle(s)`);
}

main();
