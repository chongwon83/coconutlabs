// BurnIndexSection.tsx — single live leaderboard with sort + filter.
//
// PR Track A (2026-05-25) replaced the V3_BUILDERS mock grid + tier sub-headers
// + sibling "Your imports" block with ONE unified grid driven by real imports.
// useColumnSort owns sort state (default "토큰 많이 쓴 순"); a 3-tab filter
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
  type VerifLevel,
} from "@/lib/data";
import { Avatar, Trend, Icon } from "@/components/primitives";
import {
  useColumnSort,
  type SortKey,
  type SortDir,
} from "@/components/hooks/useColumnSort";

type Tier = "verified" | "estimated" | "selfrep";
type TrustIcon = "shield" | "lock" | "eye" | "code";

// Owner intent: "claude+codex 경쟁 = 통합 경쟁" — entries that used both tools
// surface under each single-tool filter, so the contest reads as inclusive.
// Entries with an empty toolsUsed (legacy imports pre-A.1) only appear under
// "All" — single-tool filters require an explicit tool tag.
type ToolFilter = "all" | "claude-code" | "codex";

const FILTERS: { key: ToolFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "claude-code", label: "Claude Code" },
  { key: "codex", label: "Codex" },
];

// Column → CSS class + visible label + i18n aria-label for the header button.
// `handle` is the only column that sorts ascending by default (A→Z reads
// naturally); the numeric columns default to descending (biggest first).
const SORT_COLS: { key: SortKey; cls: string; label: string }[] = [
  { key: "handle", cls: "lb-col-builder", label: "Builder" },
  { key: "totalTokens", cls: "lb-col-tokens", label: "Tokens" },
  { key: "estimatedCostUsd", cls: "lb-col-cost", label: "Cost" },
  { key: "trendPct", cls: "lb-col-trend", label: "Trend" },
];

interface BurnIndexSectionProps {
  imported?: ImportedEntry[];
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

export function BurnIndexSection({ imported = [] }: BurnIndexSectionProps) {
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

        <div className="lb-filters" role="group" aria-label="도구 필터">
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

        <div className="lb-v3">
          <div className="lb-head" role="row">
            <span className="lb-col-rank" role="columnheader">#</span>
            {SORT_COLS.map((col) => {
              const active = sortKey === col.key;
              return (
                <div
                  key={col.key}
                  role="columnheader"
                  aria-sort={ariaSort(col.key)}
                  className={col.cls}
                >
                  <button
                    type="button"
                    className={`lb-sort-btn${active ? " lb-sort-btn-active" : ""}`}
                    onClick={() => toggle(col.key)}
                    aria-label={`${col.label} 기준 정렬`}
                  >
                    <span>{col.label}</span>
                    <span className="lb-sort-arrow" aria-hidden="true">
                      {sortArrow(active, sortDir)}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>

          {sorted.map((e, i) => {
            const chip = verifTierShort(e.verif);
            return (
              <div key={e.handle} className="lb-row lb-imported-row">
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

          {sorted.length === 0 && (
            <div className="lb-empty">
              {imported.length === 0 ? (
                <>
                  아직 데이터가 없어요.{" "}
                  <a href="#hero" className="lb-empty-link">
                    Join Burn Index
                  </a>
                  로 첫 데이터를 제출해주세요.
                </>
              ) : (
                <>
                  이 탭에는 결과가 없어요.{" "}
                  <button
                    type="button"
                    onClick={() => setFilter("all")}
                    className="lb-empty-link lb-empty-link--button"
                  >
                    All 탭
                  </button>
                  에서 전체 기록을 확인해보세요.
                  <div className="lb-empty-hint">
                    본인 entry가 보이지 않으면, 데이터를 다시 가져오면 도구 태그가 새로 잡힐 수 있어요.
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
