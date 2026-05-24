"use client";

import { Fragment } from "react";
import {
  V3_BUILDERS,
  V3_TRUST,
  fmtTokensCompact,
  fmtCostShort,
  verifDisplayLabel,
  type ImportedEntry,
  type VerifLevel,
} from "@/lib/data";
import { Avatar, Trend, Icon } from "@/components/primitives";

type Tier = "verified" | "estimated" | "selfrep";

type TrustIcon = "shield" | "lock" | "eye" | "code";

interface BurnIndexSectionProps {
  imported?: ImportedEntry[];
}

const TIER_ORDER: Tier[] = ["verified", "estimated", "selfrep"];

const TIER_META: Record<Tier, { label: string; caption: string }> = {
  verified: {
    label: "Source-verified",
    caption: "Measured at the API or CLI — token counts come from the source.",
  },
  estimated: {
    label: "Estimated",
    caption: "Token counts only; cost derived from public model pricing.",
  },
  selfrep: {
    label: "Manual entry",
    caption: "Submitted by the builder, not yet confirmed.",
  },
};

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="section-eyebrow">{children}</div>;
}

// Map a verification level to its trust tier. Unknown strings fall back to
// "selfrep" — the lowest-trust bucket — so no row can escape grouping.
function verifTier(verif: string): Tier {
  if (verif === "Provider-synced" || verif === "Device-synced") return "verified";
  if (verif === "Estimated") return "estimated";
  return "selfrep";
}

// Short-form tier descriptor for the inline chip on imported handles. Distinct
// from verifTier() — adds a non-color glyph (color-not-alone, WCAG) and a
// chip-sized label, while the main grid keeps its full section headers.
// Typed input mirrors the wire-format union so new VerifLevel literals force
// a compile-time check here (Codex review C-1 hardening).
function verifTierShort(verif: VerifLevel): { sym: string; label: string; cls: Tier } {
  const tier = verifTier(verif);
  if (tier === "verified") return { sym: "✓", label: "verified", cls: "verified" };
  if (tier === "estimated") return { sym: "~", label: "estimated", cls: "estimated" };
  return { sym: "·", label: "manual", cls: "selfrep" };
}

// Partition rows into the 3 tier buckets, preserving input order within each
// bucket (input is VES/rank-sorted, so VES order survives).
function groupByTier<T extends { verif: string }>(
  rows: T[],
): Record<Tier, T[]> {
  const buckets: Record<Tier, T[]> = {
    verified: [],
    estimated: [],
    selfrep: [],
  };
  for (const row of rows) buckets[verifTier(row.verif)].push(row);
  return buckets;
}

// Calendar window label for an imported card — "all" has no bounds.
function periodLabel(entry: ImportedEntry): string {
  if (entry.period === "all" || !entry.since || !entry.until) return "All time";
  const day = (iso: string) => iso.slice(0, 10);
  return `This ${entry.period} · ${day(entry.since)} – ${day(entry.until)}`;
}

