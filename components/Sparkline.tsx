"use client";

import { sparkFor } from "@/lib/data";

interface SparklineProps {
  handle: string;
  // Real per-snapshot series (oldest → newest) from the 7d trend join. When
  // absent or too short to draw a line, fall back to the deterministic
  // handle-seeded shape so the cell is never empty.
  series?: number[];
  width?: number;
  height?: number;
  color?: string;
}

export function Sparkline({
  handle,
  series,
  width = 64,
  height = 24,
  color = "var(--young-coconut)",
}: SparklineProps) {
  const pts = series != null && series.length >= 2 ? series : sparkFor(handle);
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = max - min || 1;

  const points = pts.map((v, i) => {
    const x = (i / (pts.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="sparkline"
      aria-hidden="true"
    >
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
