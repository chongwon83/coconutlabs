"use client";

import { Button } from "@/components/primitives";

interface FinalCTAProps {
  onJoin?: () => void;
  onChallenge?: () => void;
}

export function FinalCTA({ onJoin, onChallenge }: FinalCTAProps) {
  return (
    <section className="section final-cta" id="cta">
      <div className="section-inner final-cta-inner">
        <h2 className="final-cta-headline">
          Start shipping smarter today.
        </h2>
        <p className="final-cta-sub">
          Join 1,247 builders already tracking their AI coding efficiency.
          Free to join. No credit card.
        </p>
        <div className="final-cta-actions">
          <Button variant="primary" size="lg" onClick={onJoin}>
            Join Burn Index
          </Button>
          <Button variant="secondary" size="lg" onClick={onChallenge}>
            Get Challenge Invite
          </Button>
        </div>
        <p className="final-cta-note">
          Invite-only beta · Claude Code, Codex, Cursor supported
        </p>
      </div>
    </section>
  );
}
