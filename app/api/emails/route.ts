// app/api/emails/route.ts — stores an OPT-IN contact email left after a scan.
//
// This is the outbound-comms channel: a user who finished a scan may optionally
// leave an email to be notified about rank changes / product news. It is the
// lone piece of individuated PII the product collects, and only ever with the
// user's explicit consent.
//
// SECURITY / PRIVACY:
// - Requires a valid collector token (Authorization: Bearer <token>) of kind
//   "emails", issued by /api/internal/issue-collector-token. Same single-use
//   nonce + rate-limit protection as the burnindex/telemetry endpoints.
// - Consent is enforced SERVER-SIDE: consent !== true → 400. The UI checkbox is
//   a convenience, not the gate.
// - Email is validated server-side (isValidEmail) before any write.
// - The store write is fire-and-forget: a storage hiccup must never 500 the
//   request (the upload that preceded this already succeeded; this is additive).
// - The email is persisted in a SEPARATE store (emailStore, key burn:emails:v1),
//   never mixed into the pseudonymous leaderboard — the technical half of the
//   privacy carve-out.

import type { NextRequest } from "next/server";
import { isValidEmail } from "@/lib/email";
import { getEmailStore } from "@/lib/server/emailStore";
import { verifyAndConsumeToken } from "@/lib/server/burn/token";

export const dynamic = "force-dynamic";

const MAX_HANDLE_LENGTH = 64;

export async function POST(request: NextRequest): Promise<Response> {
  // Verify collector token before any payload processing.
  const authHeader = request.headers.get("authorization");
  const rawToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!rawToken) {
    return Response.json({ error: "Missing Authorization header." }, { status: 401 });
  }
  try {
    const tokenResult = await verifyAndConsumeToken(rawToken, "emails");
    if (!tokenResult.ok) {
      return Response.json({ error: "Invalid or expired token." }, { status: tokenResult.status });
    }
  } catch {
    // Redis unavailable — fail closed
    return Response.json({ error: "Token verification temporarily unavailable." }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return Response.json({ error: "Request body must be a JSON object." }, { status: 400 });
  }

  const { email, handle, consent } = body as Record<string, unknown>;

  // Explicit opt-in is mandatory — enforced here, not just in the UI.
  if (consent !== true) {
    return Response.json({ error: "Consent is required to subscribe." }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return Response.json({ error: "A valid email address is required." }, { status: 400 });
  }

  // Optional handle: accept a short string, otherwise null. Never trust length.
  const safeHandle =
    typeof handle === "string" && handle.trim().length > 0 && handle.length <= MAX_HANDLE_LENGTH
      ? handle.trim()
      : null;

  // Fire-and-forget: the opt-in is additive to an already-successful upload, so
  // a store failure must not surface as an error to the user.
  getEmailStore()
    .addEmail({
      email: email as string,
      handle: safeHandle,
      source: "post_upload",
      subscribedAt: new Date().toISOString(),
    })
    .catch(() => {});

  return Response.json({ ok: true }, { status: 200 });
}
