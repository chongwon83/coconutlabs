"use client";

import { useState } from "react";
import { Button, Badge } from "@/components/primitives";
import { fmtCostShort, fmtTokensCompact } from "@/lib/data";

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
}

const EMPTY_HERO_STATS: HeroStats = {
  builderCount: 0,
  totalTokens: 0,
  totalCost: 0,
};

function ProductShot({ tab }: { tab: HeroTab }) {
  if (tab === "burn") {
    return (
      <div className="product-shot product-shot-burn">
        <div className="product-shot-header" data-testid="product-shot-header">
          <span className="product-shot-label">Burn Index · Live</span>
          <span className="product-shot-dot" />
        </div>
        <div className="product-shot-rows" data-testid="product-shot-content" data-mask="dynamic">
          {[
            { rank: 1, handle: "@shellcoder", ves: "201.7", cost: "$4.20", delta: "↑1", deltaKind: "up" },
            { rank: 2, handle: "@tinyshipper", ves: "197.8", cost: "$3.60", delta: "↓1", deltaKind: "down" },
            { rank: 3, handle: "@noor", ves: "195.5", cost: "$2.20", delta: "—", deltaKind: "flat" },
            { rank: 4, handle: "@nightowl", ves: "192.1", cost: "$3.80", delta: "↑2", deltaKind: "up" },
            { rank: 5, handle: "@dgreen", ves: "189.4", cost: "$2.90", delta: "new", deltaKind: "new" },
          ].map((r) => (
            <div key={r.rank} className="product-shot-row">
              <span className="product-shot-rank">#{r.rank}</span>
              <span className={`product-shot-delta product-shot-delta-${r.deltaKind}`}>{r.delta}</span>
              <span className="product-shot-handle">{r.handle}</span>
              <span className="product-shot-ves">{r.ves}</span>
              <span className="product-shot-cost">{r.cost}</span>
            </div>
          ))}
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
    </div>
  );
}

export function Hero({ onJoin, onChallenge, stats }: HeroProps) {
  const [tab, setTab] = useState<HeroTab>("burn");
  const activeTab: HeroTab = SHOW_LEGACY ? tab : "burn";

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
            <span className="hero-chip">Cursor</span>
            <span className="hero-chip">+ more</span>
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
          <ProductShot tab={activeTab} />
        </div>
      </div>
    </section>
  );
}
