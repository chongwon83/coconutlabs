"use client";

import { V3_TRUST } from "@/lib/data";
import { Icon } from "@/components/primitives";

type TrustIcon = "shield" | "lock" | "eye" | "code";

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="section-eyebrow">{children}</div>;
}

export function TrustSection() {
  return (
    <section className="section" id="safety">
      <div className="section-inner">
        <Eyebrow>Trust & Safety</Eyebrow>
        <h2 className="section-title">
          Built for builders who own their data.
        </h2>
        <p className="section-sub">
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
                <h3 className="trust-title">{item.title}</h3>
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
    </section>
  );
}
