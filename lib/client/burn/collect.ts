// collect.ts — assemble a Burn Summary envelope from FSA-discovered logs.
//
// Browser port of coconut_collector/collect.py. Groups parsed sessions by
// (tool, model, projectHash) and emits an envelope conforming to
// web/tools/usage-poc/burn-summary.schema.json.
//
// SECURITY (mirrors collect.py header): output carries ONLY the 9
// uploadable fields. Project slugs are consumed by projectHash() and never
// emitted. Content fields are never read by parsers.ts; this module never
// looks at raw line text at all — it operates on already-derived
// SessionParse scalars.
//
// Parity risks vs the Python reference, each addressed in this file:
//   1) Python `round(x, 4)` is banker's rounding (half-to-even); JS
//      Math.round is half-away-from-zero. We use bankersRound() so a row
//      whose true cost is 0.12345 lands on 0.1234 (matching Python) instead
//      of 0.1235.
//   2) `_utc_day` extracts a 'YYYY-MM-DD' prefix from the raw timestamp
//      string — it is NOT timezone-normalised. We mirror that with a regex
//      slice rather than constructing a Date.
//   3) `_parse_instant` treats naive timestamps as UTC. `new Date(s)` in JS
//      varies (Safari: local time, Chrome: UTC) for offset-less strings, so
//      we explicitly append 'Z' before parsing when no offset is present.
//   4) ISO weekday: Python's `weekday()` is Mon=0..Sun=6, JS getUTCDay() is
//      Sun=0..Sat=6. We compute Mon-aligned weekday with
//      `(getUTCDay() + 6) % 7` for the LAST COMPLETED ISO week math.

import {
  costBreakdown,
  findClaudeLogs,
  findCodexLogs,
  matchModel,
  parseClaudeFile,
  parseCodexFile,
  safeAdd,
  type ClaudeTokens,
  type CodexTokens,
  type SessionParse,
  type SessionTokens,
} from "./parsers";
import { projectHash } from "./hashing";
import {
  MODEL_PRICING,
  type PricingTable,
  type ClaudeRate,
  type CodexRate,
} from "./pricing.generated";

// PoC-internal tool name → Burn Summary `tool` enum (mirrors collect.py).
const TOOL_NAME = { claude: "claude-code", codex: "codex" } as const;

// Selectable leaderboard windows. 'all' disables filtering (local audit
// only — Burn Summary submission always uses 'week').
export type Period = "day" | "week" | "month" | "year" | "all";
const PERIODS: readonly Period[] = ["day", "week", "month", "year", "all"];

// Mirrors collect.py _DAY_RE.
const DAY_RE = /^(\d{4}-\d{2}-\d{2})/;

// Detects a trailing offset on an ISO-8601 string ('Z', '+HH:MM', '-HH:MM',
// '+HHMM', '-HHMM'). Used to decide whether to append 'Z' so a naive
// timestamp is parsed as UTC across all browsers.
const TZ_OFFSET_RE = /(Z|[+-]\d{2}:?\d{2})$/;

// CPython parity for `round(x, 4)`. The cost field round-trips through the
// schema and drives leaderboard ranking — a single-cent drift between the
// Python collector and the TS browser collector would let two identical
// sessions hash to different rows, splitting projects across the table.
//
// CPython's `round(x, n)` calls `_Py_dg_dtoa(x, mode=3, ndigits=n)` which
// rounds the ACTUAL IEEE-754 bit pattern of x to n decimals. Because
// 0.00025 is stored as 0.00025000000000000000520... (slightly LARGER than
// the exact decimal), CPython rounds it UP to 0.0003 — even though pure
// banker's rounding on the decimal string "0.00025" would round to 0.0002.
//
// A prior version of this function used `toPrecision(15)` to "normalise"
// representation noise before banker's rounding. That destroyed the very
// bit pattern CPython relies on, producing systematic divergence (0.00025
// → 0.0002 instead of 0.0003, 0.12345 → 0.1234 instead of 0.1235, etc.).
//
// V8's `Number.prototype.toFixed(decimals)` happens to match CPython's
// behaviour exactly: it uses double-conversion against the raw bit pattern
// just like `_Py_dg_dtoa`. Empirically verified parity on 3015 test cases
// (cost-like decimals × 10⁻⁶..10⁻³ range + half-way edges + negatives +
// signed zero). `Number()` strips trailing zeros so `2.6750` → `2.675`.
function bankersRound(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return value;
  return Number(value.toFixed(decimals));
}

// Mirrors collect.py _utc_day: regex-slice the date prefix from the raw
// ISO string. NOT timezone-normalised — a '2026-05-20T23:30:00-05:00'
// timestamp counts as 2026-05-20, same as Python.
function utcDay(timestamp: string | null): string | null {
  if (!timestamp) return null;
  const m = DAY_RE.exec(timestamp);
  return m ? m[1] : null;
}

