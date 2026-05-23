"use client";

import { V3_NAV } from "@/lib/data";
import { Button } from "@/components/primitives";

interface NavProps {
  onJoin?: () => void;
}

export function Nav({ onJoin }: NavProps) {
  return (
    <nav className="nav-v3">
      <div className="nav-inner">
        <a href="#hero" className="nav-logo">
          CoconutLabs
        </a>
        <span className="nav-tagline">Measure the burn. Own the ship.</span>
        <div className="nav-links">
          {V3_NAV.map((link) => (
            <a key={link.href} href={link.href} className="nav-link">
              {link.label}
            </a>
          ))}
        </div>
        <div className="nav-actions">
          <Button variant="ghost" size="sm" onClick={onJoin}>
            Join Burn Index
          </Button>
        </div>
      </div>
    </nav>
  );
}
