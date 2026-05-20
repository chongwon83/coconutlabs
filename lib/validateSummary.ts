// validateSummary.ts — client-side validation of an uploaded Burn Summary.
//
// The Burn Index import flow is purely local: a user pastes or uploads a
// JSON envelope produced by the CoconutLabs collector. Before we render it
// we verify it matches BurnSummaryEnvelope exactly — right shape, the 9
// whitelist fields per row, and NO unexpected keys anywhere. Rejecting
// unknown keys is the client-side mirror of the schema's
// `additionalProperties: false`: it guarantees a tampered file carrying raw
// content / file paths / secrets cannot smuggle extra data into the UI.

import type {
  BurnSummary,
  BurnSummaryEnvelope,
  BurnTokenCount,
  BurnVerification,
  PeriodWindow,
} from "@/lib/data";

export type ValidationResult =
  | { ok: true; envelope: BurnSummaryEnvelope }
  | { ok: false; error: string };

const ENVELOPE_KEYS = [
  "schemaVersion", "generatedAt", "periodWindow", "rows", "grandTotal",
];
const PERIOD_WINDOW_KEYS = ["period", "since", "until"];
const PERIODS = ["day", "week", "month", "year", "all"];
const GRAND_TOTAL_KEYS = ["totalTokens", "estimatedCostUsd"];
const ROW_KEYS = [
  "tool", "model", "tokenCount", "estimatedCostUsd",
  "timestampBucket", "sessionCount", "activeDays", "projectHash",
  "verification",
];
const TOKEN_COUNT_KEYS = [
  "input", "output", "cacheRead", "cacheWrite", "cachedInput",
];
const VERIFICATION_KEYS = ["tokenSource", "costBasis", "priceConfidence", "level"];

// A model id is a short token like "claude-opus-4-7". Charset-restricted so
// a tampered file cannot smuggle a path/command/secret into this field —
// the client mirror of the collector's _safe_model and the schema pattern.
const MODEL_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;

// ISO-8601 UTC instant, e.g. "2026-05-19T00:00:00Z" — the only timestamp
// shape the collector emits (generatedAt + periodWindow bounds).
const ISO_Z_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

const TOOLS = ["claude-code", "codex"];
const TOKEN_SOURCES = ["device", "self"];
const COST_BASES = ["estimated", "native"];
const PRICE_CONFIDENCES = ["high", "low"];
const LEVELS = ["Provider-synced", "Device-synced", "Estimated", "Self-reported"];

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// Returns the name of the first key not in `allowed`, or null if clean.
function unexpectedKey(obj: Record<string, unknown>, allowed: string[]): string | null {
  for (const k of Object.keys(obj)) {
    if (!allowed.includes(k)) return k;
  }
  return null;
}

function isIntAtLeastZero(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}

function isFiniteNonNeg(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0;
}

function checkTokenCount(tc: unknown, where: string): string | null {
  if (!isObject(tc)) return `${where}.tokenCount must be an object`;
  const bad = unexpectedKey(tc, TOKEN_COUNT_KEYS);
  if (bad) return `${where}.tokenCount has unexpected key "${bad}"`;
  for (const k of TOKEN_COUNT_KEYS) {
    if (!isIntAtLeastZero(tc[k])) return `${where}.tokenCount.${k} must be an integer ≥ 0`;
  }
  return null;
}

function checkVerification(v: unknown, where: string): string | null {
  if (!isObject(v)) return `${where}.verification must be an object`;
  const bad = unexpectedKey(v, VERIFICATION_KEYS);
  if (bad) return `${where}.verification has unexpected key "${bad}"`;
  if (!TOKEN_SOURCES.includes(v.tokenSource as string))
    return `${where}.verification.tokenSource is invalid`;
  if (!COST_BASES.includes(v.costBasis as string))
    return `${where}.verification.costBasis is invalid`;
  if (!PRICE_CONFIDENCES.includes(v.priceConfidence as string))
    return `${where}.verification.priceConfidence is invalid`;
  if (!LEVELS.includes(v.level as string))
    return `${where}.verification.level is invalid`;
  return null;
}

// The JSON schema can't express "since/until are null iff period is all" —
// the import path is the trust boundary, so we enforce it here. A tampered
// file claiming period "week" with null bounds (or "all" with bounds) is
// rejected rather than rendered with a nonsensical caption.
function checkPeriodWindow(pw: unknown): string | null {
  if (!isObject(pw)) return "periodWindow must be an object.";
  const bad = unexpectedKey(pw, PERIOD_WINDOW_KEYS);
  if (bad) return `periodWindow has unexpected key "${bad}".`;
  if (!PERIODS.includes(pw.period as string))
    return "periodWindow.period must be day, week, month, year, or all.";
  for (const k of ["since", "until"] as const) {
    if (pw[k] !== null && (typeof pw[k] !== "string" || !ISO_Z_RE.test(pw[k] as string)))
      return `periodWindow.${k} must be null or an ISO-8601 UTC timestamp.`;
  }
  // period "all" iff BOTH bounds are null. A one-sided window (one bound
  // null, the other set) is rejected for every period — it would otherwise
  // be rendered with a nonsensical "All time" caption.
  const sinceNull = pw.since === null;
  const untilNull = pw.until === null;
  if (pw.period === "all") {
    if (!sinceNull || !untilNull)
      return 'periodWindow: period "all" requires since and until to be null.';
  } else if (sinceNull || untilNull) {
    return `periodWindow: period "${pw.period}" requires non-null since and until.`;
  }
  return null;
}

