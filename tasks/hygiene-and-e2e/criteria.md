# 평가기준 — Hygiene + e2e Phase #1 CI fixup (2026-05-22)

A4 Evaluator-style criteria extracted from ADR/PRD/CONTRACTS for this fixup cycle.
**Caching banned** — re-scanned at start of every cycle.

---

## 평가 항목

### 1. [security.md] Token/HMAC/Redis secret 누출 0건
- `playwright.config.ts`에 `UPSTASH_REDIS_REST_URL` / `COLLECTOR_HMAC_SECRET` 주입 금지 (dev `.env.local` leak prevention)
- spec fixture에 실제 토큰·세션·HMAC 시드 0건
- 검증 방법: `git diff` + `grep -E "(UPSTASH|HMAC|REDIS)" playwright.config.ts e2e/`

### 2. [security.md, prd.md A2 PRD Lock] 9-field envelope whitelist 정합
- e2e stub이 9-field whitelist를 우회하더라도, 별도 unit test (`__tests__/burn-server-whitelist.test.ts`)가 server-side whitelist 검증을 유지
- spec stub의 `body`가 9-field 셰이프와 충돌하지 않음

### 3. [coding.md, e2e invariant] 컴포넌트 무변경 (spec-only fixup)
- `JoinBurnIndexForm.tsx`, `LandingApp.tsx`, `Toast.tsx`, `app/api/burnindex/route.ts`, `lib/server/burn/token.ts` 변경 0건
- `playwright.config.ts`, `.github/workflows/ci.yml` 변경 0건
- 변경 파일은 `e2e/burn-import-fsa-picker.spec.ts` + `e2e/onboarding-30s.spec.ts` + `tasks/hygiene-and-e2e/` 산출물에만 한정

### 4. [coding.md] 로컬 `npm run test:e2e` PASS
- 3 specs PASS, retries=0 (CI에선 retries=1로 자동 설정되지만 local은 0)
- 30초 이내 wall-clock (median target 산출)

### 5. [security.md] 결정적 / 비결정적 분리
- onboarding-30s 5회 median ≤ 30s (deterministic threshold)
- waitForResponse는 POST predicate filter로 GET-on-mount 우연 매칭 차단

### 6. [task-standards.md "검증 분리"] /codex 교차 리뷰 통과
- /codex Phase 1: NEEDS_REVISION → 6 mitigations 채택
- /codex Phase 2: CONDITIONAL APPROVE — merge 가능, follow-up 2건 unverified.md에 기록

### 7. [coding.md] Stub은 production 보안 경계를 약화하지 않음
- `page.route` 핸들러는 page-scoped (spec 간 leak 없음)
- workers=1 + BURN_STORE=memory + unique `@e2e-30s-${i}-${Date.now()}` handles → 5-run 누적 contamination 방지
- `reuseExistingServer: !process.env.CI` (CI에선 fresh server 보장 — Codex Phase 2 Q3 정정)

### 8. [folder-picker-ux finding 1 decision-log] auto-detect 모달 auto-open 호환
- `?auto-detect=1` query 시 LandingApp.tsx:44-52 useEffect가 modal 자동 오픈
- spec은 manual click 제거하고 `.modal-overlay` + 첫 버튼 visibility로 진입 (Codex Q2 P3 hardening 적용)
- 회귀 시 fail-fast (timeout 2s for overlay, 5s for button)

### 9. [task-standards.md "Fast-Path"] Review Harness 3종 출력
- 테스트 결과 표 (3 specs PASS, 5-run median 120ms)
- 평가기준 통과 여부 (본 문서)
- 미통과 사유 + 다음 액션 (unverified.md)

### 10. [solo policy] No PR review, no Co-Authored-By
- commit 메시지에 Co-Authored-By 부착 금지
- direct push to main (`git push origin main`), `gh run watch`로 CI green 확인
