export type VerifLevel = "Provider-synced" | "Device-synced" | "Estimated" | "Self-reported";
export type TrendDir = "up" | "down" | "flat";
export type DropType = "readonly" | "config" | "executable";
export type DropStatus = "Free" | "soon" | `$${number}`;

export interface Builder {
  rank: number;
  handle: string;
  verif: VerifLevel;
  tokens: string;
  cost: string;
  fixes: string;
  ves: string;
  trend: TrendDir;
  trendVal: string;
  avatar: string;
}

export interface Challenge {
  id: string;
  label: string;
  reward: string;
  deadline: string;
  participants: number;
  description: string;
}

export interface Drop {
  id: string;
  title: string;
  author: string;
  kind: DropType;
  status: DropStatus;
  description: string;
}

export interface TrustItem {
  icon: string;
  title: string;
  body: string;
}

export interface NavLink {
  label: string;
  href: string;
}

export const V3_NAV: NavLink[] = [];

// Single source of truth for the collector repo URL — referenced from
// JoinBurnIndexForm Step 1 ("View collector source ↗") and the quickstart
// `git clone` line. If the collector moves to its own repo, change this one
// constant and the copy button stays in sync.
export const COLLECTOR_REPO_URL = "https://github.com/chongwon83/coconutlabs";

export const V3_BUILDERS: Builder[] = [
  {
    rank: 1,
    handle: "@shellcoder",
    verif: "Device-synced",
    tokens: "2.1M",
    cost: "$4.20",
    fixes: "847",
    ves: "201.7",
    trend: "up",
    trendVal: "+12%",
    avatar: "SC",
  },
  {
    rank: 2,
    handle: "@tinyshipper",
    verif: "Provider-synced",
    tokens: "1.8M",
    cost: "$3.60",
    fixes: "712",
    ves: "197.8",
    trend: "up",
    trendVal: "+8%",
    avatar: "TS",
  },
  {
    rank: 3,
    handle: "@coconutfix",
    verif: "Self-reported",
    tokens: "3.2M",
    cost: "$9.60",
    fixes: "1,024",
    ves: "106.7",
    trend: "down",
    trendVal: "-3%",
    avatar: "CF",
  },
  {
    rank: 4,
    handle: "@noor",
    verif: "Device-synced",
    tokens: "1.1M",
    cost: "$2.20",
    fixes: "430",
    ves: "195.5",
    trend: "up",
    trendVal: "+2%",
    avatar: "NO",
  },
  {
    rank: 5,
    handle: "@4ndres",
    verif: "Provider-synced",
    tokens: "980K",
    cost: "$1.96",
    fixes: "378",
    ves: "192.9",
    trend: "up",
    trendVal: "+1%",
    avatar: "4N",
  },
];

export const CHALLENGES: Challenge[] = [
  {
    id: "c1",
    label: "Fix a real Lighthouse regression",
    reward: "$50",
    deadline: "48h",
    participants: 14,
    description: "Ship a verifiable fix that improves Lighthouse score by ≥10 points. Claude Code only.",
  },
  {
    id: "c2",
    label: "Zero-token refactor",
    reward: "$30",
    deadline: "72h",
    participants: 9,
    description: "Refactor a component with the lowest possible token spend. VES judged.",
  },
  {
    id: "c3",
    label: "Bug hunt: cost < $0.10",
    reward: "$20",
    deadline: "24h",
    participants: 22,
    description: "Find and fix a verified bug for under 10 cents of AI spend.",
  },
];

export const V3_DROPS: Drop[] = [
  {
    id: "d1",
    title: "Low-Cost Debugging",
    author: "@shellcoder",
    kind: "readonly",
    status: "Free",
    description: "A step-by-step workflow for debugging with minimal token spend. Read-only guide.",
  },
  {
    id: "d2",
    title: "Claude Code Review Loop",
    author: "@tinyshipper",
    kind: "config",
    status: "$24",
    description: "Pre-configured review loop that cuts review token cost by ~40%.",
  },
  {
    id: "d3",
    title: "Codex Repo Bootstrap Pack",
    author: "@4ndres",
    kind: "executable",
    status: "soon",
    description: "Executable scaffold pack for starting new repos with Codex-optimized structure.",
  },
];

