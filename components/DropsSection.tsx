"use client";

import { V3_DROPS } from "@/lib/data";
import { Badge, Icon, Button } from "@/components/primitives";
import type { BadgeKind } from "@/components/primitives";

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="section-eyebrow">{children}</div>;
}

function dropKindBadge(kind: "readonly" | "config" | "executable"): BadgeKind {
  if (kind === "readonly") return "readonly";
  if (kind === "config") return "config";
  return "executable";
}

function dropIcon(kind: "readonly" | "config" | "executable") {
  if (kind === "readonly") return "file";
  if (kind === "config") return "terminal";
  return "flask";
}

export function DropsSection() {
  return (
    <section className="section" id="drops">
      <div className="section-inner">
        <Eyebrow>Workflow Drops</Eyebrow>
        <h2 className="section-title">
          Proven workflows from top builders.
        </h2>
        <p className="section-sub">
          Read-only guides, config packs, and executable bootstraps — all
          verified by VES score. No black-box prompts.
        </p>

        <div className="drops-grid">
          {V3_DROPS.map((d) => (
            <div key={d.id} className="drop-card">
              <div className="drop-card-header">
                <div className="drop-icon-wrap">
                  <Icon name={dropIcon(d.kind)} size={20} />
                </div>
                <div className="drop-badges">
                  <Badge kind={dropKindBadge(d.kind)}>{d.kind}</Badge>
                  <span className="drop-status">{d.status}</span>
                </div>
              </div>
              <h3 className="drop-title">{d.title}</h3>
              <p className="drop-desc">{d.description}</p>
              <div className="drop-card-footer">
                <span className="drop-author">{d.author}</span>
                {d.status === "soon" ? (
                  <span className="drop-soon-label">Coming soon</span>
                ) : (
                  <Button variant="ghost" size="sm">
                    {d.status === "Free" ? "Get free" : `Get for ${d.status}`}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
