"use client";

import { useState } from "react";
import { Button, Badge } from "@/components/primitives";
import { fmtCostShort, fmtTokensCompact, type ImportedEntry } from "@/lib/data";

const SHOW_LEGACY = process.env.NEXT_PUBLIC_SHOW_LEGACY_SECTIONS === "true";

type HeroTab = "burn" | "challenge" | "drops";

export interface HeroStats {
  builderCount: number;
  totalTokens: number;
  totalCost: number;
}

interface HeroProps {
  onJoin?: () => void;
  onChallenge?: () => void;
  stats?: HeroStats;
  entries?: ImportedEntry[];
}

const EMPTY_HERO_STATS: HeroStats = {
  builderCount: 0,
  totalTokens: 0,
  totalCost: 0,
};

const PRODUCT_SHOT_BURN_ROWS = 5;

// The leaderboard table on this same page sorts by totalTokens desc by default
// (BurnIndexSection). Mirror that here so the ProductShot #1 row is always the
// same handle the leaderboard #1 row shows — otherwise the two widgets disagree.
function byTotalTokensDesc(a: ImportedEntry, b: ImportedEntry): number {
  return b.totalTokens - a.totalTokens;
}

function deltaKindFor(entry: ImportedEntry): "up" | "down" | "flat" | "new" {
  if (entry.trendDir === "up") return "up";
  if (entry.trendDir === "down") return "down";
  if (entry.trendDir === "flat") return "flat";
  return "new";
}

function deltaTextFor(entry: ImportedEntry): string {
  if (entry.trendDir == null || entry.trendPct == null) return "new";
  const sign = entry.trendPct > 0 ? "+" : "";
  return `${sign}${entry.trendPct}%`;
}