export const V3_TRUST: TrustItem[] = [
  {
    icon: "shield",
    title: "No raw prompt storage",
    body: "We never store, process, or transmit your source code, prompts, or responses. Zero.",
  },
  {
    icon: "lock",
    title: "Device-local collection",
    body: "Usage data is aggregated on your machine. Only token counts and cost estimates leave your device.",
  },
  {
    icon: "eye",
    title: "Transparent verification",
    body: "Every badge shows exactly how it was verified: Provider-synced, Device-synced, Estimated, or Self-reported.",
  },
  {
    icon: "code",
    title: "Open collection spec",
    body: "The collector spec is public. Anyone can audit what fields are collected and what stays local.",
  },
];

// --- Burn Summary (collector output contract) ---
// Mirrors web/tools/usage-poc/burn-summary.schema.json. The 9 uploadable
// fields from handoff §8 — no raw content keys ever appear here.

export type TokenSource = "device" | "self";
export type CostBasis = "estimated" | "native";
export type PriceConfidence = "high" | "low";

export interface BurnVerification {
  tokenSource: TokenSource;
  costBasis: CostBasis;
  priceConfidence: PriceConfidence;
  level: VerifLevel; // display hint only — consumers recompute via deriveVerifLevel
}

export interface BurnTokenCount {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cachedInput: number;
}

export interface BurnSummary {
  tool: "claude-code" | "codex";
  model: string;
  tokenCount: BurnTokenCount;
  estimatedCostUsd: number;
  timestampBucket: string; // "YYYY-MM-DD" UTC day
  sessionCount: number;
  activeDays: number;
  projectHash: string; // 12-hex sha256(salt:slug) prefix
  verification: BurnVerification;
}

export type Period = "day" | "week" | "month" | "year" | "all";

// The calendar window the collector aggregated over. `since`/`until` are
// ISO-8601 UTC `Z` strings forming a closed-open range [since, until); both
// are null exactly when `period` is "all" (no bound). See collect.py
// _period_window and burn-summary.schema.json (schema v2).
export interface PeriodWindow {
  period: Period;
  since: string | null;
  until: string | null;
}

export interface BurnSummaryEnvelope {
  schemaVersion: "3";
  generatedAt: string;
  periodWindow: PeriodWindow;
  rows: BurnSummary[];
  grandTotal: { totalTokens: number; estimatedCostUsd: number };
  // Device-measured count of the operator's own git commits within
  // periodWindow — the VES numerator. Optional: the CLI emits it (a real 0
  // included) when the count is known, and omits it when unknown; the browser
  // FSA path always omits it (it can't run git). See gitcount.py.
  verifiedCommits?: number;
}

// Per-tool×model breakdown inside an ImportedEntry. Allows the leaderboard to
// slice token/cost by tool filter (claude-code vs codex) and display model
// proportion chips. Entries imported before this field existed hydrate to `[]`
// (see burnStore/* lazy migration) and render "—" in filtered views.
export interface ImportedEntryBreakdown {
  tool: "claude-code" | "codex";
  model: string;
  totalTokens: number;
  estimatedCostUsd: number;
}

