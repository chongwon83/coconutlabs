# Criteria — Folder Picker UX Improvement (Approach B: inline preview + smart error recovery)

**Date**: 2026-05-21
**Owner**: scw0526 (chongwon83)
**Source plan**: `~/.claude/plans/p1-rollout-lazy-trinket.md`
**Context**: ON-flip 2026-05-21 직후 production smoke test에서 발견된 Chrome FSA picker first-impression UX 결함 수정. 3 surfaces (S1 Path Preview Card 신규 / S2 Smart Error Differentiation / S3 Step 1 Helper Text Refinement). 모달 신설 X (Approach A 기각). UI 영어 유지.

---

## Must-Pass (≥ 7/7 — 단 1개라도 ❌ 시 owner "완료" 발화 금지)

| # | 영역 | 기준 | 검증 방법 |
|---|------|------|----------|
| 1 | security | Build secret 노출 0건 (재확인) | `curl -sS https://www.coconutlabs.xyz/_next/static/chunks/*.js \| grep -c COLLECTOR_HMAC_SECRET` → 0 |
| 2 | ux | Path Preview Card가 picker 버튼 위에 표시되고 `~/.claude/projects` + `~/.codex/sessions` 두 breadcrumb 시각 노출 | Phase 6 cell #1 — Chrome incognito 진입 직후 시각 확인 |
| 3 | error | `AbortError` 케이스에서 error 표시 0건 (사용자 cancel은 silent) | Phase 6 cell #5 — picker dialog cancel 후 form-error 미노출 |
| 4 | error | `SecurityError` 케이스에서 system-folder actionable 메시지 노출 (메시지 그대로일 필요는 없으나 locale-independent detection — `error.name`만 사용) | Phase 6 cell #2 — 홈(`~`) 선택 → 안내 메시지 노출 |
| 5 | error | Name mismatch 케이스에서 사용자가 실제 선택한 폴더명(`{h.name}`) inline 표시 (예: "You picked **.claude**...") | Phase 6 cell #3 — `~/.claude` 자체 선택 → 실제 폴더명 동적 표기 |
| 6 | a11y | 신규 Path Preview Card WCAG AA 4.5:1 통과 + Tab 순서 자연 + screen reader 인지 가능 | Chrome DevTools Lighthouse + 수동 Tab order 검수 |
| 7 | error | `saveHandle()` 실패 (IDB blocked/quota/DataCloneError) 시 handle React state 유지 (`claudeHandle`/`codexHandle` ≠ null) + scan 진행 가능 + `fsaWarning`만 노출 (`fsaError` 빈 상태) | Phase 6 cell #7 — DevTools IDB block 시뮬레이션 또는 saveHandle 임시 throw 검사 (v2 delta §E) |

## Should-Pass (≥ 5/6 통과 — 80% 기준)

| # | 영역 | 기준 | 검증 방법 |
|---|------|------|----------|
| 7 | review | Codex Phase 1 nit-only (HIGH/MEDIUM 결함 0건) | `tasks/folder-picker-ux/codex-phase1.md` |
| 8 | review | `/plan-design-review` Phase 3 nit-only | `tasks/folder-picker-ux/design-review-phase3.md` |
| 9 | build | `tsc --noEmit` + `vitest` + `eslint --max-warnings=0` 모두 통과 | `npx tsc --noEmit && npx vitest run && npm run lint -- --max-warnings=0` |
| 10 | design | DESIGN.md lint error 0 | `npx @google/design.md lint DESIGN.md` |
| 11 | smoke | Owner Happy Path 6 cells 모두 ✅ (Chrome cells 1-5 + Safari fallback cell 6) | `tasks/folder-picker-ux/smoke-golden-regression.md` (owner 직접 기록) |
| 12 | docs | B3 5종 산출물 + decision-log 엔트리 + S10 회고 작성 완료 | `tasks/folder-picker-ux/{criteria,criteria-execution-log,diff,unverified,smoke-golden-regression}.md` + `docs/decision/decision-log.md` |

---

## Invariants (위반 시 즉시 롤백 또는 머지 차단)

1. **Build secret 노출 ≥ 1건** → `env=false` 롤백 + `COLLECTOR_HMAC_SECRET` 회전
2. **a11y 회귀** (WCAG AA 4.5:1 미달 or Tab 순서 회귀) → 머지 차단
3. **Auto-detect 진입 회귀** (Chrome incognito + 쿼리 없음 → "Auto-detect Burn Summary" 카드 미표시) → 머지 차단
4. **Locale 의존 에러 분기** (`error.message` 파싱 발견) → 머지 차단. 반드시 `error.name`만 사용
5. **Handle React state ↔ IDB persistence 결합** (`pickFolder()`에서 `setClaudeHandle()`/`setCodexHandle()`이 `saveHandle()` 결과에 의존) → 머지 차단. 반드시 picker name 검증 직후 handle state set, IDB save는 별도 try-catch (v2 delta §B.2)

---

## Out-of-Scope (명시 제외)

- Pre-picker modal (Approach A 기각)
- i18n / 한국어 메시지 (영어 유지)
- OS detection 로직 (macOS + Linux 두 hint 모두 노출)
- A/B testing 인프라
- Client-side telemetry counter 추가 (cancel/mismatch ratio)
- API/HMAC/Redis 측 변경

---

## DevVault 사전 조회 매칭

| 노트 | 적용 | 사유 |
|------|------|------|
| `2026-05-21-idb-structuredclone-function-prop-dataclonerror-patch.md` | ① 직접 적용 | `pickFolder()` catch 블록 silent failure 패턴 정확히 일치. S2 재작성 시 함수 프로퍼티 핸들 IDB 저장 흐름 ↔ 본 작업 error.name 분기 분리 |
| `2026-04-13.md` (Dev-Log) | ③ 무관 | 본 작업과 무관한 일자 로그 |

## Memory 적용

| 메모리 | 적용 | 사유 |
|--------|------|------|
| `feedback_coconutlabs-solo-no-review-request.md` | ① 직접 적용 | Phase 7 머지 시 PR 리뷰 요청 없이 chongwon83 단독 squash-merge |
| `project_auto-detect-flip-procedure.md` | ② 참고만 | 현재 production 상태(env=true, deployment EUAHZpz1Z) 컨텍스트 |
