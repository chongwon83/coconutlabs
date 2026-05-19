// challenge.ts — the challenge-submission read/write surface.
//
// A challenge submission is a builder's CLAIM that they shipped N fixes for a
// challenge. Small claims (claimedFixes <= TRIAGE_THRESHOLD) are auto-verified
// at submission time by triageChallenge; larger claims stay unverified for the
// owner to confirm manually via scripts/verify-challenge.mjs. Only verified
// submissions feed the leaderboard's fixes/VES columns.
//
// Submissions are also rate-limited per handle (isRateLimited) to keep one
// builder from flooding the auto-verify path.
//
// Persistence lives behind a BurnStore (see getStore()). verifiedFixesByHandle
// is a pure derivation on top of readChallenges — shared by every BurnStore.
// triage and rate-limit add NO store method: triage is a pure function and
// rate-limit is a scan over readChallenges, so file and redis behave alike.
//
// SECURITY: a BurnStore holds only the claim — handle, challenge id, integer
// fix counts, status, timestamps. No raw content, paths, or secrets.

import { getStore } from "@/lib/server/burnStore";
import type {
  ChallengeRecord,
  ChallengeStatus,
} from "@/lib/server/burnStore/types";

export type { ChallengeRecord, ChallengeStatus };

// Every submission, newest first. Empty store → [].
export async function readChallenges(): Promise<ChallengeRecord[]> {
  return getStore().readChallenges();
}

// Append a new submission (newest first). Submissions are never deduped — a
// builder may submit to multiple challenges, and each claim is verified on its
// own.
export async function addChallenge(record: ChallengeRecord): Promise<void> {
  return getStore().addChallenge(record);
}

// Total verified fixes per handle — the leaderboard join key. Unverified and
// rejected submissions contribute nothing, so a card stays at "—" until the
// owner confirms a claim.
//
// A handle may re-submit the SAME challenge (a later run shipped more fixes),
// and the owner may verify more than one of those. Counting every verified
// record would double-count one challenge. So we keep only the LATEST verified
// record per (handle, challenge) — keyed by verifiedAt — then sum those across
// the handle's distinct challenges.
export async function verifiedFixesByHandle(): Promise<Map<string, number>> {
  const records = await readChallenges();

  // (handle challenge) -> latest verified record
  const latest = new Map<string, ChallengeRecord>();
  for (const r of records) {
    if (r.status !== "verified" || r.verifiedFixes == null) continue;
    const key = `${r.handle} ${r.challenge}`;
    const cur = latest.get(key);
    if (cur == null || (r.verifiedAt ?? "") > (cur.verifiedAt ?? "")) {
      latest.set(key, r);
    }
  }

  const totals = new Map<string, number>();
  for (const r of latest.values()) {
    totals.set(r.handle, (totals.get(r.handle) ?? 0) + (r.verifiedFixes ?? 0));
  }
  return totals;
}

// --- triage + rate-limit ----------------------------------------------------

// Claims of this many fixes or fewer are auto-verified at submission time;
// anything larger is too big to trust without owner review and stays
// unverified for scripts/verify-challenge.mjs.
export const TRIAGE_THRESHOLD = 5;

// A handle may submit at most RATE_LIMIT_MAX challenges within any rolling
// RATE_LIMIT_WINDOW_MS — the (window, count) pair below is one hour / five.
export const RATE_LIMIT_WINDOW_MS = 3_600_000;
export const RATE_LIMIT_MAX = 5;

export interface TriageOutcome {
  status: ChallengeStatus;
  verifiedFixes: number | null;
  verifiedAt: string | null;
}

// Decide a submission's status the moment it arrives. A small claim
// (1..=TRIAGE_THRESHOLD — claimedFixes is already an integer >= 1 when this is
// called) is auto-verified with verifiedFixes set to the claim and verifiedAt
// set to now; a larger claim stays unverified for manual owner review. Pure:
// no I/O, no clock read — `now` is passed in so the route stamps one consistent
// timestamp across the record.
export function triageChallenge(
  claimedFixes: number,
  now: string,
): TriageOutcome {
  if (claimedFixes <= TRIAGE_THRESHOLD) {
    return { status: "verified", verifiedFixes: claimedFixes, verifiedAt: now };
  }
  return { status: "unverified", verifiedFixes: null, verifiedAt: null };
}

// True when `handle` has already submitted RATE_LIMIT_MAX or more challenges
// within the RATE_LIMIT_WINDOW_MS ending at `now`. Backend-agnostic: it scans
// readChallenges() (which both stores back identically) rather than a Redis
// TTL key, so the same POST is accepted or rejected the same way under file
// and redis. A future submittedAt (server clock skew) still counts toward the
// limit — fail-closed, so skew can never let a handle bypass the cap. This is
// a check-then-append soft guard: two POSTs racing the same scan can both pass,
// so it bounds flooding rather than enforcing an exact hard cap.
export async function isRateLimited(
  handle: string,
  now: string,
): Promise<boolean> {
  const records = await readChallenges();
  const windowStart = Date.parse(now) - RATE_LIMIT_WINDOW_MS;

  let count = 0;
  for (const r of records) {
    if (r.handle !== handle) continue;
    const t = Date.parse(r.submittedAt);
    if (Number.isNaN(t)) continue;
    if (t >= windowStart) count += 1;
    if (count >= RATE_LIMIT_MAX) return true;
  }
  return false;
}