function checkRow(row: unknown, i: number): string | null {
  const where = `rows[${i}]`;
  if (!isObject(row)) return `${where} must be an object`;
  const bad = unexpectedKey(row, ROW_KEYS);
  if (bad) return `${where} has unexpected key "${bad}" — only the 9 whitelist fields are allowed`;
  if (!TOOLS.includes(row.tool as string)) return `${where}.tool is invalid`;
  if (typeof row.model !== "string" || !MODEL_RE.test(row.model))
    return `${where}.model must be a model identifier (letters, digits, . _ -; 1–80 chars)`;
  const tcErr = checkTokenCount(row.tokenCount, where);
  if (tcErr) return tcErr;
  if (!isFiniteNonNeg(row.estimatedCostUsd)) return `${where}.estimatedCostUsd must be a number ≥ 0`;
  if (typeof row.timestampBucket !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(row.timestampBucket))
    return `${where}.timestampBucket must be a YYYY-MM-DD date`;
  if (!isIntAtLeastZero(row.sessionCount)) return `${where}.sessionCount must be an integer ≥ 0`;
  if (!isIntAtLeastZero(row.activeDays)) return `${where}.activeDays must be an integer ≥ 0`;
  if (typeof row.projectHash !== "string" || !/^[0-9a-f]{12}$/.test(row.projectHash))
    return `${where}.projectHash must be 12 lowercase hex chars`;
  const vErr = checkVerification(row.verification, where);
  if (vErr) return vErr;
  return null;
}

// Parse + validate a raw JSON string into a BurnSummaryEnvelope.
export function validateSummary(raw: string): ValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Not valid JSON — check the file or pasted text." };
  }
  if (!isObject(parsed)) return { ok: false, error: "Top level must be a JSON object." };

  const bad = unexpectedKey(parsed, ENVELOPE_KEYS);
  if (bad) return { ok: false, error: `Envelope has unexpected key "${bad}".` };

  if (parsed.schemaVersion === "1")
    return {
      ok: false,
      error: "This file is schema v1. Re-run the collector to emit v2.",
    };
  if (parsed.schemaVersion !== "2")
    return { ok: false, error: 'schemaVersion must be "2".' };
  if (typeof parsed.generatedAt !== "string" || !ISO_Z_RE.test(parsed.generatedAt))
    return { ok: false, error: "generatedAt must be an ISO-8601 UTC timestamp." };

  const pwErr = checkPeriodWindow(parsed.periodWindow);
  if (pwErr) return { ok: false, error: pwErr };

  if (!Array.isArray(parsed.rows)) return { ok: false, error: "rows must be an array." };
  if (parsed.rows.length === 0) return { ok: false, error: "rows is empty — nothing to import." };
  for (let i = 0; i < parsed.rows.length; i++) {
    const err = checkRow(parsed.rows[i], i);
    if (err) return { ok: false, error: err };
  }

  const gt = parsed.grandTotal;
  if (!isObject(gt)) return { ok: false, error: "grandTotal must be an object." };
  const gtBad = unexpectedKey(gt, GRAND_TOTAL_KEYS);
  if (gtBad) return { ok: false, error: `grandTotal has unexpected key "${gtBad}".` };
  if (!isIntAtLeastZero(gt.totalTokens))
    return { ok: false, error: "grandTotal.totalTokens must be an integer ≥ 0." };
  if (!isFiniteNonNeg(gt.estimatedCostUsd))
    return { ok: false, error: "grandTotal.estimatedCostUsd must be a number ≥ 0." };

  // grandTotal.totalTokens must equal the sum of every row's tokenCount
  // sub-fields. Rows no longer carry a redundant `totalTokens` (9-field
  // whitelist), so we compute each row's total here from its tokenCount.
  const rowsTotal = (parsed.rows as { tokenCount: Record<string, number> }[])
    .reduce(
      (s, r) => s + TOKEN_COUNT_KEYS.reduce((sum, k) => sum + r.tokenCount[k], 0),
      0,
    );
  if (gt.totalTokens !== rowsTotal)
    return {
      ok: false,
      error: `grandTotal.totalTokens (${gt.totalTokens}) does not equal the sum of row totals (${rowsTotal}).`,
    };

  // grandTotal.estimatedCostUsd must equal the sum of every row's cost.
  // Costs are floats (collector rounds to 4 decimals), so reconcile within a
  // 1-cent tolerance rather than exact equality. Without this, a tampered
  // but valid-shape file could display an arbitrary leaderboard cost.
  const rowsCost = (parsed.rows as { estimatedCostUsd: number }[])
    .reduce((s, r) => s + r.estimatedCostUsd, 0);
  if (Math.abs(gt.estimatedCostUsd - rowsCost) > 0.01)
    return {
      ok: false,
      error: `grandTotal.estimatedCostUsd (${gt.estimatedCostUsd}) does not equal the sum of row costs (${rowsCost.toFixed(4)}).`,
    };

  // Shape is proven — the cast is now safe.
  return { ok: true, envelope: parsed as unknown as BurnSummaryEnvelope };
}

// Re-exported for convenience in consuming components.
export type {
  BurnSummary,
  BurnSummaryEnvelope,
  BurnTokenCount,
  BurnVerification,
  PeriodWindow,
};
