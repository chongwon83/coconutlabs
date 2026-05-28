// app/api/burnindex/route.ts — the Burn Index leaderboard API.
//
// GET  → the full leaderboard list.
// POST → a raw Burn Summary envelope is validated and stored.
//
// SECURITY: POST requires a valid collector token (Authorization: Bearer <token>)
// issued by /api/internal/issue-collector-token. This prevents external actors
// from forging Axis 1 project_hash counts without going through the browser flow.
//
// Schema validation also re-runs validateSummary server-side. Client validation
// is a UX nicety; the trust boundary is HERE.

import type { NextRequest } from "next/server";
import { validateSummary } from "@/lib/validateSummary";
import { buildImportedEntry, computeVes } from "@/lib/data";
import { readEntries, upsertEntry } from "@/lib/server/store";
import { trendByHandle } from "@/lib/server/trend";
import { recordSubmission } from "@/lib/server/burn/metrics";
import { verifyAndConsumeToken } from "@/lib/server/burn/token";

// The store must reflect every prior import; never prerender GET.
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const entries = await readEntries();
  const trends = await trendByHandle();
  // Derive ves at read time from the device-measured commit count persisted on
  // the entry (`fixes`) and the current cost. `fixes` is the single source of
  // truth: an entry without it (browser uploads, pre-v3 rows) keeps ves absent,
  // so the UI renders "—" rather than a fabricated value. Then join the 7d trend.
  const joined = entries.map((entry) => {
    const card = { ...entry };
    if (card.fixes != null) {
      const ves = computeVes(card.fixes, entry.estimatedCostUsd);
      if (ves != null) card.ves = ves;
    }
    const trend = trends.get(entry.handle);
    if (trend != null) {
      card.trendDir = trend.dir;
      card.trendPct = trend.pct;
      card.trendSeries = trend.series;
    }
    return card;
  });
  return Response.json({ entries: joined });
}

export async function POST(request: NextRequest): Promise<Response> {
  // Verify collector token before any payload processing.
  const authHeader = request.headers.get("authorization");
  const rawToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!rawToken) {
    return Response.json({ error: "Missing Authorization header." }, { status: 401 });
  }
  try {
    const tokenResult = await verifyAndConsumeToken(rawToken, "burnindex");
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

  const { handle, raw } = body as Record<string, unknown>;
  if (typeof handle !== "string" || !handle.trim()) {
    return Response.json({ error: "A handle is required to join the Burn Index." }, { status: 400 });
  }
  if (typeof raw !== "string") {
    return Response.json({ error: "Missing Burn Summary JSON." }, { status: 400 });
  }

  const result = validateSummary(raw);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  // Only week-period envelopes belong on the leaderboard. Other periods are
  // valid for local audit but must never mix into the shared store.
  if (result.envelope.periodWindow.period !== "week") {
    return Response.json(
      { error: "Only 'week' period envelopes can be submitted to the leaderboard." },
      { status: 400 },
    );
  }

  const entry = buildImportedEntry(result.envelope, handle.trim());
  try {
    const entries = await upsertEntry(entry);
    // Record distinct project_hash values for Axis 1 gate measurement.
    // Fire-and-forget: a metrics failure must never break the leaderboard POST.
    const projectHashes = result.envelope.rows.map((r) => r.projectHash);
    recordSubmission(projectHashes).catch(() => {});
    return Response.json({ entry, entries }, { status: 201 });
  } catch {
    return Response.json({ error: "Could not save to the leaderboard. Try again." }, { status: 500 });
  }
}
