// challenge.ts — server-side JSON file store for challenge submissions.
//
// A challenge submission is a builder's CLAIM that they shipped N fixes for a
// challenge. It is ALWAYS stored unverified — automated "did the fix actually
// work" verification needs the submitter's repo + CI, which we don't have. The
// owner confirms manually via scripts/verify-challenge.mjs, which flips a
// record to verified and sets verifiedFixes. Only verified submissions feed
// the leaderboard's fixes/VES columns.
//
// SECURITY: this file holds only the claim — handle, challenge id, integer fix
// counts, status, timestamps. No raw content, paths, or secrets.

import { promises as fs } from "node:fs";
import path from "node:path";

export type ChallengeStatus = "unverified" | "verified" | "rejected";

export interface ChallengeRecord {
  handle: string;
  challenge: string;
  claimedFixes: number;
  status: ChallengeStatus;
  verifiedFixes: number | null;
  submittedAt: string;
  verifiedAt: string | null;
}

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_PATH = path.join(DATA_DIR, "challenges.json");

// Read all submissions. A missing or corrupt file yields [] — the store must
// not 500 on first boot or a hand-deleted .data/.
export async function readChallenges(): Promise<ChallengeRecord[]> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ChallengeRecord[]) : [];
  } catch {
    return [];
  }
}

// Atomic write: serialize to a sibling .tmp, then rename over the target so a
// crash mid-write leaves the previous good file intact.
async function writeChallenges(records: ChallengeRecord[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${STORE_PATH}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(records, null, 2), "utf-8");
  await fs.rename(tmp, STORE_PATH);
}

// Append a new submission (newest first). Submissions are never deduped — a
// builder may submit to multiple challenges, and each claim is verified on its
// own.
export async function addChallenge(record: ChallengeRecord): Promise<void> {
  const prev = await readChallenges();
  await writeChallenges([record, ...prev]);
}

// Total verified fixes per handle — the leaderboard join key. Unverified and
// rejected submissions contribute nothing, so a card stays at "—" until the
// owner confirms a claim.
export async function verifiedFixesByHandle(): Promise<Map<string, number>> {
  const records = await readChallenges();
  const totals = new Map<string, number>();
  for (const r of records) {
    if (r.status === "verified" && r.verifiedFixes != null) {
      totals.set(r.handle, (totals.get(r.handle) ?? 0) + r.verifiedFixes);
    }
  }
  return totals;
}
