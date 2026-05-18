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
        <a href="#" className="nav-logo">
          CoconutLabs
        </a>
        <div className="nav-links">
          {V3_NAV.map((link) => (
            <a key={link.href} href={link.href} className="nav-link">
              {link.label}
            </a>
          ))}
        </div>
        <div className="nav-actions">
          <Button variant="ghost" size="sm" onClick={onJoin}>
            Join waitlist
          </Button>
          <Button variant="primary" size="sm" onClick={onJoin}>
            Get early access
          </Button>
        </div>
      </div>
    </nav>
  );
}