// Mirrors collect.py _parse_instant. Returns a Date in UTC, or null when
// the string is missing or unparseable. Naive timestamps (no offset) are
// treated as UTC by appending 'Z' before construction — `new Date(s)` is
// implementation-defined for offset-less strings.
function parseInstant(timestamp: string | null): Date | null {
  if (!timestamp) return null;
  const hasOffset = TZ_OFFSET_RE.test(timestamp);
  const normalised = hasOffset ? timestamp : `${timestamp}Z`;
  const dt = new Date(normalised);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

// ISO weekday: Monday=0..Sunday=6. JS getUTCDay() is Sun=0..Sat=6, so we
// shift by 6 and mod 7 to land Monday at 0.
function isoWeekday(date: Date): number {
  return (date.getUTCDay() + 6) % 7;
}

// Format a Date as schema-valid second-precision UTC 'Z'. Mirrors Python's
// strftime("%Y-%m-%dT%H:%M:%SZ"). toISOString() emits millisecond precision
// (e.g. '2026-05-20T12:34:56.789Z'), which the schema rejects.
function formatGenerated(date: Date): string {
  const y = date.getUTCFullYear().toString().padStart(4, "0");
  const mo = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const d = date.getUTCDate().toString().padStart(2, "0");
  const h = date.getUTCHours().toString().padStart(2, "0");
  const mi = date.getUTCMinutes().toString().padStart(2, "0");
  const s = date.getUTCSeconds().toString().padStart(2, "0");
  return `${y}-${mo}-${d}T${h}:${mi}:${s}Z`;
}

// Snap a UTC instant to the start of its day.
function utcDayStart(date: Date): Date {
  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    0, 0, 0, 0,
  ));
}

