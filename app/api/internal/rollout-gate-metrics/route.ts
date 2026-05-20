// app/api/internal/rollout-gate-metrics/route.ts — rollout gate status endpoint.
//
// Returns the current measurement state for all 7 axes so GitHub Actions can
// evaluate gate pass/fail automatically.
//
// Auth: requests must include the ROLLOUT_GATE_SECRET header matching the
// ROLLOUT_GATE_SECRET env var. This is a simple shared secret adequate for
// an internal read-only CI check. If the env var is unset the endpoint is
// disabled (returns 403) to prevent unintentional exposure.
//
// Axes 4 and 5 are CI-only (vitest) — their pass/fail comes from GitHub
// Actions check status, not from this endpoint. The response body marks them
// as "ci_only" so the gate workflow can look up the checks separately.

import { getMetricsSnapshot } from "@/lib/server/burn/metrics";

export const dynamic = "force-dynamic";

// Axis 1 threshold from five-axis-v2.md
const AXIS1_THRESHOLD = 15;
// Axis 2 thresholds
const AXIS2_MEDIAN_MAX_MIN = 10;   // median ≤ 10 minutes
const AXIS2_FAIL_RATE_MAX = 0.20;  // fail rate ≤ 20%
const AXIS2_MIN_N = 10;
// Axis 3 thresholds
const AXIS3_TERMINAL_MIN_PCT = 0.50;
const AXIS3_MIN_N = 20;
const AXIS3_EARLY_SIGNAL_N = 10;
const AXIS3_EARLY_SIGNAL_PCT = 0.80;

type AxisState = "PASS" | "FAIL" | "INSUFFICIENT_DATA" | "WARN" | "CI_ONLY";

interface GateMetricsResponse {
  generatedAt: string;
  axes: {
    axis1: { state: AxisState; value: number; threshold: number };
    axis2: { state: AxisState; started: number; completed: number; failed: number; failRate: number | null; medianBucket: string | null };
    axis3: { state: AxisState; total: number; terminalPct: number | null };
    axis4: { state: "CI_ONLY"; note: string };
    axis5: { state: "CI_ONLY"; note: string };
    axis6: { state: "CI_ONLY"; note: string };
    axis7: { state: "CI_ONLY"; note: string };
  };
  overallGatePass: boolean;
}

// Estimate the median duration bucket from bucket counts.
// Buckets are cumulative — iterate until we pass the 50th percentile.
const BUCKET_ORDER = ["0-1m", "1-3m", "3-5m", "5-10m", "10-20m", "20m+"];
// Midpoint minutes for each bucket (used as a proxy for median estimation)
const BUCKET_MIDPOINT: Record<string, number> = {
  "0-1m": 0.5, "1-3m": 2, "3-5m": 4, "5-10m": 7.5, "10-20m": 15, "20m+": 25,
};

function estimateMedianBucket(buckets: Record<string, number>, total: number): string | null {
  if (total === 0) return null;
  const half = total / 2;
  let cumulative = 0;
  for (const b of BUCKET_ORDER) {
    cumulative += buckets[b] ?? 0;
    if (cumulative >= half) return b;
  }
  return "20m+";
}

function estimateMedianMinutes(buckets: Record<string, number>, total: number): number | null {
  const bucket = estimateMedianBucket(buckets, total);
  if (!bucket) return null;
  return BUCKET_MIDPOINT[bucket] ?? null;
}

function evalAxis1(count: number): { state: AxisState; value: number; threshold: number } {
  const state: AxisState = count >= AXIS1_THRESHOLD ? "PASS" : "INSUFFICIENT_DATA";
  return { state, value: count, threshold: AXIS1_THRESHOLD };
}

function evalAxis2(
  started: number,
  completed: number,
  failed: number,
  buckets: Record<string, number>,
): { state: AxisState; started: number; completed: number; failed: number; failRate: number | null; medianBucket: string | null } {
  const attempted = completed + failed;
  if (attempted < AXIS2_MIN_N) {
    return { state: "INSUFFICIENT_DATA", started, completed, failed, failRate: null, medianBucket: null };
  }
  const failRate = failed / attempted;
  const medianBucket = estimateMedianBucket(buckets, attempted);
  const medianMin = estimateMedianMinutes(buckets, attempted);

  let state: AxisState;
  if (medianMin === null || medianMin > 20 || failRate > 0.35) {
    state = "FAIL";
  } else if (medianMin > 10 || failRate > AXIS2_FAIL_RATE_MAX) {
    state = "WARN";
  } else {
    state = "PASS";
  }
  return { state, started, completed, failed, failRate, medianBucket };
}

function evalAxis3(
  total: number,
  steps: Record<string, number>,
): { state: AxisState; total: number; terminalPct: number | null } {
  if (total < AXIS3_EARLY_SIGNAL_N) {
    return { state: "INSUFFICIENT_DATA", total, terminalPct: null };
  }
  const terminalCount = steps["terminal_setup"] ?? 0;
  const pct = terminalCount / total;
  if (total < AXIS3_MIN_N) {
    // EARLY_SIGNAL: n < 20 but ≥ 10. Not a gate block, just directional.
    const state: AxisState = pct >= AXIS3_EARLY_SIGNAL_PCT ? "WARN" : "INSUFFICIENT_DATA";
    return { state, total, terminalPct: pct };
  }
  const state: AxisState = pct >= AXIS3_TERMINAL_MIN_PCT ? "PASS" : "FAIL";
  return { state, total, terminalPct: pct };
}

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.ROLLOUT_GATE_SECRET;
  if (!secret) {
    return Response.json({ error: "ROLLOUT_GATE_SECRET not configured." }, { status: 403 });
  }
  const authHeader = request.headers.get("x-gate-secret");
  if (authHeader !== secret) {
    return Response.json({ error: "Unauthorized." }, { status: 403 });
  }

  let snapshot;
  try {
    snapshot = await getMetricsSnapshot();
  } catch {
    return Response.json({ error: "Could not read metrics." }, { status: 500 });
  }

  const a1 = evalAxis1(snapshot.axis1DistinctCount);
  const a2 = evalAxis2(
    snapshot.axis2.started,
    snapshot.axis2.completed,
    snapshot.axis2.failed,
    snapshot.axis2.buckets,
  );
  const a3 = evalAxis3(snapshot.axis3.total, snapshot.axis3.steps);

  const ciNote = "Pass/fail determined by GitHub Actions CI check status.";

  const overallGatePass =
    a1.state === "PASS" &&
    (a2.state === "PASS" || a2.state === "WARN") &&
    (a3.state === "PASS" || a3.state === "WARN");

  const body: GateMetricsResponse = {
    generatedAt: new Date().toISOString(),
    axes: {
      axis1: a1,
      axis2: a2,
      axis3: a3,
      axis4: { state: "CI_ONLY", note: ciNote },
      axis5: { state: "CI_ONLY", note: ciNote },
      axis6: { state: "CI_ONLY", note: ciNote },
      axis7: { state: "CI_ONLY", note: ciNote },
    },
    overallGatePass,
  };

  return Response.json(body, { status: 200 });
}
