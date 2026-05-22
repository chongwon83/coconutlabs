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

---

## Phase F — Production Smoke Test (ON-flip 2026-05-21)

**Date**: 2026-05-21 (Session 2, post-redeploy)
**Deployment**: EUAHZpz1Z — NEXT_PUBLIC_AUTO_DETECT_DEFAULT=true, Production only
**URL**: https://www.coconutlabs.xyz/
**Method**: Chrome browser automation (mcp__claude-in-chrome) + curl

| # | 환경 | 기대 | 실제 | Pass? |
|---|------|------|------|-------|
| 1 | Chrome (FSA=true), 쿼리 없음 | "Auto-detect Burn Summary" | "Auto-detect Burn Summary" | ✅ |
| 2 | FSA-off 시뮬레이션 (`delete window.showDirectoryPicker`) | "Join Burn Index" | "Join Burn Index" | ✅ |
| 3 | Chrome + `?auto-detect=0` (env=true 우선 검증) | "Auto-detect Burn Summary" | "Auto-detect Burn Summary" | ✅ |
| 4 | 무토큰 POST `/api/burnindex` | HTTP 401 | HTTP 401 | ✅ |

**4/4 PASS.** Production ON-flip UX 정상 작동 직접 확인. JS 콘솔 에러 0건.

**비고**: 테스트 #2는 실제 Safari 대신 `delete window.showDirectoryPicker`로 FSA 미지원 시뮬레이션 — `"showDirectoryPicker" in window` 코드 경로를 정확히 검증.
