"use client";

import { utcIsoToKstDay } from "@/lib/data";

interface WeekRangePillProps {
  range: { since: string; until: string } | null;
  variant: "hero" | "section";
  className?: string;
}

const MONTHS = [
  "JAN","FEB","MAR","APR","MAY","JUN",
  "JUL","AUG","SEP","OCT","NOV","DEC",
];

// "2026-05-18T…Z" → "MAY 18 – 25 · 2026" (same-month) or "MAY 28 – JUN 3 · 2026" (cross-month)
function formatHero(since: string, until: string): string {
  const [sy, sm, sd] = since.slice(0, 10).split("-");
  const [uy, um, ud] = until.slice(0, 10).split("-");
  const sMonth = MONTHS[parseInt(sm, 10) - 1];
  const uDay = parseInt(ud, 10);
  if (sm === um && sy === uy) {
    return `${sMonth} ${parseInt(sd, 10)} – ${uDay} · ${sy}`;
  }
  const uMonth = MONTHS[parseInt(um, 10) - 1];
  return `${sMonth} ${parseInt(sd, 10)} – ${uMonth} ${uDay} · ${sy}`;
}

// "2026-05-18T…Z" → "2026-05-18 → 05-25"
function formatSection(since: string, until: string): string {
  const sinceDay = since.slice(0, 10);
  const untilDay = until.slice(0, 10);
  return `${sinceDay} → ${untilDay.slice(5)}`;
}

export function WeekRangePill({ range, variant, className }: WeekRangePillProps) {
  if (!range) return null;
  const { since, until } = range;
  const label = variant === "hero" ? formatHero(since, until) : formatSection(since, until);
  const tooltip = `KST: ${utcIsoToKstDay(since)} ~ ${utcIsoToKstDay(until)}`;
  const cls = ["week-range-pill", `week-range-pill-${variant}`, className].filter(Boolean).join(" ");

  return (
    <span className={cls} title={tooltip}>
      <span className="week-range-label" aria-hidden="true">Week of ·</span>
      <time dateTime={since.slice(0, 10)}>{label}</time>
    </span>
  );
}
