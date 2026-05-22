# Plan v1 — folder-picker-ux Finding 1: `?auto-detect=1` 모달 자동 오픈

**Date**: 2026-05-22
**Origin**: `tasks/folder-picker-ux-finding1/plan-brief.md` (Phase 8.2 산출물)
**Parent plan**: `~/.claude/plans/folder-picker-ux-phase-0-8-enchanted-balloon.md` Track C

---

## Context

plan-brief.md 5섹션을 본 plan에서 실행 단계로 확장. /codex Phase 1 적대적 검토 의무(위험 3축 2/3 충족). 단일 파일(LandingApp.tsx) ~15-25 라인 변경 + 모든 close 경로를 `closeModal` 단일 path로 통일.

## Scope / Non-scope

plan-brief.md §Scope/Non-scope 그대로 인수. 추가:
- **Scope (보강)**: 기존 `setModal(null)` 호출 전수를 `closeModal` useCallback으로 통일 (overlay / close button / showToast success setTimeout 등)
- **Non-scope (확인)**: Hero/Nav/DropsSection/FinalCTA의 `setModal("join")` onClick은 본 cycle scope 밖 (latch는 useEffect 자동 오픈만 차단, 명시적 사용자 의도 onClick은 보호 — Q3 의도된 동작)

## Invariants (folder-picker-ux 본체 5축 + 신규 #6)

- #1: build secret leak 0건 (`COLLECTOR_HMAC_SECRET` chunks에 0 hits)
- #2: WCAG AA 4.5:1 (modal trigger 변경이라 시각 토큰 무변, 통과 유지)
- #3: Auto-detect 카드 렌더 contract 유지 (modal 열린 뒤 Path Preview Card 정상)
- #4: error.name only 분기 보존 (본 cycle scope 밖, 무변)
- #5: handle React state ↔ IDB persistence 분리 유지 (무변)
- **#6 (신규)**: 동일 세션 내 사용자 close 후 modal 재오픈 0건 (`userClosedRef.current = true` latch + 모든 close 경로 `closeModal` 통일)

#6 한계: 페이지 reload 시 latch reset (의도된 동작 — URL `?auto-detect=1` remain 시 신규 trigger). sessionStorage 영구 dismiss는 별 사이클.

## Success Criteria (Phase 6 cells)

plan-brief.md §Owner Happy Path Cells 6항목 + Codex Q6 mitigation 2항목(Cell #7 picker success / Cell #8 StrictMode) 그대로 인수. 본 plan §smoke-golden-regression.md 표 참조.

## 단계별 실행 계획

### Phase 1 — /codex Phase 1 적대적 검토 (30분)

본 plan(plan-v1.md) + plan-brief.md §진입 시점 5묶음 질문 + Q6(비-버튼 close 경로 누락)을 `codex-phase1-input.md`로 작성 후 호출. 응답을 `codex-phase1.md`에 owner 채택 결정 포함 기록.

### Phase 2 — plan v2 (Codex mitigations 반영, 10~20분)

Codex HIGH/MEDIUM 결함 검출 시 plan-v1.md를 plan-v2.md로 fork(plan v1 그대로 보존, Planner Immutable Versioning 준수). 결함 없으면 v1 그대로 진행.

### Phase 3 — 구현 (30분)

`components/LandingApp.tsx` 수정 — plan-brief.md §변경 surface diff + parent plan Task C.6 Step 1~6 순서 의무 (AGENTS.md docs 사전 확인 → 인벤토리 → import 수정 → closeModal useCallback → 모든 close 경로 통일 → Suspense boundary 적용).

### Phase 4 — 검증 (15분)

- `npx tsc --noEmit` exit 0
- `npx vitest run` (LandingApp 관련 테스트 영향 확인)
- `npm run build` exit 0
- `grep -c COLLECTOR_HMAC_SECRET .next/static/chunks/*.js` = 0
- B3 5종 산출물 작성 (criteria/criteria-execution-log/diff/unverified/smoke-golden-regression)

### Phase 5 — Phase 6 Owner Happy Path 8 cells (20분)

smoke-golden-regression.md §8 cells를 owner 직접 실행 + 손글씨 기록. Hard gate(secret leak 0 / Invariant #3 회귀 0 / Invariant #6 재오픈 0 / 검증 4종 EXIT 0) 100% + Non-critical 80% 동시 충족.

### Phase 6 — Commit + decision-log 회고 (10분)

decision-log S10 회고 2줄 추가 → stage → 단일 Conventional Commit `feat(landing): ?auto-detect=1 query auto-opens modal with close latch`.

## 중단조건

- /codex Phase 1에서 HIGH 결함 검출 → patch 재발산 후 v2로 재검증
- Phase 4 검증 4종 중 1건이라도 fail → owner 콜백
- Phase 5 cells 8/8 중 Hard gate 1건이라도 ❌ → 즉시 중단, latch 로직 재설계
- production secret leak grep > 0 → 즉시 `git revert HEAD && git push origin main`

## Time box

총 1.5~2h. 30분 초과 phase 발견 시 owner 콜백.