export function BurnIndexSection({ imported = [] }: BurnIndexSectionProps) {
  const grouped = groupByTier(V3_BUILDERS);

  // Imported block stays a single grid — tier-sort only (verified first),
  // no sub-headers. Array.sort is stable, so VES order holds within a tier.
  const sortedImports = [...imported].sort(
    (a, b) =>
      TIER_ORDER.indexOf(verifTier(a.verif)) -
      TIER_ORDER.indexOf(verifTier(b.verif)),
  );

  return (
    <section className="section" id="burn">
      <div className="section-inner">
        <Eyebrow>Burn Index</Eyebrow>
        <h2 className="section-title">
          Who ships the most for the least?
        </h2>
        <p className="section-sub">
          Ranked by VES — Verified Efficiency Score (verified fixes ÷ AI cost USD).
          Lower spend, more fixes = higher rank.
        </p>
        <p className="burn-methodology-caption">
          30-day window. Source-verified costs rank above estimates and manual
          entries at the same VES.
        </p>

        <div className="lb-v3">
          <div className="lb-head">
            <span className="lb-col-rank">#</span>
            <span className="lb-col-builder">Builder</span>
            <span className="lb-col-tokens">Tokens</span>
            <span className="lb-col-cost">Cost</span>
            <span className="lb-col-trend">Trend</span>
          </div>

          {TIER_ORDER.map((tier) => {
            const bucket = grouped[tier];
            if (bucket.length === 0) return null;
            const meta = TIER_META[tier];
            return (
              <Fragment key={tier}>
                <div className={`lb-tier-head lb-tier-${tier}`}>
                  <div className="lb-tier-headrow">
                    <span className="lb-tier-label">{meta.label}</span>
                    <span className="lb-tier-count">{bucket.length}</span>
                  </div>
                  <p className="lb-tier-caption">{meta.caption}</p>
                </div>
                {bucket.map((b) => (
                  <div key={b.handle} className={`lb-row lb-row-${tier}`}>
                    <span className="lb-col-rank lb-rank">{b.rank}</span>
                    <span className="lb-col-builder">
                      <Avatar initials={b.avatar} size="sm" />
                      <span className="lb-handle">{b.handle}</span>
                    </span>
                    <span className="lb-col-tokens lb-mono">{b.tokens}</span>
                    <span className="lb-col-cost lb-mono">{b.cost}</span>
                    <span className="lb-col-trend">
                      <Trend dir={b.trend} value={b.trendVal} />
                    </span>
                  </div>
                ))}
              </Fragment>
            );
          })}
        </div>

        {imported.length > 0 && (
          <div className="lb-imported">
            <h3 className="lb-imported-title">Your imports</h3>
            <p className="lb-imported-cap">
              Imported from your local Burn Summary — shared across every
              browser. Verified rows sort to the top.
            </p>
            <div className="lb-v3">
              <div className="lb-head">
                <span className="lb-col-rank">#</span>
                <span className="lb-col-builder">Builder</span>
                <span className="lb-col-tokens">Tokens</span>
                <span className="lb-col-cost">Cost</span>
                <span className="lb-col-trend">Trend</span>
              </div>

              {sortedImports.map((e) => {
                const chip = verifTierShort(e.verif);
                return (
                  <div
                    key={e.handle}
                    className={`lb-row lb-imported-row lb-row-${chip.cls}`}
                  >
                    <span className="lb-col-rank lb-rank">—</span>
                    <span className="lb-col-builder">
                      <Avatar initials={e.avatar} size="sm" />
                      <span className="lb-imported-builder">
                        <span className="lb-imported-handle-row">
                          <span className="lb-handle">{e.handle}</span>
                          <span
                            className={`lb-imported-tier-chip lb-imported-tier-${chip.cls}`}
                            aria-label={verifDisplayLabel(e.verif)}
                          >
                            <span className="lb-imported-tier-sym" aria-hidden="true">
                              {chip.sym}
                            </span>
                            {chip.label}
                          </span>
                        </span>
                        <span className="lb-imported-period">{periodLabel(e)}</span>
                      </span>
                    </span>
                    <span className="lb-col-tokens lb-mono">
                      {fmtTokensCompact(e.totalTokens)}
                    </span>
                    <span className="lb-col-cost lb-mono">
                      {fmtCostShort(e.estimatedCostUsd)}
                    </span>
                    <span className="lb-col-trend">
                      {e.trendDir != null && e.trendPct != null ? (
                        <Trend
                          dir={e.trendDir}
                          value={`${e.trendPct > 0 ? "+" : ""}${e.trendPct}%`}
                        />
                      ) : (
                        "—"
                      )}
                    </span>
                  </div>
                );
              })}

              {sortedImports.length === 0 && (
                <p className="lb-imported-empty">
                  No imports yet.
                </p>
              )}
            </div>
          </div>
        )}

        <p className="section-note">
          VES = verified fixes ÷ AI cost (USD). Higher is better.
          Trust order: {verifDisplayLabel("Provider-synced")} &gt;{" "}
          {verifDisplayLabel("Device-synced")} &gt;{" "}
          {verifDisplayLabel("Estimated")} &gt;{" "}
          {verifDisplayLabel("Self-reported")}.
        </p>

        <div className="burn-trust">
          <h3 className="burn-trust-title">
            Built for builders who own their data.
          </h3>
          <p className="burn-trust-sub">
            We track efficiency metrics — never your code, prompts, or secrets.
            The collection spec is public and auditable.
          </p>

          <div className="trust-grid">
            {V3_TRUST.map((item, i) => (
              <div key={i} className="trust-item">
                <div className="trust-icon">
                  <Icon name={item.icon as TrustIcon} size={20} />
                </div>
                <div className="trust-body">
                  <h4 className="trust-title">{item.title}</h4>
                  <p className="trust-text">{item.body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="trust-note">
            <Icon name="shield" size={14} />
            <span>
              CoconutLabs never stores raw prompts, source code, or file paths.
              Only aggregated efficiency signals leave your device.{" "}
              <a href="#" className="trust-link">Read the full collection spec →</a>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
