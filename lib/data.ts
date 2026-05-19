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

export const V3_NAV: NavLink[] = [
  { label: "Burn Index", href: "#burn" },
  { label: "Challenges", href: "#challenge" },
  { label: "Drops", href: "#drops" },
  { label: "Trust & Safety", href: "#safety" },
];

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
  totalTokens: number;
  estimatedCostUsd: number;
  timestampBucket: string; // "YYYY-MM-DD" UTC day
  sessionCount: number;
  activeDays: number;
  projectHash: string; // 12-hex sha256(salt:slug) prefix
  verification: BurnVerification;
}

export interface BurnSummaryEnvelope {
  schemaVersion: "1";
  generatedAt: string;
  rows: BurnSummary[];
  grandTotal: { totalTokens: number; estimatedCostUsd: number };
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
