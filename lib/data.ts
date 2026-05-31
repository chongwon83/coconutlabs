export type VerifLevel = "Provider-synced" | "Device-synced" | "Estimated" | "Self-reported";
export type TrendDir = "up" | "down" | "flat";
export type DropType = "readonly" | "config" | "executable";
export type DropStatus = "Free" | "soon" | `$${number}`;

export interface Builder {
  rank: number;
  handle: string;
  verif: VerifLevel;
  // Numeric-first: display strings + VES are derived in BuildersSection via the
  // canonical formatters (fmtTokensCompact / fmtVes / computeVes), so the demo
  // seed has a single VES computation path shared with the live leaderboard
  // (no hand-typed VES literal that can drift from fixes ÷ cost).
  tokens: number;
  costUsd: number;
  fixes: number;
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

// Single source of truth for the inbound contact address — referenced from the
// footer "Contact" mailto link. Temporary personal address; swap to a
// coconutlabs.xyz alias here (one line) once the domain mailbox is set up.
export const CONTACT_EMAIL = "chongwon5026@gmail.com";

// Demo/marketing seed for BuildersSection + the legacy Ticker. VES is DERIVED
// (computeVes/fmtVes), never hand-typed — so these tokens/cost/fixes must read
// as a believable WEEK of heavy AI-assisted work. Cost is a realistic weekly
// spend (hundreds–low-thousands of $) at a ~$5 / 1M-token blended rate, and
// fixes/cost lands the displayed VES ("commits per $1k") in a credible 30–90
// range — bracketing real operator data (153 / $3860 = 39.6). The old seed
// implied $4/week spend (VES 200k under the per-$1k display): indefensible.
// Ordered rank 1→5 by descending VES so the demo matches the live default sort.
export const V3_BUILDERS: Builder[] = [
  {
    rank: 1,
    handle: "@shellcoder",
    verif: "Device-synced",
    tokens: 148_000_000,
    costUsd: 740,
    fixes: 64, // 64 / $740 → VES 86.5
    trend: "up",
    trendVal: "+12%",
    avatar: "SC",
  },
  {
    rank: 2,
    handle: "@tinyshipper",
    verif: "Provider-synced",
    tokens: 138_000_000,
    costUsd: 690,
    fixes: 51, // 51 / $690 → VES 73.9
    trend: "up",
    trendVal: "+8%",
    avatar: "TS",
  },
  {
    rank: 3,
    handle: "@coconutfix",
    verif: "Self-reported",
    tokens: 264_000_000,
    costUsd: 1320,
    fixes: 86, // 86 / $1320 → VES 65.2
    trend: "down",
    trendVal: "-3%",
    avatar: "CF",
  },
  {
    rank: 4,
    handle: "@noor",
    verif: "Device-synced",
    tokens: 142_000_000,
    costUsd: 710,
    fixes: 37, // 37 / $710 → VES 52.1
    trend: "up",
    trendVal: "+2%",
    avatar: "NO",
  },
  {
    rank: 5,
    handle: "@4ndres",
    verif: "Provider-synced",
    tokens: 176_000_000,
    costUsd: 880,
    fixes: 28, // 28 / $880 → VES 31.8
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
  // included) when the count is known, and omits it when unknown. The browser
  // FSA path now also emits it via isomorphic-git over a granted directory
  // handle (see lib/client/burn/gitcount.ts). See gitcount.py for CLI parity.
  verifiedCommits?: number;
  // Provenance of verifiedCommits: "cli" = Python collector, "browser-fsa" =
  // in-browser isomorphic-git count. Drives the server-side precedence merge
  // (cli outranks browser-fsa) so a later browser upload cannot clobber or
  // lower a CLI count. Only meaningful when verifiedCommits is present; a
  // present count with absent source is treated as "cli" (back-compat).
  verifiedCommitsSource?: "cli" | "browser-fsa";
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
  // CANONICAL handle (spec §2.6): @-prefix + casing collapsed to one key via
  // canonicalHandle(). The leaderboard dedupe / history / claim key.
  handle: string;
  // Case-preserving original, persisted ONLY when it differs from `handle`
  // (e.g. handle "foo", displayHandle "Foo"). Render-only — NEVER a store key.
  // Absent for already-canonical handles; UI falls back to `handle`.
  displayHandle?: string;
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
  // Provenance of `fixes`, mirrored from envelope.verifiedCommitsSource at
  // import time. Used by the burnStore precedence merge so a later
  // numerator-absent or browser-fsa upload cannot clobber/lower a CLI count.
  // Legacy rows persisted before this field have `fixes` set but no
  // `fixesSource` — each store's hydrateEntry backfills "cli" on read, and the
  // merge ranks fixes-present + source-absent as CLI (see mergeNumerator).
  fixesSource?: "cli" | "browser-fsa";
  ves?: number;
  // trend, filled by the /api/burnindex GET from each handle's weekly import
  // history (see lib/server/trend.ts). Absent until 2 weekly imports — renders "—".
  trendDir?: TrendDir;
  trendPct?: number;
  trendSeries?: number[];
}

// VES — Verified Efficiency Score: the RAW ratio verifiedFixes / costUsd
// (commits per dollar). This stays raw so sort comparators and unit tests
// keep a stable unit; the human-facing rescale to "commits per $1k" lives in
// fmtVes(). Returns null when cost is non-positive (cannot divide), so a free
// or zero-cost card shows "—" rather than Infinity.
export function computeVes(verifiedFixes: number, costUsd: number): number | null {
  if (costUsd <= 0) return null;
  return verifiedFixes / costUsd;
}

// Pick the single highest-VES entry for headline surfaces (StatusBar). Only
// entries whose VES was derived (fixes present) qualify; ties keep the
// first seen. Returns null when no entry has VES yet → the caller shows a
// "be first" empty state. NOTE: `imported` is ordered newest-first, so this
// MUST scan for the MAX rather than read entries[0].
export function topVesEntry(
  entries: ImportedEntry[],
): { ves: number; handle: string } | null {
  let best: { ves: number; handle: string } | null = null;
  for (const e of entries) {
    if (e.ves == null) continue;
    if (best === null || e.ves > best.ves) {
      best = { ves: e.ves, handle: e.handle };
    }
  }
  return best;
}

// VES is only a credible headline once enough builders post a NONZERO score.
// Below this threshold the leaderboard hides the VES column entirely and the
// StatusBar/Ticker suppress VES — surfacing an all-"0.0"/"—" column reads as
// "no data" and undercuts the "trust the data" pitch. Bump when real verified
// fixes start landing.
export const VES_REVEAL_THRESHOLD = 2;

// True once at least VES_REVEAL_THRESHOLD entries have a real (nonzero) VES.
// Single source of truth for every VES-visibility gate (leaderboard column,
// StatusBar Top VES, Ticker VES tail) so the surfaces can never disagree.
export function hasEnoughVes(entries: ImportedEntry[]): boolean {
  let n = 0;
  for (const e of entries) {
    if (e.ves != null && e.ves > 0 && ++n >= VES_REVEAL_THRESHOLD) return true;
  }
  return false;
}

// Top entry among NONZERO-VES builders, for the StatusBar headline. Distinct
// from topVesEntry, which intentionally treats ves=0 as a valid candidate for
// other callers/tests — a "Top VES: 0.0" headline is exactly what we avoid.
export function topNonzeroVesEntry(
  entries: ImportedEntry[],
): { ves: number; handle: string } | null {
  let best: { ves: number; handle: string } | null = null;
  for (const e of entries) {
    if (e.ves == null || e.ves <= 0) continue;
    if (best === null || e.ves > best.ves) {
      best = { ves: e.ves, handle: e.handle };
    }
  }
  return best;
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

// Collapse a validated envelope into a single leaderboard card. `handle` MUST
// be the CANONICAL key (the route canonicalizes before calling). `displayHandle`
// is the case-preserving original; it is persisted ONLY when it differs from the
// canonical key, so already-canonical handles add no redundant field and the
// avatar stays keyed off the canonical handle (stable across casing variants).
export function buildImportedEntry(
  env: BurnSummaryEnvelope,
  handle: string,
  displayHandle?: string,
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
  // Persist the case-preserving display form ONLY when it actually differs from
  // the canonical key — an already-canonical handle carries no redundant field
  // (keeps stored blobs minimal and snapshot-stable).
  if (displayHandle != null && displayHandle !== handle) {
    entry.displayHandle = displayHandle;
  }
  // The single point where the device-measured numerator enters entry state.
  // Stored when measured (a real 0 is stored); ves is left to read-time
  // derivation in the GET route. Both CLI and the browser FSA path may supply
  // it now. fixesSource defaults to "cli" when a count is present without an
  // explicit source (back-compat with pre-provenance CLI envelopes).
  if (env.verifiedCommits != null) {
    entry.fixes = env.verifiedCommits;
    entry.fixesSource = env.verifiedCommitsSource ?? "cli";
  }
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

// VES (Verified Efficiency Score) for the leaderboard cell. `n` is the RAW
// ratio from computeVes (verified commits ÷ AI-cost-USD). Real weekly spend
// dwarfs commit counts (e.g. 153 / $3860 = 0.0396), so the raw ratio collapses
// to "0.0" under one-decimal rounding — useless on a headline metric. We
// display it as **commits per $1k of AI spend** (raw × 1000 → 39.6), which
// keeps real scores in a readable two-digit range while computeVes stays the
// pure ratio (so its unit tests and the sort comparators are untouched).
// Adaptive precision: tiny scores keep 2 decimals so they don't re-collapse to
// 0, mid scores get 1, and large scores round with thousands separators. A
// positive-but-sub-0.005 score would still round to "0.00" (the same misleading
// zero this metric is fixing), so it gets an explicit "<0.01" floor. Non-finite
// input never comes from computeVes (null-guards cost ≤ 0) but is mapped to "—"
// rather than rendering a literal "NaN" on a headline cell.
export function fmtVes(n: number): string {
  const score = n * 1000; // raw commits/USD → commits per $1k spend
  if (!Number.isFinite(score)) return "—";
  if (score <= 0) return "0"; // exact zero, plus a guard against impossible negatives
  if (score < 0.005) return "<0.01"; // positive but rounds to 0.00 → show a floor, never a false zero
  if (score < 10) return score.toFixed(2);
  if (score < 1000) return score.toFixed(1);
  return Math.round(score).toLocaleString("en-US");
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
