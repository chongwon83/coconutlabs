// lib/client/burn/token.ts — client-side collector token fetcher.
//
// Fetches a short-lived HMAC token from /api/internal/issue-collector-token
// and returns it as an Authorization header value.
//
// SECURITY: the HMAC secret never touches the client. This module only
// communicates with the server-side issuance endpoint.

export type TokenKind = "burnindex" | "telemetry";

export async function fetchCollectorToken(kind: TokenKind): Promise<string> {
  const res = await fetch("/api/internal/issue-collector-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind }),
  });

  if (!res.ok) {
    throw new Error(`Token issuance failed: ${res.status}`);
  }

  const data = (await res.json()) as { token?: string };
  if (!data.token || typeof data.token !== "string") {
    throw new Error("Invalid token response from server.");
  }

  return data.token;
}
