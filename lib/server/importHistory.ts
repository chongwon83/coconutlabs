// importHistory.ts — per-handle weekly import history feeding the trend.
//
// Each weekly import contributes one point. trend.ts derives the sparkline
// and % change from a handle's successive weekly imports — no daily cron.
//
// SECURITY: holds ONLY {handle, weekKey, totalTokens, importedAt}. No raw
// envelope, raw content, file paths, or secrets ever reach this layer.

import { promises as fs } from "node:fs";
import path from "node:path";
import { atomicWriteJson } from "@/lib/server/atomic";
import type { ImportedEntry } from "@/lib/data";

export interface ImportHistoryPoint {
  handle: string;
  weekKey: string; // periodWindow.since (ISO Monday) — the trend sort key
  totalTokens: number;
  importedAt: string; // audit only — NOT a sort key
}

const HIST_PATH = path.join(process.cwd(), ".data", "import-history.json");
const KEEP_PER_HANDLE = 12; // > trend WINDOW(7), caps file growth

// Read the full history. A missing or corrupt file yields [] rather than
// throwing — the server's first boot must not 500.
export async function readHistory(): Promise<ImportHistoryPoint[]> {
  try {
    const raw = await fs.readFile(HIST_PATH, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ImportHistoryPoint[]) : [];
  } catch {
    return [];
  }
}

// Record one weekly import. NO own lock — the caller (upsertEntry) already
// holds withLock(STORE_PATH) and is the sole writer. Non-week imports are
// skipped. Re-importing the same (handle, weekKey) replaces that week's point.
export async function recordImportHistory(entry: ImportedEntry): Promise<void> {
  if (entry.period !== "week" || entry.since == null) return;
  const weekKey = entry.since;
  const point: ImportHistoryPoint = {
    handle: entry.handle,
    weekKey,
    totalTokens: entry.totalTokens,
    importedAt: entry.importedAt,
  };
  const prev = await readHistory();
  const others = prev.filter(
    (p) => !(p.handle === entry.handle && p.weekKey === weekKey),
  );
  const mine = others.filter((p) => p.handle === entry.handle);
  const notMine = others.filter((p) => p.handle !== entry.handle);
  const myNext = [...mine, point]
    .sort((a, b) => a.weekKey.localeCompare(b.weekKey))
    .slice(-KEEP_PER_HANDLE);
  await atomicWriteJson(HIST_PATH, [...notMine, ...myNext]);
}

// Group history by handle, each list sorted oldest → newest by weekKey.
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
