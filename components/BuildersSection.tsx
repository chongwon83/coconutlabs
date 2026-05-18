"use client";

import { V3_BUILDERS } from "@/lib/data";
import { Avatar, VerifBadge, Trend, Icon } from "@/components/primitives";
import { Sparkline } from "@/components/Sparkline";

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="section-eyebrow">{children}</div>;
}

function ActivityFeed() {
  const events = [
    { handle: "@shellcoder", action: "fixed 12 bugs", cost: "$0.48", ago: "2m ago" },
    { handle: "@tinyshipper", action: "completed challenge", cost: "$1.20", ago: "14m ago" },
    { handle: "@noor", action: "fixed 8 bugs", cost: "$0.32", ago: "31m ago" },
    { handle: "@4ndres", action: "new workflow drop", cost: "—", ago: "1h ago" },
    { handle: "@coconutfix", action: "fixed 24 bugs", cost: "$2.16", ago: "2h ago" },
  ];

  return (
    <div className="activity-feed">
      <div className="activity-feed-header">
        <span className="activity-feed-title">Live activity</span>
        <span className="activity-dot" />
      </div>
      {events.map((e, i) => (
        <div key={i} className="activity-row">
          <span className="activity-handle">{e.handle}</span>
          <span className="activity-action">{e.action}</span>
          <span className="activity-cost">{e.cost}</span>
          <span className="activity-ago">{e.ago}</span>
        </div>
      ))}
    </div>
  );
}

export function BuildersSection() {
  return (
    <section className="section" id="builders">
      <div className="section-inner">
        <Eyebrow>Builder Cards</Eyebrow>
        <h2 className="section-title">
          The builders setting the pace.
        </h2>
        <p className="section-sub">
          Each card shows verified efficiency over the last 7 days.
          Badges reflect how usage data was collected.
        </p>

        <div className="builders-layout">
          <div className="builder-cards">
            {V3_BUILDERS.map((b) => (
              <div key={b.handle} className="builder-card">
                <div className="builder-card-top">
                  <Avatar initials={b.avatar} />
                  <div className="builder-card-meta">
                    <span className="builder-handle">{b.handle}</span>
                    <VerifBadge level={b.verif} />
                  </div>
                  <Sparkline handle={b.handle} width={56} height={20} />
                </div>
                <div className="builder-card-stats">
                  <div className="builder-stat">
                    <span className="builder-stat-val">{b.ves}</span>
                    <span className="builder-stat-lbl">VES</span>
                  </div>
                  <div className="builder-stat">
                    <span className="builder-stat-val">{b.fixes}</span>
                    <span className="builder-stat-lbl">fixes</span>
                  </div>
                  <div className="builder-stat">
                    <span className="builder-stat-val">{b.cost}</span>
                    <span className="builder-stat-lbl">spent</span>
                  </div>
                </div>
                <div className="builder-card-footer">
                  <Trend dir={b.trend} value={b.trendVal} />
                  <span className="builder-rank">#{b.rank} this week</span>
                </div>
              </div>
            ))}
          </div>

          <ActivityFeed />
        </div>
      </div>
    </section>
  );
}