function ProductShot({ tab, entries }: { tab: HeroTab; entries: ImportedEntry[] }) {
  if (tab === "burn") {
    const top = [...entries].sort(byTotalTokensDesc).slice(0, PRODUCT_SHOT_BURN_ROWS);
    return (
      <div className="product-shot product-shot-burn">
        <div className="product-shot-header" data-testid="product-shot-header">
          <span className="product-shot-label">Burn Index · Live</span>
          <span className="product-shot-dot" />
        </div>
        <div className="product-shot-rows" data-testid="product-shot-content" data-mask="dynamic">
          {top.length === 0 ? (
            <div className="product-shot-empty" data-testid="product-shot-empty">
              Be the first to import. Join Burn Index to claim #1.
            </div>
          ) : (
            top.map((entry, idx) => {
              const rank = idx + 1;
              const kind = deltaKindFor(entry);
              return (
                <div key={entry.handle} className="product-shot-row">
                  <span className="product-shot-rank">#{rank}</span>
                  <span className={`product-shot-delta product-shot-delta-${kind}`}>
                    {deltaTextFor(entry)}
                  </span>
                  <span className="product-shot-handle">{entry.handle}</span>
                  <span className="product-shot-ves">{fmtTokensCompact(entry.totalTokens)}</span>
                  <span className="product-shot-cost">{fmtCostShort(entry.estimatedCostUsd)}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }
  if (tab === "challenge") {
    return (
      <div className="product-shot product-shot-challenge">
        <div className="product-shot-header" data-testid="product-shot-header">
          <span className="product-shot-label">Challenge · Active</span>
          <Badge kind="accent">$50 reward</Badge>
        </div>
        <div className="product-shot-body" data-testid="product-shot-content" data-mask="dynamic">
          <p className="product-shot-title">Fix a real Lighthouse regression</p>
          <p className="product-shot-meta">14 participants · 48h remaining</p>
          <div className="product-shot-code">
            <span className="code-comment"># VES = verified fixes / AI cost USD</span>
            <span className="code-line">score(fixes=847, cost=4.20) → <span className="code-accent">201.7</span></span>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="product-shot product-shot-drops">
      <div className="product-shot-header" data-testid="product-shot-header">
        <span className="product-shot-label">Workflow Drops</span>
      </div>
      <div className="product-shot-drop-list" data-testid="product-shot-content" data-mask="dynamic">
        {[
          { title: "Low-Cost Debugging", badge: "Free" },
          { title: "Claude Code Review Loop", badge: "$24" },
          { title: "Codex Repo Bootstrap Pack", badge: "soon" },
        ].map((d) => (
          <div key={d.title} className="product-shot-drop-row">
            <span className="product-shot-drop-title">{d.title}</span>
            <span className="product-shot-drop-badge">{d.badge}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HeroSecondaryCard({ stats = EMPTY_HERO_STATS }: { stats?: HeroStats }) {
  const builderValue =
    stats.builderCount === 0 ? "Be first" : `${stats.builderCount} builders`;

  return (
    <div className="hero-secondary-card" data-testid="hero-secondary-card" data-mask="dynamic">
      <div className="hero-secondary-header" data-testid="hero-secondary-header">
        <span className="hero-secondary-header-label">Community weekly total</span>
        <span className="hero-secondary-header-live">
          <span className="hero-secondary-header-dot" aria-hidden="true" />
          Live
        </span>
      </div>
      <div className="hero-secondary-row">
        <span className="hero-secondary-label">Builders</span>
        <span className="hero-secondary-value accent" data-testid="hero-stat-builders">
          {builderValue}
        </span>
      </div>
      <div className="hero-secondary-row">
        <span className="hero-secondary-label">Tokens collected</span>
        <span className="hero-secondary-value" data-testid="hero-stat-tokens">
          {fmtTokensCompact(stats.totalTokens)} tokens
        </span>
      </div>
      <div className="hero-secondary-row">
        <span className="hero-secondary-label">AI spend</span>
        <span className="hero-secondary-value" data-testid="hero-stat-spend">
          {fmtCostShort(stats.totalCost)} spent
        </span>
      </div>
      <div className="hero-secondary-footnote" data-testid="hero-secondary-footnote">
        Latest weekly upload per handle
      </div>
    </div>
  );
}

export function Hero({ onJoin, onChallenge, stats, entries }: HeroProps) {
  const [tab, setTab] = useState<HeroTab>("burn");
  const activeTab: HeroTab = SHOW_LEGACY ? tab : "burn";
  const burnEntries = entries ?? [];

  return (
    <section className="hero-v3" id="hero" data-testid="hero-section">
      <div className="hero-inner">
        <div className="hero-left">
          <div className="hero-eyebrow" data-testid="hero-eyebrow">
            <span className="eyebrow-dot" />
            Burn Index · public leaderboard
          </div>
          <h1 className="hero-headline" data-testid="hero-headline">
            Burn Index puts a number on your{" "}
            <span className="hero-accent">drag</span>.
          </h1>
          <p className="hero-sub" data-testid="hero-sub">
            {SHOW_LEGACY
              ? "Track your AI coding burn, compete in verified cost-per-fix challenges, and learn the workflows behind top builders."
              : "Get your burn score. See where you rank against verified solo devs."}
          </p>
          <div className="hero-chips" data-testid="hero-chips">
            <span className="hero-chip">Claude Code</span>
            <span className="hero-chip">Codex</span>
          </div>
          <div className="hero-actions" data-testid="hero-cta-group">
            <Button variant="primary" size="xl" onClick={onJoin} data-testid="hero-cta-primary">
              Join Burn Index
            </Button>
            {SHOW_LEGACY && (
              <Button variant="secondary" size="lg" onClick={onChallenge}>
                Get Challenge Invite
              </Button>
            )}
          </div>
          <HeroSecondaryCard stats={stats} />
        </div>

        <div className="hero-right" data-testid="hero-right">
          {SHOW_LEGACY && (
            <div className="hero-tabs">
              {(["burn", "challenge", "drops"] as HeroTab[]).map((t) => (
                <button
                  key={t}
                  className={`hero-tab${tab === t ? " hero-tab-active" : ""}`}
                  onClick={() => setTab(t)}
                >
                  {t === "burn" ? "Burn Index" : t === "challenge" ? "Challenges" : "Workflow Drops"}
                </button>
              ))}
            </div>
          )}
          <ProductShot tab={activeTab} entries={burnEntries} />
        </div>
      </div>
    </section>
  );
}
