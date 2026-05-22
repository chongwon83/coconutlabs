---
name: "CoconutLabs Landing — MVP-4 + Burn Index Verification Tiers"
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
  hero-heading:
    fontFamily: "Inter"
    fontSize: "84px"
    fontWeight: "700"
    lineHeight: "1.05"
    letterSpacing: "-0.02em"
  section-heading:
    fontFamily: "Inter"
    fontSize: "48px"
    fontWeight: "700"
    lineHeight: "1.15"
    letterSpacing: "-0.01em"
  hero-subhead:
    fontFamily: "Inter"
    fontSize: "18px"
    fontWeight: "400"
    lineHeight: "1.5"
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
  xl: "80px"
  2xl: "120px"
components:
  sticky-header:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    padding: "{spacing.md}"
    rounded: "{rounded.sm}"
  hero-cta:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-surface}"
    padding: "{spacing.md}"
    rounded: "{rounded.md}"
  trust-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    padding: "{spacing.lg}"
    rounded: "{rounded.md}"
  alt-bg-section:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.on-surface}"
    padding: "{spacing.xl}"
    rounded: "{rounded.sm}"
  error-text:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.error}"
    padding: "{spacing.sm}"
    rounded: "{rounded.sm}"
  tier-header:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    padding: "{spacing.sm}"
    rounded: "{rounded.sm}"
  tier-caption-row:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.neutral}"
    padding: "{spacing.sm}"
  tier-count-amber:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.tertiary}"
    padding: "{spacing.sm}"
    rounded: "{rounded.sm}"
  tier-verified-accent:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.on-surface}"
    padding: "{spacing.sm}"
    rounded: "{rounded.sm}"
---

## Overview

CoconutLabs is the verified efficiency leaderboard for solo developers shipping
with LLM tokens. The landing page distills the product into **four vertical
sections** — Sticky Header, Hero, Burn Index, Trust + Final CTA — so a first-
time visitor can read what the product is, see the proof, and join the waitlist
without scrolling past content they don't need yet.

The Burn Index section within this landing retains a **three-tier trust
hierarchy** (Verified, Estimated, Self-reported) that groups leaderboard rows
by measurement confidence. Tiers re-order existing rows; they do not change
data, do not lose rows, and do not introduce a new badge.

## Colors

`primary` (`#00D084`, young coconut) is the brand accent — it marks the
verified tier in the Burn Index and powers the hero CTA. `secondary`
(`#008C5A`) is its darker form, used for small verified text, the Trust card
accent, and rules where `primary` would fail WCAG AA on white at small sizes.
`tertiary` (`#B45309`, warm amber) marks the estimated tier — present but
unconfirmed. `neutral` (`#525252`) carries the self-reported tier and all
caption text; it stays muted so unverified rows recede. `on-surface`
(`#0A0A0A`) is the primary text color on the white `surface`. `surface-muted`
(`#FAFAFA`) is the alternate-background tone used to separate the Burn Index
section from the white Hero and Trust sections without a hard rule. `error`
(`#DC2626`) is reserved for form validation states only.

**WCAG AA contrast (text/background pairs)**:

- `on-surface` (`#0A0A0A`) on `surface` (`#FFFFFF`) — 19.3:1 ✅
- `on-surface` (`#0A0A0A`) on `surface-muted` (`#FAFAFA`) — 18.5:1 ✅
- `secondary` (`#008C5A`) on `surface` (`#FFFFFF`) — 4.29:1 ⚠️ (large text
  only — ≥18px regular or ≥14px bold, where WCAG AA threshold is 3.0:1.
  Below that size, use `on-surface` for body and reserve `secondary` for
  decorative accents such as the trust-card rule or icon strokes.)
- `primary` (`#00D084`) on `surface` (`#FFFFFF`) — 1.9:1 ⚠️ (decorative only —
  large headings ≥24px bold or non-text UI elements such as the hero-cta fill,
  where the `on-surface` text on top carries the legibility)
- `tertiary` (`#B45309`) on `surface-muted` (`#FAFAFA`) — 4.9:1 ✅
- `error` (`#DC2626`) on `surface` (`#FFFFFF`) — 4.8:1 ✅

## Typography

`hero-heading` is the once-per-page page-title size — used only for the Hero
invariant copy "Tiny tokens. Big ships." Tight tracking and a 1.05 line height
keep it from feeling soft. `section-heading` is the uniform H2 used by every
non-Hero section (Burn Index, Trust); enforcing one size across sections is
what makes the visual hierarchy register on a single scroll. `hero-subhead`
sits directly below the hero heading at body weight; it carries the audience
sentence so the heading can stay tight.

