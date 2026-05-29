// lib/client/burn/subscribeEmail.ts — opt-in email submission (fire-and-forget).
//
// Mirrors sendTelemetryEvent's token-fetch → POST flow, but for the email
// opt-in channel. Called from the post-upload consent UI (PostUploadSurvey).
//
// PRIVACY: only ever called after the user typed an email AND checked an
// explicit consent box. consent:true is sent so the server can enforce the
// opt-in (the server rejects consent !== true). The email is the lone piece of
// individuated PII the product collects — see app/api/emails/route.ts.
//
// Fire-and-forget: any failure (token issuance, network, server) is swallowed
// so a hiccup never disrupts the already-successful upload flow.

import { isValidEmail } from "@/lib/email";

export function subscribeEmail(email: string, handle?: string | null): void {
  // Validate locally before sending (defence in depth; the UI also gates submit).
  if (!isValidEmail(email)) return; // drop silently

  void (async () => {
    try {
      // Fetch a single-use token bound to this email POST.
      const tokenRes = await fetch("/api/internal/issue-collector-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "emails" }),
      });
      if (!tokenRes.ok) return; // drop silently if token issuance fails
      const tokenData = (await tokenRes.json()) as { token?: string };
      if (!tokenData.token) return;

      fetch("/api/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${tokenData.token}`,
        },
        body: JSON.stringify({
          email: email.trim(),
          handle: handle ?? null,
          consent: true,
        }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      // Never throw from an opt-in submission
    }
  })();
}
