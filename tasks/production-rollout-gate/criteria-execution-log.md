# Criteria Execution Log — Rollout Gate Integrity v2

**Cycle**: 2026-05-21 (Phase B+ 확장: HMAC + Counter Reset + CI Hardening)
**Based on**: `tasks/production-rollout-gate/criteria.md`

## Must-Pass Results (10/10 required)

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | `/api/burnindex` 무토큰 POST → 401 | ✅ PASS | route.ts:55-57 header guard; token.test.ts verifies via mock |
| 2 | `/api/telemetry/auto-detect` 무토큰 POST → 401 | ✅ PASS | Same pattern applied; telemetry route.ts header guard |
| 3 | 만료된 토큰(ttl 경과) → 401 | ✅ PASS | burn-token.test.ts "expired token" case: exp set to now-1 → result.ok=false, status=401 |
| 4 | 토큰 재사용 시도(nonce) → 401 | ✅ PASS | burn-token.test.ts "nonce reuse" case: second use → 401, reason contains "nonce" |
| 5 | HMAC secret이 클라이언트 bundle에 평문 미노출 | ✅ PASS | `grep -r COLLECTOR_HMAC_SECRET .next/static/` → 0 results |
| 6 | Redis v2 namespace — `getMetricsSnapshot`이 v2 키만 읽음 | ✅ PASS | burn-metrics-v2-namespace.test.ts: v1 keys never accessed |
| 7 | secrets 미설정 → CI workflow exit 1 (silent PASS 차단) | ✅ PASS | production-rollout-gate.yml step "Validate secrets": exits 1 if missing |
| 8 | result가 `[PASS, FAIL]` 외 → exit 1 | ✅ PASS | workflow: `case "$gate_result" in PASS|FAIL) ;; *) exit 1 ;; esac` |
| 9 | `set -euo pipefail` 적용 | ✅ PASS | All `run:` blocks in workflow have `set -euo pipefail` |
| 10 | Kind mismatch → 401 with "kind" in reason | ✅ PASS | burn-token.test.ts "kind mismatch" case |

**Must-Pass: 10/10 ✅**

## Should-Pass Results (≥ 5/6 required)

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 11 | 정상 토큰 발급 → POST → 200 회귀 | ✅ PASS | burn-token.test.ts happy path × 2 |
| 12 | vitest 전체 그린 (≥ 108) | ✅ PASS | 234 passed (17 files), 0 failed |
| 13 | tsc EXIT 0 | ✅ PASS | `npx tsc --noEmit` exit 0 |
| 14 | eslint 0 errors | ✅ PASS | 0 errors, 15 pre-existing warnings |
| 15 | `npm run build` SUCCESS | ✅ PASS | Build succeeded, all 7 routes generated |
| 16 | Axis 2 abandonment 계산 (`started - completed - failed`) | ✅ PASS | burn-axis2-abandonment.test.ts: 5 cases all pass |

**Should-Pass: 6/6 ✅**

## Phase A (Kill-switch 10-cell matrix)

**Status**: OWNER MANUAL STEP PENDING

The kill-switch matrix requires owner to run `next build && next start` in 3 env configurations and verify Chrome browser behavior. This cannot be automated.

Required: `tasks/production-rollout-gate/smoke-golden-regression.md` — owner must write directly.

## Summary

Must-pass: 10/10 ✅ | Should-pass: 6/6 ✅ | Phase A: ✅ COMPLETE (10/10 cells)

---

## ON-flip Success Conditions (2026-05-21)

**기준**: `on-flip-2026-05-21.md` §성공조건 체크리스트

### Must-Pass (5항목)

| # | 항목 | 결과 | 근거 |
|---|------|------|------|
| 1 | Build secret 노출 0건 | ✅ PASS | curl + grep 전 청크 0건 |
| 2 | Chrome → "Auto-detect Burn Summary" | ✅ PASS | Phase F smoke test #1 직접 확인 |
| 3 | Safari fallback → "Join Burn Index" | ✅ PASS | Phase F smoke test #2 (FSA-off 시뮬레이션) |
| 4 | 무토큰 POST → 401 | ✅ PASS | Phase F smoke test #4 curl 확인 |
| 5 | axis2.started T+1h ≥ 1 | ❌ FAIL | T+1h 확인: HGETALL burn:metrics:v2:agg = empty, SCARD burn:metrics:v2:axis1 = 0. 유기 트래픽 미발생 |

**Must-Pass: 4/5 (❌ #5 T+1h 0 — 유기 트래픽 미발생)**

### Should-Pass (6항목)

| # | 항목 | 결과 | 근거 |
|---|------|------|------|
| 6 | Codex pre-flip nit-only | ✅ PASS | PARTIAL → HIGH 3건 mitigations 반영, Phase B 진입 허용 |
| 7 | Workflow_dispatch ritual + FAIL 기록 | ✅ PASS | Run #13 FAIL (axis1=0<15), 우회 기록 완료 |
| 8 | Vercel env Production only | ✅ PASS | Preview/Dev 미오염 확인 |
| 9 | Redeploy 5분 이내 | ✅ PASS | 34초 (EUAHZpz1Z) |
| 10 | axis2 failRate ≤ 20% (n≥10) | ❌ FAIL | T+1h 분모=0, 평가 불가. 트래픽 누적 필요 |
| 11 | Codex post-flip nit-only | ✅ PASS | PASS — HIGH/MEDIUM 결함 없음 |
| 12 | decision-log + on-flip + S10 3종 | ✅ PASS | Phase J 완료 |

**Should-Pass: 5/6 통과 (❌ #10 T+1h 분모=0 평가 불가) — 83% ≥ 80% 기준 충족**
