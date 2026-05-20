// app/api/telemetry/auto-detect/route.ts — receives and stores telemetry events.
//
// SECURITY: the schema is strictly validated server-side using the same
// validateTelemetryEvent function the client uses. Any payload that carries a
// forbidden field (path, stack, prompt, etc.) is rejected with 400.
//
// This endpoint is NOT authenticated — it intentionally accepts events from
// anyone, but the schema validation ensures no raw data can be recorded.
// The event payload is validated before any write to the metrics store.

import { validateTelemetryEvent } from "@/lib/client/burn/telemetry";
import {
  recordAutoDetectStarted,
  recordAutoDetectCompleted,
  recordAutoDetectFailed,
  recordSurveyResponse,
} from "@/lib/server/burn/metrics";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
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
