// BurnIndexSection.tsx — single live leaderboard with sort + filter.
//
// PR Track A (2026-05-25) replaced the V3_BUILDERS mock grid + tier sub-headers
// + sibling "Your imports" block with ONE unified grid driven by real imports.
// useColumnSort owns sort state (default: highest token usage); a 3-tab filter
// (All / Claude Code / Codex) groups by toolsUsed so the leaderboard reads as
// an inclusive cross-tool contest. Empty store → inline CTA back to the hero
// so the section never renders a dead grid.
//
// SECURITY: read-only render. Sort/filter are pure client state; no fetch here
// (parent injects entries via SWR in Track B). VerifLevel chip per row uses the
// 4-union literals from validateSummary.ts — those names are wire-format and
// must not be renamed (storage contract).
"use client";

import { useMemo, useState } from "react";
import {
  V3_TRUST,
  fmtTokensCompact,
  fmtCostShort,
  verifDisplayLabel,
  type ImportedEntry,
  type ImportedEntryBreakdown,
  type VerifLevel,
} from "@/lib/data";
import { Avatar, Button, Trend, Icon } from "@/components/primitives";
import {
  useColumnSort,
  type SortKey,
  type SortDir,
} from "@/components/hooks/useColumnSort";

type Tier = "verified" | "estimated" | "selfrep";
type TrustIcon = "shield" | "lock" | "eye" | "code";

// Owner intent: "claude+codex rivalry = unified contest" — entries that used both tools
// surface under each single-tool filter, so the contest reads as inclusive.
// Entries with an empty toolsUsed (legacy imports pre-A.1) only appear under
// "All" — single-tool filters require an explicit tool tag.
type ToolFilter = "all" | "claude-code" | "codex";

const FILTERS: { key: ToolFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "claude-code", label: "Claude Code" },
  { key: "codex", label: "Codex" },
];

interface BurnIndexSectionProps {
  imported?: ImportedEntry[];
  onJoin: () => void;
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="section-eyebrow">{children}</div>;
}

function verifTier(verif: string): Tier {
  if (verif === "Provider-synced" || verif === "Device-synced") return "verified";
  if (verif === "Estimated") return "estimated";
  return "selfrep";
}

// Inline chip on the handle cell — replaces the deleted tier sub-headers as
// the per-row trust signal. Keeps color + glyph + label (color-not-alone, WCAG).
// Typed input mirrors the wire-format union so new VerifLevel literals force
// a compile-time check here (Codex review C-1 hardening, preserved from prior).
function verifTierShort(verif: VerifLevel): { sym: string; label: string; cls: Tier } {
  const tier = verifTier(verif);
  if (tier === "verified") return { sym: "✓", label: "verified", cls: "verified" };
  if (tier === "estimated") return { sym: "~", label: "estimated", cls: "estimated" };
  return { sym: "·", label: "manual", cls: "selfrep" };
}

function periodLabel(entry: ImportedEntry): string {
  if (entry.period === "all" || !entry.since || !entry.until) return "All time";
  const day = (iso: string) => iso.slice(0, 10);
  return `This ${entry.period} · ${day(entry.since)} – ${day(entry.until)}`;
}

// Glyph mirrors aria-sort: ↑ ascending, ↓ descending, — none. Screen readers
// get the state from aria-sort; sighted users get the same info from the glyph.
function sortArrow(active: boolean, dir: SortDir): string {
  if (!active) return "—";
  return dir === "asc" ? "↑" : "↓";
}

// Per-tool slice: extract tokens/cost for a specific tool filter from breakdown.
// NaN signals "no breakdown data for this filter" → renders "—".
function sliceForFilter(
  e: ImportedEntry,
  f: ToolFilter,
): { tokens: number; costUsd: number } {
  if (f === "all") return { tokens: e.totalTokens, costUsd: e.estimatedCostUsd };
  const slices = (e.breakdown ?? []).filter((b) => b.tool === f);
  if (slices.length > 0) {
    return {
      tokens: slices.reduce((acc, b) => acc + b.totalTokens, 0),
      costUsd: slices.reduce((acc, b) => acc + b.estimatedCostUsd, 0),
    };
  }
  // Legacy fallback: pre-B-cycle entry has no breakdown but `toolsUsed`
  // tags a single tool — attribute the whole aggregate to that one tool.
  if ((e.breakdown ?? []).length === 0 && e.toolsUsed.length === 1 && e.toolsUsed[0] === f) {
    return { tokens: e.totalTokens, costUsd: e.estimatedCostUsd };
  }
  return { tokens: NaN, costUsd: NaN };
}

