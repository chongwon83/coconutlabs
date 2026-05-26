# B.4 — Success state lift-up + 3-stack a11y 정합 (Plan-as-Artifact)

작성: 2026-05-26 | 브랜치: `track-b/b4-success-lift-up` | baseline: main `b646f81`

## Context

- 핸드오프(`docs/handoff/2026-05-26-track-b-b3-complete.md` L141-156)가 다음 1 action으로 B.4를 지정.
- A.12 사이클에서 Codex가 deferred한 MAJOR 2건이 본 페이즈로 이관됨
  (`docs/handoff/2026-05-25-track-b-entry.md` L51-70 참조).

### Codex MAJOR #1 — Success state lift-up architecture (검토 및 구현)

- 현황: `JoinBurnIndexForm`이 `showSuccess` / `successHandle` state를 직접 보유.
  모달 unmount 시 success card도 사라짐 — 사용자가 모달을 닫는 순간 시각적 피드백 소실.
- 권고: success state를 modal 외부 (LandingApp page-level)로 lift-up.
  모달이 닫혀도 페이지 어느 위치든 success 표시 가능.

### Codex MAJOR #2 — FSA + PostUploadSurvey + UploadSuccessCard 3-stack 정합 (검토만)

- 현황: FSA path에서 PostUploadSurvey와 UploadSuccessCard가 inline에 함께 mount.
  시각은 작동하지만 focus order / TAB 순서 / SR 우선순위 미스펙.
- 산출물: 코드 변경 없음 — a11y review doc 1건만 추가.

## Strategy: Additive lift-up

기존 in-modal `.upload-success-card`(`e2e/upload-success-card.spec.ts` baseline 4 tests)는
**그대로 보존**. 페이지 레벨 새 `.upload-success-banner`를 **추가**.

이유:
1. 기존 e2e 4건 baseline 무회귀. `.upload-success-card` selector·복사·CTA 동일.
2. 모달 안 → 폼 내부 카드 (즉시 피드백, 기존 동작).
3. 모달 닫힘 + lastSuccess 존재 → 페이지 상단 배너 (lift-up 효과).
4. 배너는 새 className → 기존 selector와 충돌 없음.

## 변경 파일 (5개)

| # | 파일 | 변경 의도 |
|---|------|-----------|
| 1 | `components/UploadSuccessBanner.tsx` (신규) | 페이지 레벨 success 배너. role=status, aria-live=polite, dismiss + 리더보드 보기 CTA |
| 2 | `app/globals.css` | `.upload-success-banner*` 스타일 (기존 `.upload-success-card`와 별개 토큰 재사용) |
| 3 | `components/LandingApp.tsx` | `lastSuccess` state 추가, `handleImport` 시그니처 `(entries, handle?: string) => void`로 확장, 모달 외부 배너 렌더 |
| 4 | `components/forms/JoinBurnIndexForm.tsx` | 2개 콜사이트(L286 FSA path / L387 manual path)에서 `onImport(data.entries, trimmed)` — `successHandle`과 동일한 raw `@` 미스트립 handle 전달 |
| 5 | `e2e/upload-success-card-banner.spec.ts` (신규) | 모달 닫힘 후 배너 생존 검증 + CTA #burn + dismiss |

## 추가 산출물 (코드 외)

- `docs/a11y/upload-stack-review-2026-05-26.md` — MAJOR #2 검토 결과 (focus order, TAB 순서, SR 우선순위)
- `docs/plans/b4-success-state-lift-up.md` (본 문서)
- `docs/decision/decision-log.md` 신규 엔트리

## 단계별 작업 순서

