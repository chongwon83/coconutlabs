"use client";

import { Button } from "@/components/primitives";

interface NavProps {
  onJoin?: () => void;
}

export function Nav({ onJoin }: NavProps) {
  return (
    <nav className="nav-v3" data-testid="nav-root">
      <div className="nav-inner" data-testid="nav-inner">
        <a href="#hero" className="nav-logo" data-testid="nav-logo">
          CoconutLabs
        </a>
        <div className="nav-actions" data-testid="nav-cta">
          <Button variant="ghost" size="sm" onClick={onJoin} data-testid="nav-cta-primary">
            Join Burn Index
          </Button>
        </div>
      </div>
    </nav>
  );
}
