// handle.ts — the SINGLE source of truth for the leaderboard / history / claim key.
//
// Every handle that enters a write path (route POST, migration, admin scripts)
// MUST pass through canonicalHandle so @-prefix and casing variants collapse to
// ONE key. Storing the raw handle (the pre-PR2 behaviour) splits trends and lets
// "@Foo" / "foo" claim each other's rows. See spec §2.6.
//
// canonical = stored in ImportedEntry.handle / ImportHistoryPoint.handle (the
// existing dedupe/history/trend key). display = case-preserving form for render
// only; never a key.

// GitHub-ish, length-bounded: first char alnum, then up to 38 of [a-z0-9-].
// Max length 39 (1 + 38). No leading hyphen, no underscore/dot/space.
const CANONICAL_HANDLE_RE = /^[a-z0-9](?:[a-z0-9-]{0,38})$/;

/**
 * Canonical key for a handle, or null when malformed (caller maps null → 400).
 * Strips leading @(s), trims, lowercases, then validates the charset/length.
 */
export function canonicalHandle(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const stripped = raw.trim().replace(/^@+/, "").toLowerCase();
  return CANONICAL_HANDLE_RE.test(stripped) ? stripped : null;
}

/**
 * Case-preserving display form (strip leading @, trim). Render-only — NEVER use
 * as a store key. May be non-canonical (e.g. "Foo"); persist only when it differs
 * from the canonical key.
 */
export function displayFormFor(raw: string): string {
  return raw.trim().replace(/^@+/, "");
}

/**
 * Combined parse: returns the canonical key + case-preserving display form, or
 * null if the handle is malformed. No display value leaks for an invalid handle.
 */
export function parseHandle(
  raw: unknown,
): { handle: string; display: string } | null {
  const handle = canonicalHandle(raw);
  if (handle === null) return null;
  return { handle, display: displayFormFor(raw as string) };
}
