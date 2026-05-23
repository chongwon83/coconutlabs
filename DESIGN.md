---
name: "CoconutLabs Landing — MVP-4 + Burn Index Verification Tiers"
colors:
  primary: "#00D084"
  secondary: "#0F766E"
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
    padding: "{spacing.sm}"
    rounded: "{rounded.sm}"
---

## Overview

CoconutLabs is the verified efficiency leaderboard for solo developers shipping
with LLM tokens. The landing page distills the product into **three vertical
sections** — Sticky Header, Hero, and Burn Index (with an embedded Trust
subsection) — so a first-time visitor can read what the product is, see the
proof, and join the waitlist without scrolling past content they don't need
yet. Trust collapses into the Burn Index container as a subsection directly
beneath the leaderboard, preserving its content while removing the standalone
Trust + Final CTA section that previously broke the single-message axis.

The Burn Index section within this landing retains a **three-tier trust
hierarchy** (Verified, Estimated, Self-reported) that groups leaderboard rows
by measurement confidence. Tiers re-order existing rows; they do not change
data, do not lose rows, and do not introduce a new badge.

## Colors

`primary` (`#00D084`, young coconut) is the brand accent — it marks the
verified tier in the Burn Index and powers the hero CTA. `secondary`
(`#0F766E`) is its darker form, used for small verified text, the Trust
subsection accent, and rules where `primary` would fail WCAG AA on white at
small sizes. The corrected teal `#0F766E` passes WCAG AA 5.47:1 on `surface`,
so verified-tier body copy can use it without size constraints.
`tertiary` (`#B45309`, warm amber) marks the estimated tier — present but
unconfirmed. `neutral` (`#525252`) carries the self-reported tier and all
caption text; it stays muted so unverified rows recede. `on-surface`
(`#0A0A0A`) is the primary text color on the white `surface`. The Burn Index
container uses `#F5F5F5` (a slightly heavier alt-bg than `surface-muted`
`#FAFAFA`) to give the embedded Trust subsection visible separation from the
white Hero above and to register the section change without a horizontal rule.
`error` (`#DC2626`) is reserved for form validation states only.

**WCAG AA contrast (text/background pairs)**:

- `on-surface` (`#0A0A0A`) on `surface` (`#FFFFFF`) — 19.3:1 ✅
- `on-surface` (`#0A0A0A`) on `surface-muted` (`#FAFAFA`) — 18.5:1 ✅
- `on-surface` (`#0A0A0A`) on Burn Index alt-bg (`#F5F5F5`) — 18.0:1 ✅
- `secondary` (`#0F766E`) on `surface` (`#FFFFFF`) — 5.47:1 ✅ (passes WCAG AA
  Normal at any size, replacing the prior `#008C5A` large-text-only constraint.)
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
here). Vertical rhythm is fixed by two values:

- **`spacing.xl` (80px)** — the gap between the Burn Index leaderboard and the
  embedded Trust subsection inside the same container.
- **`spacing.2xl` (120px)** — the gap from Hero to Burn Index, to give the
  first scroll target visible breathing room below the fold.

The Burn Index section uses a `#F5F5F5` alt-bg with a 1px top hairline divider
so the eye registers the Hero → Burn boundary without a heavy rule. Hero sits
on the white `surface`. The Trust subsection (heading, three-card grid, and
collection-spec note) lives **inside** the Burn Index container, separated
from the leaderboard by a 1px divider and 40px of top padding so it reads as
a related extension of the same proof, not a new section. The Sticky Header
is 56px tall and pinned to the top of the viewport; its content uses the
`sticky-header` component and carries the identity anchor "Measure the burn.
Own the ship." beside the wordmark.

Within the Burn Index section, each tier renders as a section header
(`tier-header`) followed by its rows. Header layout: tier label on the left, a
row count on the right (using `tier-count-amber` for the estimated tier,
`tier-caption-row` neutral form for the others), and a one-line caption
directly beneath. A tier with zero rows after filtering renders nothing — no
empty header. Spacing between a header and its first row is `spacing.sm`;
spacing between the last row of one tier and the next header is `spacing.lg`.

