"use client";

import { Icon } from "@/components/primitives";
import { topVesEntry, fmtVes, type ImportedEntry } from "@/lib/data";

interface StatusBarProps {
  entries?: ImportedEntry[];
}

// Always-on top strip. Surfaces ONLY the live Top VES — the one headline metric
// not already shown in the Hero stat bar (which covers weekly builders/tokens/
// spend), so the two no longer duplicate fabricated counts. Top VES is the MAX
// over `entries` (newest-first ordering means entries[0] is NOT the leader).
export function StatusBar({ entries = [] }: StatusBarProps) {
  const top = topVesEntry(entries);
  return (
    <div className="status-bar" data-testid="status-bar">
      <div className="status-bar-inner">
        <span className="status-dot" />
        <span className="status-text">Live · weekly verified leaderboard</span>
        <span className="status-divider" />
        <span className="status-item">
          <Icon name="bolt" size={12} />
          {top
            ? `Top VES: ${fmtVes(top.ves)} (${top.handle})`
            : "Top VES: — · be first"}
        </span>
      </div>
    </div>
  );
}