// A builder card derived from an imported envelope. `fixes` is the
// device-measured git commit count (the VES numerator), stored at import time
// from `env.verifiedCommits` when present (see buildImportedEntry). `ves` is
// NOT persisted — the /api/burnindex GET derives it at read time from the
// stored `fixes` and current cost via computeVes, so `fixes` stays the single
// source of truth. An entry with no measured count keeps `fixes` undefined and
// renders "—".
export interface ImportedEntry {
  handle: string;
  avatar: string;
  verif: VerifLevel;
  totalTokens: number;
  estimatedCostUsd: number;
  period: Period;
  since: string | null;
  until: string | null;
  importedAt: string;
  // Distinct tools that contributed rows to this aggregate, derived from
  // BurnSummary.tool. Non-optional with `[]` allowed so the filter tabs in
  // BurnIndexSection always have an array to read. Stored entries written
  // before this field existed hydrate to `[]` defensively (see burnStore/*).
  toolsUsed: ("claude-code" | "codex")[];
  // Per-tool×model breakdown. Default `[]` for backward-compatible entries.
  // Populated from BurnSummary.rows so the leaderboard can slice tokens/cost
  // per tool filter and show model proportion chips (see BurnIndexSection).
  breakdown: ImportedEntryBreakdown[];
  fixes?: number;
  ves?: number;
  // trend, filled by the /api/burnindex GET from each handle's weekly import
  // history (see lib/server/trend.ts). Absent until 2 weekly imports — renders "—".
  trendDir?: TrendDir;
  trendPct?: number;
  trendSeries?: number[];
}

// VES — Verified Efficiency Score: verified fixes per dollar of AI spend.
// Returns null when cost is non-positive (cannot divide), so a free or
// zero-cost card shows "—" rather than Infinity.
export function computeVes(verifiedFixes: number, costUsd: number): number | null {
  if (costUsd <= 0) return null;
  return verifiedFixes / costUsd;
}

// Recompute the display verification level from the two orthogonal axes +
// price confidence. The file's `verification.level` is an untrusted hint —
// consumers MUST call this rather than read it. See
// web/docs/decision/coconutlabs-verification-model.md §0-A.
export function deriveVerifLevel(v: BurnVerification): VerifLevel {
  if (v.tokenSource === "self") return "Self-reported";
  if (v.costBasis === "native") return "Provider-synced";
  // device + estimated: unmatched model price downgrades to Estimated
  return v.priceConfidence === "high" ? "Device-synced" : "Estimated";
}

// The trust level of a multi-row summary is its weakest row — one
// Self-reported row drags the whole card down, so an aggregate can never
// claim more confidence than its least-verified component. Each row's level
// is recomputed via deriveVerifLevel (the file's own `level` is untrusted).
const VERIF_RANK: Record<VerifLevel, number> = {
  "Self-reported": 0,
  Estimated: 1,
  "Device-synced": 2,
  "Provider-synced": 3,
};
const VERIF_BY_RANK: VerifLevel[] = [
  "Self-reported",
  "Estimated",
  "Device-synced",
  "Provider-synced",
];

// Wire-format VerifLevel literals double as labels in Apple Health/Strava etc.,
// so a first-time visitor can read the leaderboard as a fitness tracker. Keep
// the union as the persisted contract (validateSummary.ts:52, Redis,
// localStorage) and route every UI render through this mapper so display copy
// can shift without a storage migration.
const VERIF_DISPLAY: Record<VerifLevel, string> = {
  "Provider-synced": "API-verified",
  "Device-synced": "CLI-verified",
  Estimated: "Token-only estimate",
  "Self-reported": "Manual entry",
};

export function verifDisplayLabel(level: VerifLevel): string {
  return VERIF_DISPLAY[level];
}

export function aggregateVerifLevel(rows: BurnSummary[]): VerifLevel {
  if (rows.length === 0) return "Self-reported";
  let weakest = 3;
  for (const r of rows) {
    weakest = Math.min(weakest, VERIF_RANK[deriveVerifLevel(r.verification)]);
  }
  return VERIF_BY_RANK[weakest];
}

// Derive an avatar's two-letter initials from a handle (strips a leading @).
function avatarFor(handle: string): string {
  const name = handle.replace(/^@+/, "").trim();
  return (name.slice(0, 2) || "??").toUpperCase();
}

