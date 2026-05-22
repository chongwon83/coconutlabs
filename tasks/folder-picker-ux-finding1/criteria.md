# 평가기준 — folder-picker-ux-finding1 (2026-05-22)

1. [Invariant #1] build secret leak 0건 — `grep COLLECTOR_HMAC_SECRET .next/static/chunks/*.js` = 0
2. [Invariant #3] auto-detect 진입 후 Path Preview Card 정상 렌더 (회귀 0)
3. [Invariant #6] 동일 세션 close 후 modal 재오픈 0건 (`userClosedRef` latch 작동)
4. [Next.js 16.2.6 AGENTS] `useSearchParams` Suspense boundary 의무 검증 — agents-docs-check.md L179 인용 + Option A (AutoDetectListener 자식 분리)로 CSR bailout 범위 제한 + build에서 `/` 여전히 ○ Static prerender 유지
5. [React 19] StrictMode double-invoke 시 `userClosedRef` retain — useEffect dep `[searchParams, modal, setModal, userClosedRef]` 안전
6. [Verification 4종] tsc EXIT 0 / vitest 234/234 그린 / build success (`/` ○ Static) / secret leak 0
7. [Phase 6 cells] Owner Happy Path 7/7 그린 (#8 StrictMode 선택, smoke-golden-regression.md)
8. [coding.md / eslint-react-hooks] useEffect 의존성 명시적, 위반 0
9. [task-standards.md / Planner spot check] plan-v1.md contract/criteria에 code snippet 0
10. [Codex Phase 1] HIGH/MEDIUM 결함 mitigation 모두 적용 — 본 cycle은 plan-brief.md §진입 시점 사전 정의된 Q1-Q6 mitigation을 plan v1에 선반영 (Suspense boundary Option A + closeModal unified path + strict "1" matching + onClick latch 미체크 의도 동작)
