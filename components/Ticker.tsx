"use client";

const TICKER_ITEMS = [
  "🏆 @shellcoder · VES 201.7 · Provider-synced",
  "⚡ @tinyshipper · $3.60 / 712 fixes · Device-synced",
  "🔥 Challenge live: Fix a Lighthouse regression — $50 reward",
  "📦 New drop: Claude Code Review Loop by @tinyshipper",
  "✅ @noor · VES 195.5 · +2% this week",
  "💡 Workflow drop: Low-Cost Debugging — Free",
  "🏆 @4ndres · 378 fixes · Provider-synced",
  "⚡ Week total: 2.4B tokens · $4,820 AI spend · 3,391 fixes",
];

export function Ticker() {
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS];
  return (
    <div className="ticker">
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
