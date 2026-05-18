"use client";

import { sparkFor } from "@/lib/data";

interface SparklineProps {
  handle: string;
  width?: number;
  height?: number;
  color?: string;
}

export function Sparkline({
  handle,
  width = 64,
  height = 24,
  color = "var(--young-coconut)",
}: SparklineProps) {
  const pts = sparkFor(handle);
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
