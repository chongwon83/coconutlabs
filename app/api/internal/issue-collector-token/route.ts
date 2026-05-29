// app/api/internal/issue-collector-token/route.ts — short-lived HMAC token issuance.
//
// Issues a single-use collector token bound to a specific kind (burnindex,
// telemetry, or emails). Valid for COLLECTOR_TOKEN_TTL_SECONDS (default 300s).
//
// Rate-limited per IP: COLLECTOR_TOKEN_ISSUE_RATE_PER_MIN (default 5/min).
// Fail-closed: Redis unavailability returns 503 rather than issuing tokens freely.
//
// SECURITY: COLLECTOR_HMAC_SECRET must be a server-only env var — never NEXT_PUBLIC_.

import type { NextRequest } from "next/server";
import { issueToken, type TokenKind } from "@/lib/server/burn/token";
import { checkRateLimit } from "@/lib/server/burn/rateLimiter";

export const dynamic = "force-dynamic";

const VALID_KINDS: ReadonlySet<string> = new Set(["burnindex", "telemetry", "emails"]);

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown"
  );
}

export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return Response.json({ error: "Request body must be a JSON object." }, { status: 400 });
  }

  const { kind } = body as Record<string, unknown>;
  if (typeof kind !== "string" || !VALID_KINDS.has(kind)) {
    return Response.json({ error: "Invalid kind. Must be 'burnindex', 'telemetry', or 'emails'." }, { status: 400 });
  }

  const ip = getClientIp(request);

  try {
    const limit = await checkRateLimit(ip);
    if (!limit.allowed) {
      return Response.json(
        { error: "Too many token requests. Try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((limit.resetAtMs - Date.now()) / 1000)),
          },
        },
      );
    }
  } catch {
    // Redis unavailable — fail closed
    return Response.json({ error: "Token service temporarily unavailable." }, { status: 503 });
  }

  try {
    const token = await issueToken(kind as TokenKind);
    return Response.json({ token }, { status: 200 });
  } catch {
    return Response.json({ error: "Token service temporarily unavailable." }, { status: 503 });
  }
}
