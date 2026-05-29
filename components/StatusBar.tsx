"use client";

import { Icon } from "@/components/primitives";
import {
  topNonzeroVesEntry,
  hasEnoughVes,
  fmtVes,
  type ImportedEntry,
} from "@/lib/data";

interface StatusBarProps {
  entries?: ImportedEntry[];
}

// Always-on top strip. Surfaces Top VES ONLY once the metric has real data
// (hasEnoughVes) and a nonzero leader exists — otherwise it would read
// "Top VES: 0.0", headlining an empty metric on a "trust the data" product.
// Until then it shows a neutral, honest count. Top VES is the MAX over a
// NONZERO-VES subset (newest-first ordering means entries[0] is NOT the leader).
export function StatusBar({ entries = [] }: StatusBarProps) {
  const top = hasEnoughVes(entries) ? topNonzeroVesEntry(entries) : null;
  const headline = top
    ? `Top VES: ${fmtVes(top.ves)} (${top.handle})`
    : entries.length > 0
      ? `${entries.length} builder${entries.length === 1 ? "" : "s"} ranked`
      : "Be first on the board";
  return (
    <div className="status-bar" data-testid="status-bar">
      <div className="status-bar-inner">
        <span className="status-dot" />
        <span className="status-text">Live · weekly verified leaderboard</span>
        <span className="status-divider" />
        <span className="status-item">
          <Icon name="bolt" size={12} />
          {headline}
        </span>
      </div>
    </div>
  );
}
