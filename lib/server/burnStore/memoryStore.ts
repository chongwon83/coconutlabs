// burnStore/memoryStore.ts — BurnStore backed by an in-process Map.
//
// E2E-ONLY implementation. Selected by getStore() when BURN_STORE=memory.
// State is process-local and lost on shutdown, so two parallel test workers
// would see different leaderboards — Playwright config pins workers: 1.
//
// SECURITY: production must NEVER set BURN_STORE=memory. The factory in
// index.ts checks env-var explicitly, so the only way to land memory in prod
// would be to ship an env flag — Vercel dashboard audit is the gate.
//
// Behavior parity with FileBurnStore:
//   - upsertEntry: dedupe by handle, newest first, then record weekly history
//   - history KEEP_PER_HANDLE = 12 (matches fileStore)
//   - addChallenge: prepended (newest first), never deduped
// Concurrency: single Node process + single worker → no lock needed.

import type { ImportedEntry } from "@/lib/data";
import type {
  BurnStore,
  ChallengeRecord,
  ImportHistoryPoint,
} from "@/lib/server/burnStore/types";

const KEEP_PER_HANDLE = 12;

export class MemoryBurnStore implements BurnStore {
  #entries: ImportedEntry[] = [];
  #history: ImportHistoryPoint[] = [];
  #challenges: ChallengeRecord[] = [];

  async readEntries(): Promise<ImportedEntry[]> {
    return [...this.#entries];
  }

  async readHistory(): Promise<ImportHistoryPoint[]> {
    return [...this.#history];
  }

  async readChallenges(): Promise<ChallengeRecord[]> {
    return [...this.#challenges];
  }

  async upsertEntry(entry: ImportedEntry): Promise<ImportedEntry[]> {
    const next = [entry, ...this.#entries.filter((e) => e.handle !== entry.handle)];
    next.sort((a, b) => b.importedAt.localeCompare(a.importedAt));
    this.#recordHistory(entry);
    this.#entries = next;
    return [...next];
  }

  async addChallenge(record: ChallengeRecord): Promise<void> {
    this.#challenges = [record, ...this.#challenges];
  }

  // Mirrors FileBurnStore.#recordHistory — same dedupe + cap rules.
  #recordHistory(entry: ImportedEntry): void {
    if (entry.period !== "week" || entry.since == null) return;
    const weekKey = entry.since;
    const point: ImportHistoryPoint = {
      handle: entry.handle,
      weekKey,
      totalTokens: entry.totalTokens,
      importedAt: entry.importedAt,
    };
    const others = this.#history.filter(
      (p) => !(p.handle === entry.handle && p.weekKey === weekKey),
    );
    const mine = others.filter((p) => p.handle === entry.handle);
    const notMine = others.filter((p) => p.handle !== entry.handle);
    const myNext = [...mine, point]
      .sort((a, b) => a.weekKey.localeCompare(b.weekKey))
      .slice(-KEEP_PER_HANDLE);
    this.#history = [...notMine, ...myNext];
  }
}
