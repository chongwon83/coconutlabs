"use client";

import React from "react";

// ── Icon ──────────────────────────────────────────────────────────────────────

const PATHS: Record<string, React.ReactNode> = {
  check: <polyline points="20 6 9 17 4 12" />,
  shield: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </>
  ),
  lock: (
    <>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  eye: (
    <>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  code: (
    <>
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </>
  ),
  bolt: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
  "trend-up": (
    <>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </>
  ),
  "trend-down": (
    <>
      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
      <polyline points="17 18 23 18 23 12" />
    </>
  ),
  plus: (
    <>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </>
  ),
  "arrow-right": (
    <>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </>
  ),
  "chevron-right": <polyline points="9 18 15 12 9 6" />,
  search: (
    <>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </>
  ),
  cpu: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <line x1="9" y1="1" x2="9" y2="4" />
      <line x1="15" y1="1" x2="15" y2="4" />
      <line x1="9" y1="20" x2="9" y2="23" />
      <line x1="15" y1="20" x2="15" y2="23" />
      <line x1="20" y1="9" x2="23" y2="9" />
      <line x1="20" y1="14" x2="23" y2="14" />
      <line x1="1" y1="9" x2="4" y2="9" />
      <line x1="1" y1="14" x2="4" y2="14" />
    </>
  ),
  flask: (
    <>
      <path d="M14.5 2v9.5l4 7A2 2 0 0 1 16.74 21H7.26a2 2 0 0 1-1.76-2.5l4-7V2" />
      <line x1="8.5" y1="2" x2="15.5" y2="2" />
    </>
  ),
  file: (
    <>
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <polyline points="13 2 13 9 20 9" />
    </>
  ),
  spark: (
    <>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </>
  ),
  "external-link": (
    <>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </>
  ),
  terminal: (
    <>
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </>
  ),
};

interface IconProps {
  name: keyof typeof PATHS;
  size?: number;
  className?: string;
}

export function Icon({ name, size = 16, className = "" }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {PATHS[name]}
    </svg>
  );
}

// ── Button ────────────────────────────────────────────────────────────────────

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "link";
  size?: "xl" | "lg" | "sm";
  children: React.ReactNode;
}

export function Button({
  variant = "primary",
  size = "sm",
  children,
  className = "",
  ...props
}: ButtonProps) {
  const base = "btn";
  const v = variant === "primary" ? "btn-primary"
    : variant === "secondary" ? "btn-secondary"
    : variant === "ghost" ? "btn-ghost"
    : "btn-link";
  const s = size === "xl" ? "btn-xl" : size === "lg" ? "btn-lg" : "";
  return (
    <button className={`${base} ${v} ${s} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────

export type BadgeKind =
  | "provider"
  | "device"
  | "estimated"
  | "selfrep"
  | "verified"
  | "executable"
  | "readonly"
  | "config"
  | "accent";

interface BadgeProps {
  kind?: BadgeKind;
  children: React.ReactNode;
  className?: string;
}

export function Badge({ kind = "accent", children, className = "" }: BadgeProps) {
  const cls = kind === "provider" ? "badge-provider"
    : kind === "device" ? "badge-device"
    : kind === "estimated" ? "badge-estimated"
    : kind === "selfrep" ? "badge-selfrep"
    : kind === "verified" ? "badge-verified"
    : kind === "executable" ? "badge-executable"
    : kind === "readonly" ? "badge-readonly"
    : kind === "config" ? "badge-config"
    : "badge-accent";
  return (
    <span className={`badge ${cls} ${className}`.trim()}>{children}</span>
  );
}

// ── VerifBadge ────────────────────────────────────────────────────────────────

import { verifDisplayLabel, type VerifLevel } from "@/lib/data";

interface VerifBadgeProps {
  level: VerifLevel;
}

export function VerifBadge({ level }: VerifBadgeProps) {
  // CSS kind tracks the wire-format level (preserves Track 4 visual baseline);
  // the rendered label routes through verifDisplayLabel so domain-neutral
  // copy can never appear in the UI.
  const kind: BadgeKind =
    level === "Provider-synced" ? "provider"
    : level === "Device-synced" ? "device"
    : level === "Estimated" ? "estimated"
    : "selfrep";
  return <Badge kind={kind}>{verifDisplayLabel(level)}</Badge>;
}

// ── Avatar ────────────────────────────────────────────────────────────────────

interface AvatarProps {
  initials: string;
  size?: "sm" | "md";
}

export function Avatar({ initials, size = "md" }: AvatarProps) {
  return (
    <div className={`avatar${size === "sm" ? " avatar-sm" : ""}`}>
      {initials}
    </div>
  );
}

// ── Trend ─────────────────────────────────────────────────────────────────────

interface TrendProps {
  dir: "up" | "down" | "flat";
  value: string;
}

export function Trend({ dir, value }: TrendProps) {
  const cls = dir === "up" ? "trend trend-up" : dir === "down" ? "trend trend-down" : "trend";
  const icon = dir === "up" ? "trend-up" : dir === "down" ? "trend-down" : "chevron-right";
  return (
    <span className={cls}>
      <Icon name={icon} size={12} />
      {value}
    </span>
  );
}
