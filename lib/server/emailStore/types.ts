// emailStore/types.ts — the EmailStore contract + the one shape it persists.
//
// An EmailStore is the hosted home for OPT-IN contact emails left after a scan
// (the outbound-comms channel). It is deliberately SEPARATE from the BurnStore
// (the leaderboard): the leaderboard is pseudonymous aggregate data, while an
// email is the one piece of individuated PII a user can choose to share. Keeping
// them in different stores is the technical half of the privacy carve-out — the
// "we never store your code/prompts/paths" promise is about the SCAN payload and
// stays literally true; the email is the lone, optional, consented exception.
//
// SECURITY: an EmailStore persists ONLY the EmailSubscription shape below —
// never a raw request body, never a spread of unknown data. Consent is enforced
// at the route layer (app/api/emails/route.ts), not stored here, so this layer
// only ever sees rows the user explicitly opted into.

export interface EmailSubscription {
  email: string; // normalized (trim + lowercase) — also the dedupe key
  handle: string | null; // the leaderboard handle this email belongs to, if known
  source: string; // where the opt-in happened, e.g. "post_upload"
  subscribedAt: string; // ISO timestamp (audit only)
}

export interface EmailStore {
  // Idempotent by normalized email: a repeat opt-in (same address, any casing)
  // is a no-op rather than a duplicate row. The store normalizes internally, so
  // callers may pass the raw user input.
  addEmail(sub: EmailSubscription): Promise<void>;

  // True if this (normalized) address has already opted in.
  hasEmail(email: string): Promise<boolean>;
}
