---
name: "CoconutLabs Burn Index — Verification Tiers"
colors:
  primary: "#00D084"
  secondary: "#008C5A"
  tertiary: "#B45309"
  neutral: "#525252"
  surface: "#FFFFFF"
  surface-muted: "#FAFAFA"
  on-surface: "#0A0A0A"
  error: "#DC2626"
typography:
  tier-label:
    fontFamily: "JetBrains Mono"
    fontSize: "11px"
    fontWeight: "600"
    letterSpacing: "0.08em"
  tier-caption:
    fontFamily: "Inter"
    fontSize: "12px"
    fontWeight: "400"
    lineHeight: "1.5"
  row-body:
    fontFamily: "Inter"
    fontSize: "14px"
    fontWeight: "400"
rounded:
  sm: "4px"
  md: "8px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  tier-header:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    padding: "{spacing.sm}"
    rounded: "{rounded.sm}"
  tier-caption:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.neutral}"
    padding: "{spacing.sm}"
  tier-count:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.neutral}"
    padding: "{spacing.sm}"
    rounded: "{rounded.sm}"
---

## Overview

The Burn Index leaderboard ranks builders by verified efficiency. This design
adds a **three-tier trust hierarchy** to the existing leaderboard so a reader
can tell, at a glance, how much to trust each row's numbers. Tiers re-order and
visually group rows that already exist — no new data, no row loss. The tiers,
top to bottom, are **Verified**, **Estimated**, and **Self-reported**, which
mirrors descending confidence in the underlying measurement.

## Colors

`primary` (`#00D084`, young coconut) marks the verified tier — the same accent
the product already uses for trusted signals. `secondary` (`#008C5A`) is its
darker form for small text and rules. `tertiary` (`#B45309`, warm amber) marks
the estimated tier — present but unconfirmed. `neutral` (`#525252`) carries the
self-reported tier and all caption text; it stays muted so unverified rows
recede. `on-surface` (`#0A0A0A`) is the primary text color on the white
`surface`. `error` (`#DC2626`) is reserved for validation states and is not
used by the tier system.

## Typography

`tier-label` is uppercase mono — it reads as a system label, not prose, so the
tier dividers feel like structure rather than content. `tier-caption` is the
Inter body face at a small size; it explains, in one sentence, what the tier
means. `row-body` is unchanged from the existing leaderboard rows.

## Layout

Each tier renders as a section header (`tier-header`) followed by its rows.
Header layout: tier label on the left, a row count on the right, and a one-line
caption directly beneath. A tier with zero rows after filtering renders nothing
— no empty header. Spacing between a header and its first row is `spacing.sm`;
spacing between the last row of one tier and the next header is `spacing.lg`.

## Elevation & Depth

The leaderboard stays flat — no shadows. Depth between tiers is communicated by
a 1px divider above each tier header and by the descending color temperature
(coconut green → amber → neutral grey). Verified rows keep the existing 2px
accent bar on their left edge; estimated and self-reported rows do not.

## Shapes

Tier headers and count chips use `rounded.sm` (4px). The leaderboard card
itself keeps `rounded.md` (8px). No other new shapes are introduced.

## Components

- **tier-header** — the section divider for one tier. Holds the label and count.
- **tier-caption** — the one-line explanation under a tier header.
- **tier-count** — a small muted chip showing how many rows are in the tier.

## Do's and Don'ts

- Do keep tier order fixed: Verified, Estimated, Self-reported.
- Do hide a tier header entirely when its filtered row count is zero.
- Don't introduce a new badge — row-level trust still uses the existing
  `VerifBadge`. Tiers group; badges label.
- Don't let tier styling override the active-filter or top-rank row states.
- Don't change row data or sort order within a tier — rows stay VES-ranked.
