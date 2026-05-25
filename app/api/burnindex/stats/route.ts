// app/api/burnindex/stats/route.ts — aggregate counters for the hero stat bar.
//
// Hero.tsx renders three numbers (builders / tokens / spend) that used to be
// hardcoded. SWR polls this endpoint every 30s so the bar reflects the actual
// store, not invented marketing copy. The full leaderboard payload from
// /api/burnindex includes the same data, but the hero only needs three sums —
// returning them separately keeps the client-side reducer tiny and lets the
// edge cache treat both endpoints independently.
//
// SECURITY: read-only. No auth, no body, no joins with verified-fixes/trend —
// stats are pure sums over public-leaderboard fields (totalTokens,
// estimatedCostUsd). An empty store returns {0,0,0} so the hero always renders.
//
// CACHE: Cache-Control public + s-maxage=30 matches the SWR refresh interval —
// the edge holds a snapshot for 30s, then up to 60s of stale-while-revalidate
// soaks any burst of concurrent polls before the next origin hit.

import { readEntries } from "@/lib/server/store";

// The store reflects every prior import; never prerender — the edge cache
// (Cache-Control below) is the only allowed staleness.
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const entries = await readEntries();
  const body = {
    builderCount: entries.length,
    totalTokens: entries.reduce((s, e) => s + e.totalTokens, 0),
    totalCost: entries.reduce((s, e) => s + e.estimatedCostUsd, 0),
  };
  return Response.json(body, {
    headers: {
      "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
    },
  });
}