`tier-label` is uppercase mono — it reads as a system label, not prose, so the
tier dividers feel like structure rather than content. `tier-caption` is the
Inter body face at a small size; it explains, in one sentence, what the tier
means. `row-body` is unchanged from the existing leaderboard rows.

## Layout

The page is one column at the standard `max-w` of 1200px (CSS var, not a token
here). Vertical rhythm between sections is fixed by two values:

- **`spacing.xl` (80px)** — the default gap between adjacent sections (Burn
  Index → Trust).
- **`spacing.2xl` (120px)** — the gap from Hero to Burn Index, to give the
  first scroll target visible breathing room below the fold.

The Burn Index section uses the `alt-bg-section` component (surface-muted
background) so the eye registers a section change without a horizontal rule.
Hero and Trust sit on the white `surface`. The Sticky Header is 56px tall and
pinned to the top of the viewport; its content uses the `sticky-header`
component.

Within the Burn Index section, each tier renders as a section header
(`tier-header`) followed by its rows. Header layout: tier label on the left, a
row count on the right (using `tier-count-amber` for the estimated tier,
`tier-caption-row` neutral form for the others), and a one-line caption
directly beneath. A tier with zero rows after filtering renders nothing — no
empty header. Spacing between a header and its first row is `spacing.sm`;
spacing between the last row of one tier and the next header is `spacing.lg`.

## Elevation & Depth

The page stays flat — no drop shadows on cards. Section separation is
communicated by the alternating background (`surface` ↔ `surface-muted`) and
by the 80/120px vertical gaps. Within the Burn Index leaderboard, depth
between tiers is communicated by a 1px divider above each tier header and by
the descending color temperature (coconut green → amber → neutral grey).
Verified rows keep the existing 2px accent bar on their left edge; estimated
and self-reported rows do not.

## Shapes

Tier headers and count chips use `rounded.sm` (4px). The leaderboard card,
hero CTA, and trust card all use `rounded.md` (8px). The Sticky Header itself
is not rounded — it is a 56px bar pinned to the top of the viewport.

## Components

- **sticky-header** — the 56px pinned top bar. Holds the wordmark on the left
  and the primary waitlist CTA on the right. Sits on `surface` with the page
  scrolling beneath it.
- **hero-cta** — the single primary action on the Hero section. Filled with
  `primary` so it reads as the page's only "click here" target; the on-button
  label is `on-surface` text, which is what makes the contrast pair legible.
- **trust-card** — a section card on the Trust panel that surfaces the three
  verification badges and the "No credit card. Cancel anytime. Your data
  stays yours." reassurance line. Body text is `on-surface` for full WCAG AA
  contrast at small sizes. `secondary` is reserved for decorative accents
  (rule under the heading, icon strokes) and for large text only — never
  body copy under 18px regular.
- **alt-bg-section** — the section container for the Burn Index. Renders the
  `surface-muted` background that visually separates it from the white Hero
  and Trust sections without a horizontal rule.
- **error-text** — reserved for inline form validation messages on the
  waitlist email field. Uses `error` for the message body on `surface`.
- **tier-header** — the section divider for one tier inside the Burn Index.
  Holds the label and count.
- **tier-caption-row** — the one-line explanation row under a tier header.
- **tier-count-amber** — the small muted chip showing how many rows are in
  the estimated tier; uses `tertiary` to match the tier color.
- **tier-verified-accent** — the 2px left-edge accent strip on Verified-tier
  rows. Uses `secondary` (the only place on the page where a small green
  surface is acceptable, because it carries no text).

## Do's and Don'ts

- Do keep the four landing sections in order: Sticky Header, Hero, Burn
  Index, Trust + Final CTA.
- Do use `spacing.xl` (80px) for adjacent section gaps and `spacing.2xl`
  (120px) only for Hero → Burn Index.
- Do enforce one `section-heading` size across every non-Hero section.
- Do keep tier order fixed inside Burn Index: Verified, Estimated, Self-reported.
- Do hide a tier header entirely when its filtered row count is zero.
- Don't introduce a new section between the four MVP sections.
- Don't put `primary` (`#00D084`) on `surface` as text at any size — at
  1.9:1 it also fails WCAG AA Large. Confine it to non-text fills like the
  hero-cta background, where the `on-surface` label on top carries the
  contrast.
- Don't put `secondary` (`#008C5A`) on `surface` as body text under 18px —
  at 4.29:1 it fails WCAG AA Normal. Use `on-surface` for small green text
  is wrong; use `on-surface` for body and reserve `secondary` for large
  text or decoration.
- Don't introduce a new badge for row-level trust — trust still uses the
  existing `VerifBadge`. Tiers group; badges label.
- Don't let tier styling override the active-filter or top-rank row states.
- Don't change row data or sort order within a tier — rows stay VES-ranked.
