"use client";

const SHOW_LEGACY = process.env.NEXT_PUBLIC_SHOW_LEGACY_SECTIONS === "true";

const TICKER_ITEMS_FULL = [
  "🏆 @shellcoder · VES 201.7 · Provider-synced",
  "⚡ @tinyshipper · $3.60 / 712 fixes · Device-synced",
  "🔥 Challenge live: Fix a Lighthouse regression — $50 reward",
  "📦 New drop: Claude Code Review Loop by @tinyshipper",
  "✅ @noor · VES 195.5 · +2% this week",
  "💡 Workflow drop: Low-Cost Debugging — Free",
  "🏆 @4ndres · 378 fixes · Provider-synced",
  "⚡ Week total: 2.4B tokens · $4,820 AI spend · 3,391 fixes",
];

// Burn-only mode: VES leaderboard signals only (challenges/drops excluded).
const TICKER_ITEMS_BURN = [
  "🏆 @shellcoder · VES 201.7 · Provider-synced",
  "⚡ @tinyshipper · $3.60 / 712 fixes · Device-synced",
  "✅ @noor · VES 195.5 · +2% this week",
  "🏆 @4ndres · 378 fixes · Provider-synced",
  "⚡ Week total: 2.4B tokens · $4,820 AI spend · 3,391 fixes",
];

type TickerSize = "default" | "compact";

interface TickerProps {
  size?: TickerSize;
}

export function Ticker({ size = "default" }: TickerProps) {
  const source = SHOW_LEGACY ? TICKER_ITEMS_FULL : TICKER_ITEMS_BURN;
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