function shortenModelName(model: string): string {
  if (model === "unknown") return "legacy";
  if (model.includes("opus-4-7")) return "opus 4.7";
  if (model.includes("opus-4-5")) return "opus 4.5";
  if (model.includes("sonnet-4-6")) return "sonnet 4.6";
  if (model.includes("sonnet-4-5")) return "sonnet 4.5";
  if (model.includes("haiku-4-5")) return "haiku 4.5";
  if (model.includes("gpt-5.5") || model.includes("gpt-5-codex")) return "gpt-5.5";
  if (model.includes("codex-mini")) return "codex-mini";
  return model;
}

function modelFamily(label: string): "opus" | "sonnet" | "haiku" | "gpt" | "codex" | "legacy" | "other" {
  const l = label.toLowerCase();
  if (l === "legacy") return "legacy";
  if (l.startsWith("opus")) return "opus";
  if (l.startsWith("sonnet")) return "sonnet";
  if (l.startsWith("haiku")) return "haiku";
  if (l.startsWith("gpt")) return "gpt";
  if (l.startsWith("codex")) return "codex";
  return "other";
}

function visibleModelChips(chips: { label: string; pct: number }[], max: number) {
  return chips.filter((c) => c.pct > 0).slice(0, max);
}

// Top-N model chips by cost share; overflow appended as "+N" chip (pct=0).
function topModelsChips(
  breakdown: ImportedEntryBreakdown[],
  max = 2,
): { label: string; pct: number }[] {
  if (breakdown.length === 0) return [];
  const total = breakdown.reduce((acc, b) => acc + b.estimatedCostUsd, 0);
  if (total === 0) return [];
  const sorted = [...breakdown].sort((a, b) => b.estimatedCostUsd - a.estimatedCostUsd);
  const top = sorted.slice(0, max).map((b) => ({
    label: shortenModelName(b.model),
    pct: Math.round((b.estimatedCostUsd / total) * 100),
  }));
  const remaining = sorted.length - max;
  if (remaining > 0) top.push({ label: `+${remaining}`, pct: 0 });
  return top;
}

