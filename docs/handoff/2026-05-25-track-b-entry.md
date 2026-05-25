# Track B 진입 — Handoff (2026-05-25)

A.12 사이클 완료. Track A 머지 (PR #21 squash → main `89ff355`) + visual baseline drift 0 확인.
다음 세션은 본 문서 1개만 읽고 Track B로 즉시 진입.

---

## 새 세션 첫 메시지 (verbatim 사용 가능)

```
이전 세션에서 A.12 (inline upload success card a11y 하드닝) 사이클 완료.
docs/handoff/2026-05-25-track-b-entry.md를 먼저 읽고, 거기 명시된
"Track B 진입 결정 트리"부터 이어줘.

plan: ~/.claude/plans/nested-singing-whale.md (Track B 섹션 B.1~B.6 잠금)
권한: 모두 부여. 자율 진행.
```

---

## A.12 사이클 완료 요약

| 항목 | 상태 |
|------|------|
| Edit #1~#9 | ✅ 모두 적용 (E2E spec 202 LOC 4 분기 포함) |
| 11 verification gates | ✅ 전 통과 |
| PR #21 merge | ✅ squash → main `89ff355` |
| visual rebaseline (Linux CI) | ✅ 3 PNG bytes-identical (drift 0 확인) |
| docs/workflow-state.md | ✅ 갱신 (gitignored, local-only) |
| Codex review | ✅ MAJOR 2 + MINOR 1 → MINOR 즉시 처리 (CTA `#burn` URL assertion), MAJOR 2 → Track B 이관 |

---

## A.12 사이클에서 검증된 invariants (Track B에서도 위반 금지)

- `lib/validateSummary.ts:52` VerifLevel 4-union 무수정
- `lib/validateSummary.ts:48` TOOLS 2-union 무수정
- BurnSummaryEnvelope schemaVersion=2 (9 row fields, 4 verification fields, `projectHash /^[0-9a-f]{12}$/`)
- E2E selector `.lb-row .lb-handle` + `[role="columnheader"]` 보존
- `JoinBurnIndexForm` props는 `{ onSuccess, onImport }` 2개뿐 — **onClose 없음**
- "리더보드 보기" CTA = `window.location.hash = "#burn"` 단독
- Korean copy: "리더보드에 추가되었어요" + "리더보드 보기"
- aria-live="polite", scrollIntoView block:'nearest' + reduced-motion → instant
- Solo project: PR review request 없음, Co-Authored-By 라인 없음
- macOS PNG commit 금지 (Linux CI `workflow_dispatch` only)
- DESIGN.md lint error 0
- `handle` payload는 **raw 유지**, JSX 표시만 `successHandle.replace(/^@+/, "")` 적용

---

## Codex MAJOR 2개 → Track B 이관 (deferred)

### MAJOR #1: Success state lift-up architecture

**현황**: `uploadSuccess` / `successHandle` state는 `JoinBurnIndexForm` 자체가 보유.
부모 modal이 unmount되면 inline card도 함께 사라짐.

**Codex 권고**: success state를 modal 외부 (page-level 또는 store)로 lift-up하여,
modal close 후에도 어디든 success card 표시 가능하게.

**우선순위**: B.4 (PostUploadSurvey와 stack 정합 검토 이후 결정)

### MAJOR #2: FSA + PostUploadSurvey + UploadSuccessCard 3-stack interaction

**현황**: FSA path에서 PostUploadSurvey가 inline에 표시되고, 이어 UploadSuccessCard도 함께 mount.
두 컴포넌트 stack ordering이 시각적으로 작동하지만 a11y / focus / TAB order 검증 미흡.

**Codex 권고**: 두 stack의 focus order 명시화 + screen reader announcement priority 결정.

**우선순위**: B.4 직전 게이트

---

## Track B 진입 결정 트리

`~/.claude/plans/nested-singing-whale.md` Track B 섹션 B.1~B.6 잠금 상태 확인 후 다음 순서:

| # | 단계 | 우선순위 사유 |
|---|------|-------------|
| B.1 | CTA color/size 재디자인 (Hero) | 가장 visible, 사용자 conversion 직접 영향 |
| B.2 | SWR polling (BurnIndexSection) | 라이브 데이터 핵심 가치 |
| B.3 | Hero stat bar 와이어링 | B.2 데이터 의존 |
| B.4 | Success state lift-up (Codex MAJOR #1) + FSA stack 정합 (MAJOR #2) | a11y 보강 |
| B.5 | BurnIndexSection 마이크로 인터랙션 | 마감 |
| B.6 | DESIGN.md token 추가 | 마지막 — 토큰화는 최종 step |

> 💡 단, 본 순서는 권장. owner 우선순위 변경 가능. 시작 전 plan B 섹션 잠금 상태 1회 확인 필수.

---

## Track B 진입 전 cleanup 체크리스트

1. **Local branch 정리**: `git branch -d coconut-burn-live-track-a` (squash 머지됨, safe)
2. **Remote branch 정리**: `git push origin --delete coconut-burn-live-track-a`
3. **Untracked items 결정** (각자 별도 검토):
   - `.gstack/` — gstack workspace, 보존 또는 .gitignore 추가
   - `tasks/F1-nonce-atomic-del-backlog.md` — 별도 작업 backlog
   - `tasks/folder-picker-ux-finding1/SESSION_HANDOFF.md` — 과거 사이클 핸드오프
   - `tasks/token-path-real-verify/SESSION_HANDOFF.md` — 과거 사이클 핸드오프
4. **DESIGN.md lint 1회 baseline 재확인**: `npx @google/design.md lint DESIGN.md`

---

## Track B 작업 패턴 (재확인)

- 머지 명령은 **반드시** `gh api -X PUT /repos/chongwon83/coconutlabs/pulls/<N>/merge --field merge_method=squash`
  (NOT `gh pr merge` — worktree 점유 충돌, memory `feedback_gh-pr-merge-worktree-conflict`)
- Codex 호출은 **default gpt-5.5만**, `-m gpt-5-codex` 금지 (400 silent hang)
- Solo project이므로 PR review request 없음, Co-Authored-By 없음
- macOS PNG commit 금지 — visual baseline 갱신은 `gh workflow run visual-baseline-lock.yml --ref main -f reason="<이유>"` 만 사용

---

## 관련 파일 anchor (Track B 진입 시 첫 read 대상)

- `~/.claude/plans/nested-singing-whale.md` Track B 섹션 (B.1~B.6 잠금 본문)
- `web/components/forms/JoinBurnIndexForm.tsx` (A.12 success card mount 위치)
- `web/e2e/upload-success-card.spec.ts` (Track B에서 회귀 baseline)
- `web/components/BurnIndexSection.tsx` (B.2/B.3/B.5 대상)
- `web/components/Hero.tsx` (B.1/B.3 대상)
- `web/DESIGN.md` (B.6 token 추가 대상)
- `web/docs/handoff/2026-05-25-a12-resume.md` (A.12 사이클 진입 시 사용한 prior handoff — 본 문서가 후속)

---

## 작성자 메모

이 핸드오프 자체는 ≤ 200 lines 유지. 새 세션이 이 파일 1개만 읽으면
plan 본문 / 코드 / 이전 핸드오프 재로딩 없이 Track B로 즉시 이어갈 수 있도록 설계.