// Group rows by tool×model and aggregate tokens + cost. Token sum uses all 5
// tokenCount sub-fields (matches validateSummary.ts TOKEN_COUNT_KEYS and the
// grandTotal.totalTokens contract), so per-breakdown sums add up to the
// entry's totalTokens when summed across all groups.
function aggregateBreakdown(rows: BurnSummary[]): ImportedEntryBreakdown[] {
  const map = new Map<string, ImportedEntryBreakdown>();
  for (const r of rows) {
    const key = `${r.tool}::${r.model}`;
    const tc = r.tokenCount;
    const tokens =
      tc.input +
      tc.output +
      (tc.cacheRead ?? 0) +
      (tc.cacheWrite ?? 0) +
      (tc.cachedInput ?? 0);
    const prev = map.get(key);
    if (prev) {
      prev.totalTokens += tokens;
      prev.estimatedCostUsd += r.estimatedCostUsd;
    } else {
      map.set(key, {
        tool: r.tool,
        model: r.model,
        totalTokens: tokens,
        estimatedCostUsd: r.estimatedCostUsd,
      });
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => b.estimatedCostUsd - a.estimatedCostUsd,
  );
}

// Collapse a validated envelope into a single leaderboard card.
export function buildImportedEntry(
  env: BurnSummaryEnvelope,
  handle: string,
): ImportedEntry {
  // Unique tools that produced rows in this envelope. Sorted for stable
  // serialization (Set iteration order is insertion-based; sort gives
  // deterministic JSON output for snapshot tests + Redis blob comparison).
  const toolsUsed = Array.from(
    new Set(env.rows.map((r) => r.tool)),
  ).sort() as ("claude-code" | "codex")[];
  const entry: ImportedEntry = {
    handle,
    avatar: avatarFor(handle),
    verif: aggregateVerifLevel(env.rows),
    totalTokens: env.grandTotal.totalTokens,
    estimatedCostUsd: env.grandTotal.estimatedCostUsd,
    period: env.periodWindow.period,
    since: env.periodWindow.since,
    until: env.periodWindow.until,
    importedAt: new Date().toISOString(),
    toolsUsed,
    breakdown: aggregateBreakdown(env.rows),
  };
  // The single point where the device-measured numerator enters entry state.
  // Stored only when the CLI measured it (a real 0 is stored); ves is left to
  // read-time derivation in the GET route. Browser uploads omit it → "—".
  if (env.verifiedCommits != null) entry.fixes = env.verifiedCommits;
  return entry;
}

// Compact token count: 2.6B / 1.2M / 340K / 980 — for the dense leaderboard grid.
export function fmtTokensCompact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

// Cost rounded to whole dollars with thousands separators: $1,234.
export function fmtCostShort(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

// VES (Verified Efficiency Score) for the leaderboard cell: one decimal — 201.7.
// Absent VES renders "—" at the call site, never 0; this only formats a number.
export function fmtVes(n: number): string {
  return n.toFixed(1);
}

// Pick the entry whose `since` is the most recent and return its [since, until)
// window. Guarantees a valid pair from real data — never synthesizes a range.
// Returns null when no weekly entry exists; callers must hide UI in that case.
export function representativeWeek(
  entries: ImportedEntry[],
): { since: string; until: string } | null {
  const weekly = entries.filter(
    (e) => e.period === "week" && e.since && e.until,
  );
  if (weekly.length === 0) return null;
  const latest = weekly.reduce((a, b) => (a.since! > b.since! ? a : b));
  return { since: latest.since!, until: latest.until! };
}

// Convert an ISO-8601 UTC Z timestamp to YYYY-MM-DD KST for tooltip text.
// Pure stdlib: shift +9h then slice; no DST in Korea.
export function utcIsoToKstDay(iso: string): string {
  const utcMs = Date.parse(iso);
  const kst = new Date(utcMs + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

// Deterministic sparkline seed — LCG with handle as seed
export function sparkFor(handle: string): number[] {
  let seed = 0;
  for (let i = 0; i < handle.length; i++) {
    seed = (seed * 31 + handle.charCodeAt(i)) >>> 0;
  }
  const pts: number[] = [];
  for (let i = 0; i < 12; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    pts.push((seed >>> 0) / 4294967295);
  }
  return pts;
}
