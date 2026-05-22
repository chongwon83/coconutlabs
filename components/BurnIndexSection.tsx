"use client";

import { Fragment, useState } from "react";
import {
  V3_BUILDERS,
  fmtTokensCompact,
  fmtCostShort,
  type ImportedEntry,
} from "@/lib/data";
import { VerifBadge, Avatar, Trend } from "@/components/primitives";
import { Sparkline } from "@/components/Sparkline";

type Filter = "all" | "provider" | "device" | "estimated" | "selfrep";

type Tier = "verified" | "estimated" | "selfrep";

interface BurnIndexSectionProps {
  imported?: ImportedEntry[];
}

const TIER_ORDER: Tier[] = ["verified", "estimated", "selfrep"];

const TIER_META: Record<Tier, { label: string; caption: string }> = {
  verified: {
    label: "Verified",
    caption: "Provider or device-synced — measured at the source.",
  },
  estimated: {
    label: "Estimated",
    caption: "Derived from partial signals.",
  },
  selfrep: {
    label: "Self-reported",
    caption: "Submitted by the builder, not yet confirmed.",
  },
};

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="section-eyebrow">{children}</div>;
}

function matchesFilter(verif: string, filter: Filter): boolean {
  if (filter === "all") return true;
  if (filter === "provider") return verif === "Provider-synced";
  if (filter === "device") return verif === "Device-synced";
  if (filter === "estimated") return verif === "Estimated";
  if (filter === "selfrep") return verif === "Self-reported";
  return true;
}

// Map a verification level to its trust tier. Unknown strings fall back to
// "selfrep" — the lowest-trust bucket — so no row can escape grouping.
function verifTier(verif: string): Tier {
  if (verif === "Provider-synced" || verif === "Device-synced") return "verified";
  if (verif === "Estimated") return "estimated";
  return "selfrep";
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
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = V3_BUILDERS.filter((b) => matchesFilter(b.verif, filter));
  const filteredImports = imported.filter((e) => matchesFilter(e.verif, filter));

  const grouped = groupByTier(filtered);

  // Imported block stays a single grid — tier-sort only (verified first),
  // no sub-headers. Array.sort is stable, so VES order holds within a tier.
  const sortedImports = [...filteredImports].sort(
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
          30-day rolling window · 3-tier trust hierarchy:
          {" "}<strong>Verified</strong> (provider / device-synced) &gt;
          {" "}<strong>Estimated</strong> &gt;
          {" "}<strong>Self-reported</strong>.
        </p>

        <div className="lb-filters">
          {(["all", "provider", "device", "estimated", "selfrep"] as Filter[]).map((f) => (
            <button
              key={f}
              className={`lb-filter${filter === f ? " lb-filter-active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "All" : f === "provider" ? "Provider-synced" : f === "device" ? "Device-synced" : f === "estimated" ? "Estimated" : "Self-reported"}
            </button>
          ))}
        </div>

        <div className="lb-v3">
          <div className="lb-head">
            <span className="lb-col-rank">#</span>
            <span className="lb-col-builder">Builder</span>
            <span className="lb-col-verif">Verification</span>
            <span className="lb-col-tokens">Tokens</span>
            <span className="lb-col-cost">Cost</span>
            <span className="lb-col-fixes">Fixes</span>
            <span className="lb-col-ves">VES</span>
            <span className="lb-col-trend">Trend</span>
            <span className="lb-col-spark">Spark</span>
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
                    <span className="lb-col-verif">
                      <VerifBadge level={b.verif} />
                    </span>
                    <span className="lb-col-tokens lb-mono">{b.tokens}</span>
                    <span className="lb-col-cost lb-mono">{b.cost}</span>
                    <span className="lb-col-fixes lb-mono">{b.fixes}</span>
                    <span className="lb-col-ves lb-ves">{b.ves}</span>
                    <span className="lb-col-trend">
                      <Trend dir={b.trend} value={b.trendVal} />
                    </span>
                    <span className="lb-col-spark">
                      <Sparkline handle={b.handle} />
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
              browser. Verified rows sort to the top. Fixes &amp; VES populate
              once your challenge submissions are verified.
            </p>
            <div className="lb-v3">
              <div className="lb-head">
                <span className="lb-col-rank">#</span>
                <span className="lb-col-builder">Builder</span>
                <span className="lb-col-verif">Verification</span>
                <span className="lb-col-tokens">Tokens</span>
                <span className="lb-col-cost">Cost</span>
                <span className="lb-col-fixes">Fixes</span>
                <span className="lb-col-ves">VES</span>
                <span className="lb-col-trend">Trend</span>
                <span className="lb-col-spark">Spark</span>
              </div>

              {sortedImports.map((e) => (
                <div
                  key={e.handle}
                  className={`lb-row lb-imported-row lb-row-${verifTier(e.verif)}`}
                >
                  <span className="lb-col-rank lb-rank">—</span>
                  <span className="lb-col-builder">
                    <Avatar initials={e.avatar} size="sm" />
                    <span className="lb-imported-builder">
                      <span className="lb-handle">{e.handle}</span>
                      <span className="lb-imported-period">{periodLabel(e)}</span>
                    </span>
                  </span>
                  <span className="lb-col-verif">
                    <VerifBadge level={e.verif} />
                  </span>
                  <span className="lb-col-tokens lb-mono">
                    {fmtTokensCompact(e.totalTokens)}
                  </span>
                  <span className="lb-col-cost lb-mono">
                    {fmtCostShort(e.estimatedCostUsd)}
                  </span>
                  <span className="lb-col-fixes lb-mono">
                    {e.fixes != null ? e.fixes.toLocaleString("en-US") : "—"}
                  </span>
                  <span className="lb-col-ves lb-ves">
                    {e.ves != null ? e.ves.toFixed(1) : "—"}
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
                  <span className="lb-col-spark">
                    <Sparkline handle={e.handle} series={e.trendSeries} />
                  </span>
                </div>
              ))}

              {sortedImports.length === 0 && (
                <p className="lb-imported-empty">
                  No imports match this filter.
                </p>
              )}
            </div>
          </div>
        )}

        <p className="section-note">
          VES = verified fixes ÷ AI cost (USD). Higher is better.
          Verification badges: Provider-synced &gt; Device-synced &gt; Estimated &gt; Self-reported.
        </p>
      </div>
    </section>
  );
}
