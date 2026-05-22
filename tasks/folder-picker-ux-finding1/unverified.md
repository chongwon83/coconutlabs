# 미검증 + Planner spot check — folder-picker-ux-finding1 (2026-05-22)

## 미검증 항목

- **Safari WebKit `useSearchParams` 동작** — Chromium 환경에서만 build/lint/vitest 검증. WebKit hydration 차이는 본 cycle scope 밖
- **sessionStorage / cookie 기반 영구 dismiss** — 본 cycle은 in-memory `useRef` latch만. 페이지 reload 시 latch reset = 의도된 동작 (별 사이클 검토 대상)
- **`?auto-detect=true` 또는 빈 값 동작** — 본 cycle은 strict `=== "1"` 매칭만. plan-brief.md §JoinBurnIndexForm.tsx:67-73 `autoDetect` flag 분기와 일치 (의도된 동작)
- **`?auto-detect=1&auto-detect=2`** — `URLSearchParams.get()`은 첫 값 반환 → "1" → true (Next.js docs L54-61 확인, 의도된 동작)
- **Cell #8 (StrictMode) 미실행** — dev-only 검증, production은 자동 비활성화. 우선순위 낮음. owner 시간 여유 시 1회 실행 권장
- **Codex Phase 1 owner 발동 미완** — codex-phase1.md template 작성 완료. owner가 별도 세션에서 codex-phase1-input.md 전체를 /codex에 전달 + 응답 paste + 판정 표 채움 의무. 본 cycle은 plan-brief.md §진입 시점 Q1-Q6 mitigation 선반영으로 HIGH 후보 사전 차단 — Codex 응답이 HIGH 검출 시 plan v2 fork 후 재구현 필요

## Planner spot check

Planner spot check: plan-v1.md contract/criteria 섹션에 코드 스니펫·diff·라인 단위 지시 ✅ 없음

근거: plan-v1.md는 (Context / Scope / Invariants / Success Criteria / 단계별 실행 계획 / 중단조건 / Time box)로 구성. 단계별 실행은 phase 분해(Phase 1~6)만 명시하고 구현 코드는 plan-brief.md §변경 surface로 위임. Planner 권한 0 원칙 준수 (코드 스니펫은 본 cycle의 codex-phase1-input.md / agents-docs-check.md / diff.md에만 등장 — 모두 Generator/Evaluator/audit trail 산출물).
