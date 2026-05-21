# Kill-Switch Smoke / Golden Regression Matrix

**Date**: 2026-05-21
**Branch**: fix/rollout-gate-integrity-v2
**Browser**: Chrome (tab group MCP, tabId 1366937805)
**Method**: 3 production builds (`next build && next start`) — each env value baked at compile time.
**Indicator**: Modal title — "Auto-detect Burn Summary" = ON, "Join Burn Index" = OFF.

---

## 6 Base Cells

| # | NEXT_PUBLIC_AUTO_DETECT_DEFAULT | URL query | Expected | Actual | Pass? |
|---|--------------------------------|-----------|----------|--------|-------|
| 1 | unset | (none) | OFF | "Join Burn Index" | ✅ |
| 2 | unset | `?auto-detect=1` | ON | "Auto-detect Burn Summary" | ✅ |
| 3 | `false` | (none) | OFF | "Join Burn Index" | ✅ |
| 4 | `false` | `?auto-detect=1` | **OFF** (kill-switch) | "Join Burn Index" | ✅ |
| 5 | `true` | (none) | ON | "Auto-detect Burn Summary" | ✅ |
| 6 | `true` | `?auto-detect=0` | ON (env wins) | "Auto-detect Burn Summary" | ✅ |

---

## 4 Alpha Cells (edge cases)

| # | NEXT_PUBLIC_AUTO_DETECT_DEFAULT | URL query | Expected | Actual | Pass? |
|---|--------------------------------|-----------|----------|--------|-------|
| α1 | unset | `?auto-detect=TRUE` (uppercase) | OFF | "Join Burn Index" | ✅ |
| α2 | unset | `?auto-detect=1&auto-detect=0` (duplicate) | ON (`get()` first) | "Auto-detect Burn Summary" | ✅ |
| α3 | unset | `?auto-detect=` (empty value) | OFF | "Join Burn Index" | ✅ |
| α4 | unset | `?auto-detect=01` (leading zero) | OFF | "Join Burn Index" | ✅ |

---

## Summary

**10/10 cells PASS.** Kill-switch (`env=false`) correctly overrides `?auto-detect=1` (cell #4 — critical).
`env=true` correctly overrides `?auto-detect=0` (cell #6).
Alpha cells confirm strict `=== "1"` matching rejects all variants.

**Phase A complete.**
