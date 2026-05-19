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

// The store must reflect every prior import; never prerender GET.
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const entries = await readEntries();
  const verifiedFixes = await verifiedFixesByHandle();
  // Join verified challenge submissions onto each card. A handle with no
  // verified fixes is returned untouched, so its fixes/VES render "—".
  const joined = entries.map((entry) => {
    const fixes = verifiedFixes.get(entry.handle);
    if (fixes == null) return entry;
    const ves = computeVes(fixes, entry.estimatedCostUsd);
    return ves == null ? { ...entry, fixes } : { ...entry, fixes, ves };
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
    return Response.json({ entry, entries }, { status: 201 });
  } catch {
    return Response.json({ error: "Could not save to the leaderboard. Try again." }, { status: 500 });
  }
}