// Mirrors collect.py _calendar_window. Returns null for 'all' (no
// filtering), or a [since, until) UTC pair. 'week' is the LAST COMPLETED
// ISO week — Monday-aligned, [prior_monday, this_monday) — so a Monday and
// a Sunday importer compete over the same fully-elapsed 7 days.
function calendarWindow(period: Period, now: Date): [Date, Date] | null {
  if (period === "all") return null;
  const day0 = utcDayStart(now);
  const MS_DAY = 86_400_000;
  if (period === "day") {
    return [day0, new Date(day0.getTime() + MS_DAY)];
  }
  if (period === "week") {
    const thisMonday = new Date(day0.getTime() - isoWeekday(day0) * MS_DAY);
    const priorMonday = new Date(thisMonday.getTime() - 7 * MS_DAY);
    return [priorMonday, thisMonday];
  }
  if (period === "month") {
    const since = new Date(Date.UTC(
      day0.getUTCFullYear(),
      day0.getUTCMonth(),
      1,
      0, 0, 0, 0,
    ));
    const until = since.getUTCMonth() === 11
      ? new Date(Date.UTC(since.getUTCFullYear() + 1, 0, 1, 0, 0, 0, 0))
      : new Date(Date.UTC(
          since.getUTCFullYear(),
          since.getUTCMonth() + 1,
          1,
          0, 0, 0, 0,
        ));
    return [since, until];
  }
  if (period === "year") {
    const since = new Date(Date.UTC(day0.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
    const until = new Date(Date.UTC(day0.getUTCFullYear() + 1, 0, 1, 0, 0, 0, 0));
    return [since, until];
  }
  throw new Error(`unknown period: ${period}`);
}

function inWindow(
  sp: SessionParse<SessionTokens>,
  window: [Date, Date] | null,
): boolean {
  if (window === null) return true;
  const instant = parseInstant(sp.timestamp);
  if (instant === null) return false;
  const [since, until] = window;
  const t = instant.getTime();
  return t >= since.getTime() && t < until.getTime();
}

// Map a tool-specific token dict to the schema's tokenCount shape. Mirrors
// collect.py _schema_token_count exactly: claude folds the two cache_write
// tiers into a single field, codex routes cached_input into cachedInput.
interface SchemaTokenCount {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cachedInput: number;
}

function schemaTokenCount(
  tool: "claude" | "codex",
  tok: SessionTokens,
): SchemaTokenCount {
  if (tool === "claude") {
    const t = tok as ClaudeTokens;
    return {
      input: t.input,
      output: t.output,
      cacheRead: t.cache_read,
      cacheWrite: safeAdd(t.cache_write_5m, t.cache_write_1h),
      cachedInput: 0,
    };
  }
  const t = tok as CodexTokens;
  return {
    input: t.input,
    output: t.output,
    cacheRead: 0,
    cacheWrite: 0,
    cachedInput: t.cached_input,
  };
}

interface Verification {
  tokenSource: "device";
  costBasis: "estimated";
  priceConfidence: "high" | "low";
  level: "Device-synced" | "Estimated";
}

function buildVerification(confidence: "high" | "low"): Verification {
  return {
    tokenSource: "device",
    costBasis: "estimated",
    priceConfidence: confidence,
    level: confidence === "high" ? "Device-synced" : "Estimated",
  };
}

// Aggregated group keyed by (tool, model, projectHash).
interface Group {
  tokens: Record<string, number>;
  sessions: number;
  days: Set<string>;
}

// Sort key: (tool, model, projectHash) lexicographic, matching Python's
// `sorted(groups.items())` which compares tuples element-by-element.
function compareKey(
  a: readonly [string, string, string],
  b: readonly [string, string, string],
): number {
  for (let i = 0; i < 3; i++) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return 0;
}

// Convert SessionTokens (a union) to a generic numeric record so the
// aggregator can sum any tier without per-tool branching.
function tokensAsRecord(tokens: SessionTokens): Record<string, number> {
  return tokens as unknown as Record<string, number>;
}

// Handles passed in from the UI layer. Either may be null — a Safari user
// importing only Codex logs, say. At least one must be present.
export interface CollectInputs {
  claudeProjectsHandle: FileSystemDirectoryHandle | null;
  codexSessionsHandle: FileSystemDirectoryHandle | null;
  salt: string;
  now?: Date;
  period?: Period;
}

// Internal: walk handles, parse each session, group by (tool, model, phash).
async function collectGroups(
  inputs: CollectInputs,
  window: [Date, Date] | null,
): Promise<Map<string, Group> & { __keys: Map<string, [string, string, string]> }> {
  const groups = new Map<string, Group>();
  const keyMap = new Map<string, [string, string, string]>();
  const { claudeProjectsHandle, codexSessionsHandle, salt } = inputs;

  // Closure-scoped hash callback. Raw slugs never leave the parser layer —
  // they enter as directory names or `cwd` strings, get hashed here, and
  // only the 12-char hex tail crosses back into collect.ts. The salt is
  // captured by this closure and never written into envelope output.
  const hashSlug = (slug: string): Promise<string> => projectHash(slug, salt);

  async function ingest(
    sp: SessionParse<SessionTokens>,
    tool: "claude" | "codex",
  ): Promise<void> {
    // Skip empty-token sessions (mirrors `sum(sp.tokens.values()) == 0`).
    const totals = Object.values(tokensAsRecord(sp.tokens));
    let sum = 0;
    for (const v of totals) sum += v;
    if (sum === 0) return;
    if (!inWindow(sp, window)) return;
    const phash = sp.projectHash;
    const keyTuple: [string, string, string] = [tool, sp.model, phash];
    const keyStr = `${tool}${sp.model}${phash}`;
    let grp = groups.get(keyStr);
    if (grp === undefined) {
      const seed: Record<string, number> = {};
      for (const k of Object.keys(tokensAsRecord(sp.tokens))) seed[k] = 0;
      grp = { tokens: seed, sessions: 0, days: new Set() };
      groups.set(keyStr, grp);
      keyMap.set(keyStr, keyTuple);
    }
    for (const [k, v] of Object.entries(tokensAsRecord(sp.tokens))) {
      grp.tokens[k] = safeAdd(grp.tokens[k] ?? 0, v);
    }
    grp.sessions += 1;
    const day = utcDay(sp.timestamp);
    if (day) grp.days.add(day);
  }

  if (claudeProjectsHandle) {
    const entries = await findClaudeLogs(claudeProjectsHandle, hashSlug);
    for (const entry of entries) {
      let sp: SessionParse<ClaudeTokens>;
      try {
        sp = await parseClaudeFile(entry.file, entry.projectHash);
      } catch {
        // Per security comments: never log raw paths or line content. A
        // malformed file is silently skipped, same as Python.
        continue;
      }
      await ingest(sp, "claude");
    }
  }

  if (codexSessionsHandle) {
    const entries = await findCodexLogs(codexSessionsHandle);
    for (const entry of entries) {
      let sp: SessionParse<CodexTokens>;
      try {
        sp = await parseCodexFile(entry.file, hashSlug);
      } catch {
        continue;
      }
      await ingest(sp, "codex");
    }
  }

  // Attach key map for downstream sorting without re-parsing the joined key.
  (groups as Map<string, Group> & { __keys: Map<string, [string, string, string]> })
    .__keys = keyMap;
  return groups as Map<string, Group> & {
    __keys: Map<string, [string, string, string]>;
  };
}

// Public envelope row shape — mirrors burn-summary.schema.json.
export interface EnvelopeRow {
  tool: "claude-code" | "codex";
  model: string;
  tokenCount: SchemaTokenCount;
  estimatedCostUsd: number;
  timestampBucket: string;
  sessionCount: number;
  activeDays: number;
  projectHash: string;
  verification: Verification;
}

export interface PeriodWindow {
  period: Period;
  since: string | null;
  until: string | null;
}

export interface Envelope {
  schemaVersion: "2";
  generatedAt: string;
  periodWindow: PeriodWindow;
  rows: EnvelopeRow[];
  grandTotal: {
    totalTokens: number;
    estimatedCostUsd: number;
  };
}

// Public API. Assembles the Burn Summary envelope (schemaVersion 2).
// `period` selects the calendar window; window end and `generatedAt` are
// anchored to the same instant. Throws when `period` is unknown or no
// sessions fall in the window.
export async function buildEnvelope(
  inputs: CollectInputs,
  options: { generatedAt?: string } = {},
): Promise<Envelope> {
  const period: Period = inputs.period ?? "week";
  if (!PERIODS.includes(period)) {
    throw new Error("unknown period");
  }
  let now: Date;
  let generatedAt: string;
  if (options.generatedAt !== undefined) {
    const parsed = parseInstant(options.generatedAt);
    if (parsed === null) {
      throw new Error("invalid generatedAt");
    }
    now = parsed;
    generatedAt = formatGenerated(parsed);
  } else if (inputs.now) {
    now = inputs.now;
    generatedAt = formatGenerated(now);
  } else {
    now = new Date();
    generatedAt = formatGenerated(now);
  }
  const fallbackDay = generatedAt.slice(0, 10);
  const window = calendarWindow(period, now);
  const groups = await collectGroups({ ...inputs, now }, window);

  const sortedKeys = [...groups.__keys.entries()]
    .sort((a, b) => compareKey(a[1], b[1]));

  const rows: EnvelopeRow[] = [];
  let totalTokens = 0;
  let totalCost = 0;
  for (const [keyStr, keyTuple] of sortedKeys) {
    const grp = groups.get(keyStr)!;
    const [tool, model, phash] = keyTuple as [
      "claude" | "codex",
      string,
      string,
    ];
    const providerTable = tool === "claude"
      ? (MODEL_PRICING as PricingTable).claude
      : (MODEL_PRICING as PricingTable).codex;
    const { rate, confidence } = matchModel(
      providerTable as Record<string, ClaudeRate | CodexRate> & {
        _default: ClaudeRate | CodexRate;
      },
      model,
    );
    const priceRecord = rate as unknown as Record<string, number>;
    const breakdown = costBreakdown(grp.tokens, priceRecord);
    let rawCost = 0;
    for (const v of Object.values(breakdown)) rawCost += v;
    const cost = bankersRound(rawCost, 4);
    const tokenCount = schemaTokenCount(tool, grp.tokens as unknown as SessionTokens);
    const rowTotal = safeAdd(
      safeAdd(
        safeAdd(
          safeAdd(tokenCount.input, tokenCount.output),
          tokenCount.cacheRead,
        ),
        tokenCount.cacheWrite,
      ),
      tokenCount.cachedInput,
    );
    const days = [...grp.days].sort();
    rows.push({
      tool: TOOL_NAME[tool],
      model,
      tokenCount,
      estimatedCostUsd: cost,
      timestampBucket: days.length > 0 ? days[days.length - 1] : fallbackDay,
      sessionCount: grp.sessions,
      activeDays: days.length,
      projectHash: phash,
      verification: buildVerification(confidence),
    });
    totalTokens = safeAdd(totalTokens, rowTotal);
    const nextCost = totalCost + cost;
    totalCost = Number.isFinite(nextCost) ? nextCost : totalCost;
  }
  if (rows.length === 0) {
    throw new Error(`no sessions in period '${period}'`);
  }
  const periodWindow: PeriodWindow = window === null
    ? { period, since: null, until: null }
    : {
        period,
        since: formatGenerated(window[0]),
        until: formatGenerated(window[1]),
      };
  return {
    schemaVersion: "2",
    generatedAt,
    periodWindow,
    rows,
    grandTotal: {
      totalTokens,
      estimatedCostUsd: bankersRound(totalCost, 4),
    },
  };
}

// Internal helpers exported for unit-test parity checks. Not consumed by
// the UI layer.
export const __internal = {
  bankersRound,
  utcDay,
  parseInstant,
  isoWeekday,
  formatGenerated,
  calendarWindow,
  inWindow,
  schemaTokenCount,
  buildVerification,
  compareKey,
};
