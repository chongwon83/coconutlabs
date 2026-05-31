// burnStore/fileStore.ts — BurnStore backed by JSON files under .data/.
//
// This is the local-dev implementation: no account, no network, no deps. It
// is the original store.ts / importHistory.ts logic gathered behind the
// BurnStore interface, unchanged in behavior.
//
// Vercel's filesystem is ephemeral and per-instance, so this implementation is
// NOT used in production — getStore() picks redisStore when Upstash env vars
// are present. fileStore stays the honest local default.
//
// SECURITY: persists ONLY the derived ImportedEntry / ImportHistoryPoint
// shapes. route.ts builds ImportedEntry via buildImportedEntry before calling
// upsertEntry — the raw envelope, content, paths, and secrets never reach this
// layer.

import { promises as fs } from "node:fs";
import path from "node:path";
import type { ImportedEntry } from "@/lib/data";
import { withLock, atomicWriteJson } from "@/lib/server/atomic";
import { mergeNumerator } from "@/lib/server/burnStore/mergeNumerator";
import { decideClaim } from "@/lib/server/claim";
import type { ClaimRecord } from "@/lib/server/claim";
import type {
  BurnStore,
  ClaimUpsertResult,
  ImportHistoryPoint,
} from "@/lib/server/burnStore/types";

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_PATH = path.join(DATA_DIR, "leaderboard.json");
const HIST_PATH = path.join(DATA_DIR, "import-history.json");
// Per-handle claim records, keyed by the CANONICAL handle. Holds the FULL
// ClaimRecord union (spec A2 — the file store keeps `createdAt`/`collision`,
// unlike Redis's metadata-thin string). A JSON object map (not an array) so a
// claim lookup is O(1) by handleKey and a re-claim can't duplicate a row.
const CLAIMS_PATH = path.join(DATA_DIR, "claims.json");

const KEEP_PER_HANDLE = 12; // > trend WINDOW(7), caps history file growth

// Read a JSON array file. A missing or corrupt file yields [] rather than
// throwing — the server's first boot, or a hand-deleted .data/, must not 500.
async function readArray<T>(filePath: string): Promise<T[]> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

// Read the claims map. A missing/corrupt/non-object file yields {} — never
// throws (same fail-safe-to-empty contract as readArray). An empty map means
// "nothing claimed yet", so every handle is mintable.
async function readClaims(): Promise<Record<string, ClaimRecord>> {
  try {
    const raw = await fs.readFile(CLAIMS_PATH, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    return parsed != null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, ClaimRecord>)
      : {};
  } catch {
    return {};
  }
}

// JSON blobs written before A.1 (toolsUsed), B (breakdown), or the VES
// provenance field (fixesSource) will deserialize missing those fields. Coerce
// toolsUsed/breakdown to `[]`, and backfill fixesSource="cli" when a numerator
// is present without a source — legacy rows carried a CLI count before the
// field existed, so the precedence merge must rank them as CLI (see
// mergeNumerator). Keep this backfill in lockstep across all three stores.
function hydrateEntry(e: ImportedEntry): ImportedEntry {
  const needsArrays = !Array.isArray(e.toolsUsed) || !Array.isArray(e.breakdown);
  const needsSource = e.fixes != null && e.fixesSource == null;
  if (!needsArrays && !needsSource) return e;
  return {
    ...e,
    toolsUsed: Array.isArray(e.toolsUsed) ? e.toolsUsed : [],
    breakdown: Array.isArray(e.breakdown) ? e.breakdown : [],
    ...(needsSource ? { fixesSource: "cli" as const } : {}),
  };
}

export class FileBurnStore implements BurnStore {
  async readEntries(): Promise<ImportedEntry[]> {
    const rows = await readArray<ImportedEntry>(STORE_PATH);
    return rows.map(hydrateEntry);
  }

  async readHistory(): Promise<ImportHistoryPoint[]> {
    return readArray<ImportHistoryPoint>(HIST_PATH);
  }

