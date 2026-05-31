// claimLog.ts — structured claim-event logging for the POST claim gate (§3.5 P2).
//
// SECURITY: a claim event records ONLY the canonical handleKey and the outcome.
// The presented token, its sha256 hash, the stored hash, and the case-preserving
// display form are NEVER logged — the token is a bearer secret and its hash is a
// recovery oracle. The signature is built so a token CANNOT reach it: it takes a
// handleKey (the already-public leaderboard key, no PII beyond what the board
// shows) plus a closed enum of outcomes. Logs land in the server runtime only;
// keep them out of client telemetry/analytics/error-capture (PR2 step 12 bans
// the claim token from those paths entirely).

export type ClaimEvent =
  | "mint" //         unclaimed handle + valid token → first claim minted (201)
  | "mismatch" //     wrong/absent token on a claimed handle → 409
  | "legacyLocked" // migration-locked handle → 409 (manual recovery in v1)
  | "invalid" //      malformed/absent token on an unclaimed handle → 400
  | "readonlyReject"; // CLAIM_MODE readonly window → 503 (no write attempted)

export function logClaimEvent(event: ClaimEvent, handleKey: string): void {
  // handleKey is canonical + already public; no token/hash ever passes here.
  console.info(`[claim] event=${event} handle=${handleKey}`);
}
