"use client";

import { useEffect, useRef, useState } from "react";
import { fmtTokensCompact, fmtCostShort } from "@/lib/data";

const SHOW_LEGACY = process.env.NEXT_PUBLIC_SHOW_LEGACY_SECTIONS === "true";

const TICKER_ITEMS_FULL = [
  "🏆 @shellcoder · VES 201.7 · API-verified",
  "⚡ @tinyshipper · $3.60 / 712 fixes · CLI-verified",
  "🔥 Challenge live: Fix a Lighthouse regression — $50 reward",
  "📦 New drop: Claude Code Review Loop by @tinyshipper",
  "✅ @noor · VES 195.5 · +2% this week",
  "💡 Workflow drop: Low-Cost Debugging — Free",
  "🏆 @4ndres · 378 fixes · API-verified",
  "⚡ Week total: 2.4B tokens · $4,820 AI spend · 3,391 fixes",
];

type TickerSize = "default" | "compact";

interface TickerProps {
  size?: TickerSize;
}

interface LiveEntry {
  handle: string;
  totalTokens: number;
  estimatedCostUsd: number;
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
          top.map(
            (e) =>
              `🏆 ${e.handle} · ${fmtTokensCompact(e.totalTokens)} tok · ${fmtCostShort(e.estimatedCostUsd)}`,
          ),
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