## Elevation & Depth

The page stays flat — no drop shadows on cards. Section separation is
communicated by the Hero (`surface` `#FFFFFF`) → Burn Index (`#F5F5F5`)
alt-bg shift plus a 1px hairline divider, and by the 120px Hero-to-Burn gap.
Within the Burn Index leaderboard, depth between tiers is communicated by a
1px divider above each tier header and by the descending color temperature
(coconut green → amber → neutral grey). Verified rows keep the existing 2px
accent bar on their left edge; estimated and self-reported rows do not.

## Shapes

Tier headers and count chips use `rounded.sm` (4px). The leaderboard card,
hero CTA, and trust-grid items all use `rounded.md` (8px). The Sticky Header
itself is not rounded — it is a 56px bar pinned to the top of the viewport.

## Components

- **sticky-header** — the 56px pinned top bar. Holds the wordmark and the
  identity anchor tagline "Measure the burn. Own the ship." on the left, and a
  secondary ghost CTA on the right. Sits on `surface` with the page scrolling
  beneath it. The primary waitlist CTA lives in the Hero, not here — the
  sticky bar carries only the always-visible 2차 action so CTA hierarchy stays
  unambiguous above the fold.
- **hero-cta** — the single primary action on the Hero section. Filled with
  `primary` so it reads as the page's only "click here" target; the on-button
  label is `on-surface` text, which is what makes the contrast pair legible.
- **trust-card** — a card in the embedded Trust subsection's three-card grid,
  inside the Burn Index container. Surfaces a single verification badge with
  its headline and description, plus the "No credit card. Cancel anytime.
  Your data stays yours." reassurance line under the grid. Body text is
  `on-surface` for full WCAG AA contrast at small sizes. `secondary` (the
  corrected teal `#0F766E`) passes WCAG AA Normal at any size, so it can
  appear as body color too — though `on-surface` remains the default and
  `secondary` is reserved for decorative accents (rule under the heading,
  icon strokes).
- **alt-bg-section** — the section container for the Burn Index. Renders the
  `#F5F5F5` background (a slightly heavier alt-bg than `surface-muted`
  `#FAFAFA`) so the embedded Trust subsection visually separates from the
  white Hero above without a horizontal rule. A 1px top hairline divider
  reinforces the Hero → Burn boundary.
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

- Do keep the three landing sections in order: Sticky Header, Hero, Burn
  Index (with Trust embedded as a subsection inside the Burn Index
  container).
- Do use `spacing.xl` (80px) for the gap between the Burn Index leaderboard
  and the embedded Trust subsection, and `spacing.2xl` (120px) only for
  Hero → Burn Index.
- Do enforce one `section-heading` size across every non-Hero section.
- Do keep tier order fixed inside Burn Index: Verified, Estimated, Self-reported.
- Do hide a tier header entirely when its filtered row count is zero.
- Do keep the primary waitlist CTA in the Hero only; the Sticky Header
  carries a ghost secondary CTA so the page has one unambiguous 1차 action
  above the fold.
- Don't introduce a new section between the three MVP sections, and don't
  resurrect the standalone Trust + Final CTA section that anB collapsed
  into the Burn Index container.
- Don't put `primary` (`#00D084`) on `surface` as text at any size — at
  1.9:1 it also fails WCAG AA Large. Confine it to non-text fills like the
  hero-cta background, where the `on-surface` label on top carries the
  contrast.
- Don't revert `secondary` to the old `#008C5A`; the corrected teal
  `#0F766E` passes WCAG AA Normal at 5.47:1 on `surface` at any size and
  removes the prior large-text-only constraint. `on-surface` remains the
  default body color; `secondary` is fine for accents and large text.
- Don't introduce a new badge for row-level trust — trust still uses the
  existing `VerifBadge`. Tiers group; badges label.
- Don't let tier styling override the active-filter or top-rank row states.
- Don't change row data or sort order within a tier — rows stay VES-ranked.
