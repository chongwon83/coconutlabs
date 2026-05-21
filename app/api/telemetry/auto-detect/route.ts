// app/api/telemetry/auto-detect/route.ts — receives and stores telemetry events.
//
// SECURITY: requires a valid collector token (Authorization: Bearer <token>)
// issued by /api/internal/issue-collector-token. This prevents external actors
// from inflating Axis 2/3 counters without going through the browser flow.
//
// Schema is also strictly validated server-side: any payload carrying a
// forbidden field (path, stack, prompt, etc.) is rejected with 400.

import type { NextRequest } from "next/server";
import { validateTelemetryEvent } from "@/lib/client/burn/telemetry";
import {
  recordAutoDetectStarted,
  recordAutoDetectCompleted,
  recordAutoDetectFailed,
  recordSurveyResponse,
} from "@/lib/server/burn/metrics";
import { verifyAndConsumeToken } from "@/lib/server/burn/token";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<Response> {
  // Verify collector token before any payload processing.
  const authHeader = request.headers.get("authorization");
  const rawToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!rawToken) {
    return Response.json({ error: "Missing Authorization header." }, { status: 401 });
  }
  try {
    const tokenResult = await verifyAndConsumeToken(rawToken, "telemetry");
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

  const result = validateTelemetryEvent(body);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  const event = result.event;

  // Record to metrics store. Fire-and-forget errors here — a metrics failure
  // must not return 500 (client retries would multiply noise).
  try {
    switch (event.event) {
      case "auto_detect_started":
        await recordAutoDetectStarted();
        break;
      case "auto_detect_completed":
        await recordAutoDetectCompleted(event.durationBucket);
        break;
      case "auto_detect_failed":
        await recordAutoDetectFailed(event.durationBucket);
        break;
      case "survey_responded":
        await recordSurveyResponse(event.hardestStep);
        break;
    }
  } catch {
    // Swallow metrics write errors — telemetry must be non-blocking.
  }

  return Response.json({ ok: true }, { status: 200 });
}
