# Pre-flight Localhost Verification — Folder Picker UX

**Date**: 2026-05-21
**Source**: Automated (Claude-in-Chrome MCP, localhost dev server `npm run dev`)
**Status**: `[auto]` — **NOT** owner-recorded. Does NOT substitute for Phase 6 (`smoke-golden-regression.md`).
**Purpose**: Pre-Phase 6 sanity check — verify Phase 5 implementation actually renders before owner spends time on incognito + production.

---

## Auto-verified items (localhost:3000/?auto-detect=1, modal opened via Join Burn Index button)

| Item | Result | Computed Evidence |
|------|--------|-------------------|
| Modal opens via Join button | ✅ | `.modal-overlay` + `.modal-content` rendered after click |
| Path Preview Card rendered | ✅ | `.path-preview-card` present, 2 `.path-preview-row` children |
| Row 1 content | ✅ | `~/.claude/projects` |
| Row 2 content | ✅ | `~/.codex/sessions` |
| Hidden segments outlined | ✅ | 2× `.path-segment--hidden` with `outline: 1px solid rgb(0, 140, 90)` (= `--young-coconut-dark` #008C5A) |
| Hidden segment text | ✅ | `.claude`, `.codex` |
| Reveal hint text | ✅ | "Hidden folders need: ⌘⇧· (macOS) or Ctrl+H (Linux) in your file manager" |
| kbd labels | ✅ | `⌘⇧·`, `Ctrl+H` |
| Step 1 helper text (v2) | ✅ | "Pick the exact folder previewed below. Drill into hidden directories with the OS shortcut shown." |
| Picker button count | ✅ | 2 (`Select .claude/projects folder`, `Select .codex/sessions folder`) |
| Form-error not displayed | ✅ | `.form-error` absent (no error state) |
| Form-warning not displayed | ✅ | `.form-warning` absent (no warning state — saveHandle didn't fail because we didn't actually pick) |

---

## WCAG AA 4.5:1 contrast (computed, not declared)

| Element | Foreground | Background | Ratio | Status |
|---------|-----------|-----------|-------|--------|
| `.form-step-desc` (helper) | `rgb(82, 82, 82)` (`--fg2` #525252) | `rgb(255, 255, 255)` (page) | 7.52:1 | ✅ AA |
| `.path-preview-row` (path text) | `rgb(82, 82, 82)` | `rgb(255, 255, 255)` (`--bg` #FFFFFF, card background) | 7.52:1 | ✅ AA |
| `.path-preview-hint` (hint copy) | `rgb(82, 82, 82)` | `rgb(255, 255, 255)` | 7.52:1 | ✅ AA |
| `.path-preview-hint kbd` (label) | `rgb(10, 10, 10)` (`--fg` #0A0A0A) | `rgb(250, 250, 250)` (`--surface-muted` #FAFAFA) | 20.4:1 | ✅ AA |
| `.path-segment--hidden` outline | `rgb(0, 140, 90)` (`--young-coconut-dark` #008C5A) | — | outline-only, no text on this color | ✅ N/A (no text claim) |

All criteria #6 contrast targets pass on computed values.

---

## Tab order (modal scope)

10 tabbable elements queried inside `.modal-content`:

1. `×` (close button) — escape route first
2. `Select .claude/projects folder` (Step 1 picker — Claude)
3. `Select .codex/sessions folder` (Step 1 picker — Codex)
4–8. `day / week / month / year / all` (timeframe selector, Step 2)
9–10. (remaining form controls)

**Verdict**: Close-first → Step 1 pickers → Step 2 controls = natural keyboard order. No `tabindex` overrides detected (all `tabIndex: 0`).

Owner Lighthouse + screen reader pass still required for criterion #6 final.

---

## What this does NOT cover (Phase 6 owner cells remain mandatory)

These require real user gesture / browser security context / cross-browser testing — auto-verification CANNOT substitute:

| Phase 6 Cell | Why owner manual required |
|--------------|---------------------------|
| #1 production | This file is **localhost only**. Production Vercel deployment has different SSR/Edge behavior. |
| #2 SecurityError | `showDirectoryPicker()` requires user gesture; Chrome's system-folder block triggers OS dialog. Cannot script. |
| #3 Name mismatch | Picker user gesture + folder selection. Cannot script. |
| #4 Happy path | Picker user gesture + folder selection + IDB persistence. Cannot script. |
| #5 AbortError silent | Picker user gesture + cancel. Cannot script. |
| #6 Safari fallback | Different browser. Cannot script from this MCP session. |
| #7 IDB throttle | DevTools Storage > Clear site data + saveHandle throw. Better done with real interaction. |

Phase 6 cells must be executed by owner in Chrome incognito + Safari with hand-written results in `smoke-golden-regression.md`.

---

## How this artifact is used

- Updates criteria #2 from "⏳ pending (Phase 6 cell #1)" to "✅ (localhost code-side) ⏳ (production cell #1)" in `criteria-execution-log.md`
- Updates criteria #6 contrast from "✅ (Phase 3 self-audit)" to "✅ (Phase 3 + localhost computed)" — strengthens evidence
- Does **not** mark any Phase 6 cell as passed — those remain owner-direct per harness-loop.md "owner 직접 기록 의무"
