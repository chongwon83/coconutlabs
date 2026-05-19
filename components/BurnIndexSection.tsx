"use client";

import { useState } from "react";
import {
  V3_BUILDERS,
  fmtTokensCompact,
  fmtCostShort,
  type ImportedEntry,
} from "@/lib/data";
import { VerifBadge, Avatar, Trend } from "@/components/primitives";
import { Sparkline } from "@/components/Sparkline";

type Filter = "all" | "provider" | "device" | "estimated" | "selfrep";

interface BurnIndexSectionProps {
  imported?: ImportedEntry[];
}

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
            <span className="lb-col-trend">7d</span>
            <span className="lb-col-spark">Spark</span>
          </div>

          {filtered.map((b) => (
            <div key={b.handle} className="lb-row">
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
        </div>

        {imported.length > 0 && (
          <div className="lb-imported">
            <h3 className="lb-imported-title">Your imports</h3>
            <p className="lb-imported-cap">
              Imported from your local Burn Summary — stored only in this
              browser. Fixes &amp; VES populate once challenge submissions are
              verified.
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
                <span className="lb-col-trend">7d</span>
                <span className="lb-col-spark">Spark</span>
              </div>

              {filteredImports.map((e) => (
                <div key={e.handle} className="lb-row lb-imported-row">
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
                  <span className="lb-col-fixes lb-mono">—</span>
                  <span className="lb-col-ves lb-ves">—</span>
                  <span className="lb-col-trend">—</span>
                  <span className="lb-col-spark">
                    <Sparkline handle={e.handle} />
                  </span>
                </div>
              ))}

              {filteredImports.length === 0 && (
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
