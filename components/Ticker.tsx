"use client";

import { useEffect, useRef, useState } from "react";
import {
  fmtTokensCompact,
  fmtCostShort,
  fmtVes,
  computeVes,
  verifDisplayLabel,
  V3_BUILDERS,
} from "@/lib/data";

const SHOW_LEGACY = process.env.NEXT_PUBLIC_SHOW_LEGACY_SECTIONS === "true";

// Demo marquee (SHOW_LEGACY only — prod-hidden). Builder lines and the
// week-total are DERIVED from the V3_BUILDERS seed so they share the live VES
// path (computeVes/fmtVes) and stay internally consistent with the builder
// cards; only the challenge/drop promo copy is static illustrative text. No
// hand-typed VES or aggregate literal lives here anymore.
function buildLegacyTickerItems(): string[] {
  const line = (b: (typeof V3_BUILDERS)[number]) => {
    const ves = computeVes(b.fixes, b.costUsd);
    const vesPart = ves == null ? "" : ` · VES ${fmtVes(ves)}`;
    return `🏆 ${b.handle}${vesPart} · ${verifDisplayLabel(b.verif)}`;
  };
  const totalTokens = V3_BUILDERS.reduce((s, b) => s + b.tokens, 0);
  const totalCost = V3_BUILDERS.reduce((s, b) => s + b.costUsd, 0);
  const totalFixes = V3_BUILDERS.reduce((s, b) => s + b.fixes, 0);
  const weekTotal = `⚡ Week total: ${fmtTokensCompact(totalTokens)} tokens · ${fmtCostShort(totalCost)} AI spend · ${totalFixes.toLocaleString()} fixes`;
  return [
    line(V3_BUILDERS[0]),
    "🔥 Challenge live: Fix a Lighthouse regression — $50 reward",
    line(V3_BUILDERS[1]),
    "📦 New drop: Claude Code Review Loop by @tinyshipper",
    line(V3_BUILDERS[3]),
    "💡 Workflow drop: Low-Cost Debugging — Free",
    line(V3_BUILDERS[4]),
    weekTotal,
  ];
}

const TICKER_ITEMS_FULL = buildLegacyTickerItems();

type TickerSize = "default" | "compact";

interface TickerProps {
  size?: TickerSize;
}

interface LiveEntry {
  handle: string;
  totalTokens: number;
  estimatedCostUsd: number;
  // Read-time derived by the /api/burnindex GET (only when fixes present).
  ves?: number;
}

export function Ticker({ size = "default" }: TickerProps) {
  const [liveItems, setLiveItems] = useState<string[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (SHOW_LEGACY) return;

    async function fetchFeed() {
      try {
        const res = await fetch("/api/burnindex");
        if (!res.ok) return;
        const data = await res.json();
        const entries: LiveEntry[] = data.entries ?? [];
        const top = entries.slice(0, 5);
        if (top.length === 0) return;
        setLiveItems(
          top.map((e) => {
            // VES is the headline metric — show it when derived; otherwise
            // fall back to the raw token count so the item still renders.
            const tail =
              e.ves != null
                ? `VES ${fmtVes(e.ves)}`
                : `${fmtTokensCompact(e.totalTokens)} tok`;
            return `🏆 ${e.handle} · ${tail} · ${fmtCostShort(e.estimatedCostUsd)}`;
          }),
        );
      } catch {
        // silently ignore — stale items stay if already set
      }
    }

    fetchFeed();
    intervalRef.current = setInterval(fetchFeed, 60_000);
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    };
  }, []);

  if (SHOW_LEGACY) {
    const source = TICKER_ITEMS_FULL;
    const items = [...source, ...source];
    const className = size === "compact" ? "ticker ticker-compact" : "ticker";
    return (
      <div className={className}>
        <div className="ticker-track">
          {items.map((item, i) => (
            <span key={i} className="ticker-item">
              {item}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (liveItems.length === 0) return null;

  const items = [...liveItems, ...liveItems];
  const className = size === "compact" ? "ticker ticker-compact" : "ticker";
  return (
    <div className={className}>
      <div className="ticker-track">
        {items.map((item, i) => (
          <span key={i} className="ticker-item">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