  // Upsert by handle (a re-import replaces the older card), newest first, and
  // record the weekly history point — both under one withLock so two
  // concurrent imports cannot read stale state and lose a write.
  //
  // The two files are not transactionally atomic: if the history write throws,
  // the leaderboard write below is skipped and both stay unwritten; if history
  // succeeds but the leaderboard write fails, history holds a point the
  // leaderboard lacks. That window is rare and self-heals — the next re-import
  // of the same (handle, week) overwrites the history point and re-runs this
  // upsert (both idempotent by handle).
  async upsertEntry(entry: ImportedEntry): Promise<ImportedEntry[]> {
    return withLock(STORE_PATH, () => this.#upsertLocked(entry));
  }

  // Claim-gated upsert (spec §2.3). Runs the claim decision AND the card write
  // under ONE withLock(STORE_PATH) so a concurrent upsert/claim can't interleave
  // (claims.json is only written from here, so the leaderboard lock guards it
  // too). On a rejected claim (mismatch/legacyLocked/invalid) NOTHING is written
  // — no card, no claim — so an impostor leaves no trace. On a mint the claim is
  // persisted BEFORE the card: a crash with claim-but-no-card self-heals, since a
  // re-upload with the same token then decides "ok" and writes the missing card.
  async claimAndUpsert(
    entry: ImportedEntry,
    presentedToken: string | undefined,
  ): Promise<ClaimUpsertResult> {
    return withLock(STORE_PATH, async () => {
      const handleKey = entry.handle; // already canonical (interface contract)
      const claims = await readClaims();
      const existing = claims[handleKey] ?? null;
      const now = new Date().toISOString();
      const decision = decideClaim(existing, presentedToken, { handleKey, now });

      if (
        decision.status === "mismatch" ||
        decision.status === "legacyLocked" ||
        decision.status === "invalid"
      ) {
        return { status: decision.status };
      }

      if (decision.status === "claimed") {
        claims[handleKey] = decision.record; // mint BEFORE the card write
        await atomicWriteJson(CLAIMS_PATH, claims);
      }
      const entries = await this.#upsertLocked(entry);
      return { status: decision.status, entries };
    });
  }

  // The leaderboard + history read-modify-write, WITHOUT the lock. Callers
  // (upsertEntry, claimAndUpsert) MUST already hold withLock(STORE_PATH) — never
  // call withLock in here or it deadlocks against the holder (atomic.ts chains
  // per key, so a nested same-key lock waits on its own outer promise forever).
  //
  // The two files are not transactionally atomic: if the history write throws,
  // the leaderboard write below is skipped and both stay unwritten; if history
  // succeeds but the leaderboard write fails, history holds a point the
  // leaderboard lacks. That window is rare and self-heals — the next re-import
  // of the same (handle, week) overwrites the history point and re-runs this
  // upsert (both idempotent by handle).
  async #upsertLocked(entry: ImportedEntry): Promise<ImportedEntry[]> {
    const prev = (await readArray<ImportedEntry>(STORE_PATH)).map(hydrateEntry);
    // Card/denominator fields take the incoming import; only the VES numerator
    // is precedence-merged so a later browser-fsa or numerator-absent upload
    // cannot clobber/lower a CLI count (see mergeNumerator).
    const existing = prev.find((e) => e.handle === entry.handle);
    const merged = { ...entry, ...mergeNumerator(existing, entry) };
    const next = [merged, ...prev.filter((e) => e.handle !== entry.handle)];
    next.sort((a, b) => b.importedAt.localeCompare(a.importedAt));
    await this.#recordHistory(merged);
    await atomicWriteJson(STORE_PATH, next);
    return next;
  }

  // Record one weekly import. NO own lock — upsertEntry already holds
  // withLock(STORE_PATH) and is the sole writer. Non-week imports are skipped.
  // Re-importing the same (handle, weekKey) replaces that week's point.
  async #recordHistory(entry: ImportedEntry): Promise<void> {
    if (entry.period !== "week" || entry.since == null) return;
    const weekKey = entry.since;
    const point: ImportHistoryPoint = {
      handle: entry.handle,
      weekKey,
      totalTokens: entry.totalTokens,
      importedAt: entry.importedAt,
      // Carry display casing onto the trend point only when it differs from the
      // canonical key — render parity without bloating canonical rows.
      ...(entry.displayHandle != null
        ? { displayHandle: entry.displayHandle }
        : {}),
    };
    const prev = await readArray<ImportHistoryPoint>(HIST_PATH);
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
}