1. plan doc + decision log 작성 (본 문서 + S0)
2. `components/UploadSuccessBanner.tsx` 작성 — props `{ handle: string; onDismiss: () => void }`
3. `app/globals.css` — `.upload-success-banner` family 추가 (페이지 상단 고정/스크롤 가능, 모바일 반응형)
4. `components/LandingApp.tsx` — `lastSuccess` state, `handleImport` 확장, 배너 렌더 (modal === null && lastSuccess 조건)
5. `components/forms/JoinBurnIndexForm.tsx` — L286 / L387 콜사이트 2건 업데이트
6. `docs/a11y/upload-stack-review-2026-05-26.md` 작성 (MAJOR #2 review only)
7. `e2e/upload-success-card-banner.spec.ts` 신규 — modal close survival
8. 로컬 검증: `npm run typecheck && npm run lint && npm test && npx playwright test && npm run build`
9. Claude-in-Chrome verify + 자체 fix
10. `/codex` 교차 검증
11. PR (solo workflow: review request 없음, Co-Authored-By 없음)
12. squash merge via `gh api -X PUT /repos/chongwon83/coconutlabs/pulls/<N>/merge --field merge_method=squash`

## 검증 방법

### 회귀 (baseline 유지)
- `e2e/upload-success-card.spec.ts` 4 tests 모두 PASS — 기존 in-modal 동작 무변경
- `npm run typecheck` / `npm run lint` 신규 warning 없음
- 기존 unit 267 / e2e 42 모두 PASS

### 신규 (B.4)
- `e2e/upload-success-card-banner.spec.ts`:
  - POST 200 → 모달 닫힘 → `.upload-success-banner` visible
  - 배너 role=status, aria-live=polite
  - "리더보드 보기" CTA 클릭 → URL hash `#burn` + 배너 dismiss
  - dismiss X 클릭 → 배너 사라짐

### a11y (MAJOR #2 검토만)
- focus order: handle input → CTA → (success 시) success card → (FSA + survey 시) survey first → card second
- aria-live priority: `polite` (assertive 금지 — A.12 invariant)
- TAB 진입 시 backup focusable 1개 이상 보장

## 롤백 기준

다음 중 하나라도 발생 시 즉시 plan 재검토 + 작업 중단:
- 기존 `e2e/upload-success-card.spec.ts` 4 tests 중 1건이라도 fail
- `npm run typecheck` 신규 error
- Vercel Production deployment red
- Codex /review에서 MAJOR 추가 발견

## Locked invariants (A.12에서 검증, B.4에서도 위반 금지)

- `JoinBurnIndexForm` props: `{ onSuccess?, onImport? }` 2개 (onClose 추가 금지)
- `onImport` 시그니처 확장 시 backward-compat — 2번째 인자 optional
- Korean copy: "리더보드에 추가되었어요" / "@{handle}" / "리더보드 보기"
- CTA → `window.location.hash = "#burn"` 단독 (router 사용 금지)
- aria-live="polite" (assertive 금지)
- scrollIntoView({ block: "nearest" }) + prefers-reduced-motion → "instant"
- handle payload는 raw, JSX 표시만 `.replace(/^@+/, "")` (form 내부 successHandle 처리 동일)

## Non-scope

- ProductShot Top-3 실데이터 (마스터 플랜의 다른 B.4 정의 — 본 페이즈 분리)
- Live dot pulse 애니메이션 (B.5)
- DESIGN.md 토큰화 (B.6)
- Visual rebaseline (변경 사항이 페이지 상단에 새 영역 추가 — 필요 시 별도 workflow_dispatch)

## 위험 3축 (코덱스 교차 리뷰 발동)

| 축 | 평가 |
|----|------|
| ① 실패비용 | 충족 — 잘못된 batched state로 success 누락 시 사용자 confusion |
| ② 영향범위 | 충족 — 5파일 변경, 모든 사용자 success flow 영향 |
| ③ 관찰가능성 | 충족 — e2e로 검증 가능하지만 modal close timing race condition은 단위 테스트로 못 잡음 |

3/3 충족 → `/codex` 교차 리뷰 강력 권장 (rules/task-standards.md "코덱스 교차 리뷰 발동 임계").