export function BurnIndexSection({ imported = [], onJoin }: BurnIndexSectionProps) {
  const [filter, setFilter] = useState<ToolFilter>("all");

  // Apply tool filter BEFORE sort — sort always reflects the visible set so
  // rank reads consistently when the user toggles filters.
  const filtered = useMemo(
    () =>
      filter === "all"
        ? imported
        : imported.filter((e) => e.toolsUsed.includes(filter)),
    [imported, filter],
  );

  const { sorted, sortKey, sortDir, toggle, ariaSort } = useColumnSort(
    filtered,
    "totalTokens",
    "desc",
  );

  return (
    <section className="section" id="burn">
      <div className="section-inner">
        <Eyebrow>Burn Index · Live</Eyebrow>
        <h2 className="section-title">
          Who ships the most for the least?
        </h2>
        <p className="section-sub">
          CLI-verified imports only. Sort any column; filter by your tool.
        </p>
        <p className="burn-methodology-caption">
          Ranked from real imports. Default: most tokens first. Ties break by
          upload recency.
        </p>

        <div className="lb-toolbar">
          <div className="lb-filters" role="group" aria-label="Tool filter">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                className="lb-filter"
                aria-pressed={filter === f.key}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <Button variant="primary" size="lg" onClick={onJoin} data-testid="burn-cta-toolbar">
            Join Burn Index
          </Button>
        </div>

        <div className="lb-v3">
          <div className="lb-head" role="row">
            <span className="lb-col-rank" role="columnheader">#</span>
            <div role="columnheader" aria-sort={ariaSort("handle")} className="lb-col-builder">
              <button type="button" className={`lb-sort-btn${sortKey === "handle" ? " lb-sort-btn-active" : ""}`} onClick={() => toggle("handle")} aria-label="Sort by Builder">
                <span>Builder</span>
                <span className="lb-sort-arrow" aria-hidden="true">{sortArrow(sortKey === "handle", sortDir)}</span>
              </button>
            </div>
            <div role="columnheader" aria-sort={ariaSort("totalTokens")} className="lb-col-tokens">
              <button type="button" className={`lb-sort-btn${sortKey === "totalTokens" ? " lb-sort-btn-active" : ""}`} onClick={() => toggle("totalTokens")} aria-label="Sort by Tokens">
                <span>Tokens</span>
                <span className="lb-sort-arrow" aria-hidden="true">{sortArrow(sortKey === "totalTokens", sortDir)}</span>
              </button>
            </div>
            <div role="columnheader" aria-sort={ariaSort("estimatedCostUsd")} className="lb-col-cost">
              <button type="button" className={`lb-sort-btn${sortKey === "estimatedCostUsd" ? " lb-sort-btn-active" : ""}`} onClick={() => toggle("estimatedCostUsd")} aria-label="Sort by API cost">
                <span>API cost</span>
                <span className="lb-sort-arrow" aria-hidden="true">{sortArrow(sortKey === "estimatedCostUsd", sortDir)}</span>
              </button>
            </div>
            <span role="columnheader" className="lb-col-models">Models</span>
            <div role="columnheader" aria-sort={ariaSort("trendPct")} className="lb-col-trend">
              <button type="button" className={`lb-sort-btn${sortKey === "trendPct" ? " lb-sort-btn-active" : ""}`} onClick={() => toggle("trendPct")} aria-label="Sort by Trend">
                <span>Trend</span>
                <span className="lb-sort-arrow" aria-hidden="true">{sortArrow(sortKey === "trendPct", sortDir)}</span>
              </button>
            </div>
          </div>

          {sorted.map((e, i) => {
            const chip = verifTierShort(e.verif);
            const { tokens, costUsd } = sliceForFilter(e, filter);
            const modelChips = topModelsChips(e.breakdown ?? [], 2);
            return (
              <div key={e.handle} className="lb-row lb-imported-row" data-legacy={e.breakdown.length === 0 ? "true" : undefined}>
                <span className="lb-col-rank lb-rank">{i + 1}</span>
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
                  {Number.isNaN(tokens) ? "—" : fmtTokensCompact(tokens)}
                </span>
                <span className="lb-col-cost lb-mono">
                  {Number.isNaN(costUsd) ? "—" : fmtCostShort(costUsd)}
                </span>
                <span className="lb-col-models">
                  {modelChips.length === 0 ? (
                    <span className="lb-models-empty" aria-label="No model breakdown available">—</span>
                  ) : (
                    <span
                      className="lb-models-stack"
                      title={modelChips.map((c) => `${c.label} ${c.pct}%`).join(", ")}
                    >
                      {visibleModelChips(modelChips, 3).map((c) => (
                        <span key={c.label} className="lb-models-chip">
                          <span
                            className={`lb-models-dot lb-models-dot--${modelFamily(c.label)}`}
                            aria-hidden="true"
                          />
                          <span className="lb-models-chip-label">{c.label}</span>
                          <span className="lb-models-chip-pct">{c.pct}%</span>
                        </span>
                      ))}
                      {modelChips.length > 3 && (
                        <span className="lb-models-chip lb-models-chip--more">
                          +{modelChips.length - 3} more
                        </span>
                      )}
                    </span>
                  )}
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

          {sorted.length === 0 && (
            <div className="lb-empty">
              {imported.length === 0 ? (
                <>
                  No data yet.{" "}
                  <a href="#hero" className="lb-empty-link">
                    Join Burn Index
                  </a>
                  {" "}to submit your first entry.
                </>
              ) : (
                <>
                  No results in this tab.{" "}
                  <button
                    type="button"
                    onClick={() => setFilter("all")}
                    className="lb-empty-link lb-empty-link--button"
                  >
                    All tab
                  </button>
                  {" "}has the full record.
                  <div className="lb-empty-hint">
                    If your entry is not visible, try re-importing — it may re-tag your tools.
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <p className="section-note">
          VES = verified fixes ÷ AI cost (USD). Higher is better.
          Evidence order: {verifDisplayLabel("Provider-synced")} &gt;{" "}
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
