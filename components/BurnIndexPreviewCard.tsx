"use client";

import type {
  BurnSummary,
  BurnSummaryEnvelope,
  PeriodWindow,
} from "@/lib/validateSummary";
import { deriveVerifLevel } from "@/lib/data";
import { VerifBadge } from "@/components/primitives";

interface BurnIndexPreviewCardProps {
  envelope: BurnSummaryEnvelope;
}

function fmtTokens(n: number): string {
  return n.toLocaleString("en-US");
}

// Row total derived from the 5 tokenCount sub-fields. Rows themselves no
// longer carry a redundant `totalTokens` (the 9-field whitelist excludes it);
// the grand total is the only authoritative aggregate in the envelope.
function rowTotalTokens(r: BurnSummary): number {
  const t = r.tokenCount;
  return t.input + t.output + t.cacheRead + t.cacheWrite + t.cachedInput;
}

// Human caption for the calendar window the collector aggregated over.
// "all" has no bounds; every other period carries an ISO date range.
export function fmtPeriodWindow(pw: PeriodWindow): string {
  if (pw.period === "all" || !pw.since || !pw.until) return "All time";
  const day = (iso: string) => iso.slice(0, 10);
  return `This ${pw.period} · ${day(pw.since)} – ${day(pw.until)}`;
}

function fmtCost(n: number): string {
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Local preview of a validated Burn Summary. The badge is recomputed from
// the verification axes via deriveVerifLevel — the file's own `level` is a
// hint and is never trusted. See coconutlabs-verification-model.md §0-A.
export function BurnIndexPreviewCard({ envelope }: BurnIndexPreviewCardProps) {
  const { rows, grandTotal, generatedAt, periodWindow } = envelope;
  return (
    <div className="burn-preview">
      <h3 className="form-title">Burn Summary preview</h3>
      <p className="form-desc">
        Validated locally — nothing was uploaded. {rows.length} row
        {rows.length === 1 ? "" : "s"}, generated {generatedAt}.
      </p>
      <p className="bp-period">{fmtPeriodWindow(periodWindow)}</p>

      <div className="bp-list">
        {rows.map((r, i) => (
          <div key={`${r.projectHash}-${r.model}-${i}`} className="bp-row">
            <div className="bp-proj">
              <span className="bp-hash">{r.projectHash}</span>
              <span className="bp-meta">
                {r.tool} · {r.model}
              </span>
              <VerifBadge level={deriveVerifLevel(r.verification)} />
            </div>
            <div className="bp-nums">
              <span className="bp-tokens">{fmtTokens(rowTotalTokens(r))}</span>
              <span className="bp-cost">{fmtCost(r.estimatedCostUsd)}</span>
            </div>
          </div>
        ))}
        <div className="bp-row bp-total">
          <div className="bp-proj">
            <span className="bp-total-label">Grand total</span>
          </div>
          <div className="bp-nums">
            <span className="bp-tokens">
              {fmtTokens(grandTotal.totalTokens)}
            </span>
            <span className="bp-cost">
              {fmtCost(grandTotal.estimatedCostUsd)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
