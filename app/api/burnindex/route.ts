// app/api/burnindex/route.ts — the Burn Index leaderboard API.
//
// GET  → the full leaderboard list.
// POST → a raw Burn Summary envelope is validated and stored.
//
// SECURITY: POST re-runs validateSummary server-side. Client validation is a
// UX nicety (instant preview); the trust boundary is HERE. A request crafted
// to bypass the browser still has to pass the same 9-field whitelist +
// additionalProperties:false mirror, so a tampered file carrying raw content,
// paths, or secrets cannot smuggle data into the store.

import { validateSummary } from "@/lib/validateSummary";
import { buildImportedEntry, computeVes } from "@/lib/data";
import { readEntries, upsertEntry } from "@/lib/server/store";
import { verifiedFixesByHandle } from "@/lib/server/challenge";
import { trendByHandle } from "@/lib/server/trend";
import { recordSubmission } from "@/lib/server/burn/metrics";

// The store must reflect every prior import; never prerender GET.
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const entries = await readEntries();
  const verifiedFixes = await verifiedFixesByHandle();
  const trends = await trendByHandle();
  // Join verified challenge submissions and the 7d trend onto each card. A
  // handle missing either join keeps those fields absent, so the UI renders
  // "—" rather than a fabricated value.
  const joined = entries.map((entry) => {
    const card = { ...entry };
    const fixes = verifiedFixes.get(entry.handle);
    if (fixes != null) {
      card.fixes = fixes;
      const ves = computeVes(fixes, entry.estimatedCostUsd);
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

export async function POST(request: Request): Promise<Response> {
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
