// lib/email.ts — email-format validation shared by the client opt-in UI and the
// server endpoint. Framework-free (no React, no node, no NEXT_PUBLIC) so both
// `components/forms/PostUploadSurvey.tsx` (client) and `app/api/emails/route.ts`
// (server) import the SAME check — the server is authoritative, the client
// mirrors it for UX.
//
// Pragmatic RFC-lite: one `@`, a non-empty local part, a domain with a dot and a
// 2+ char TLD, no whitespace, capped at the RFC 5321 max of 254 chars. We do NOT
// attempt full RFC 5322 — that regex is famously unmaintainable and would reject
// nothing a real signup flow needs to accept.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const MAX_EMAIL_LENGTH = 254;

export function isValidEmail(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_EMAIL_LENGTH) return false;
  return EMAIL_RE.test(trimmed);
}

// Canonical form for de-duplication: trimmed + lowercased. Used by every
// EmailStore implementation so the same address never lands twice under
// different casing/whitespace.
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}
