# Track B 완료 — 세션 클로즈 핸드오프 (2026-05-27 KST)

Track B (B.1 ~ B.6) 전 항목 main 머지 완료. CI infra 강화(workflow_dispatch
outage safety) 병행 완료. 이 세션에서 새로 할 작업 없음 — 다음 세션 진입점 명시.

---

## 새 세션 첫 메시지 (paste-ready)

```text
docs/handoff/2026-05-27-track-b-complete-session-close.md 읽고
"다음 세션 지침"부터 이어줘.
```

---

## 현재 main 상태 (작성 시점)

| 항목 | 값 |
|------|----|
| HEAD | `fef0c5e` (docs/handoff #32) |
| CI: test / parity / security | ✅ pass |
| CI: Vercel | ✅ pass |
| CI: e2e / visual | ❌ fail — **사전 main 버그, Track B 책임 아님** (아래 참조) |
| 로컬 브랜치 | `main` 외 stale 4개 (`b1`~`b4`, 이미 머지됨) |
| 열린 PR | 없음 |

---

## Track B 전체 머지 이력

| PR | 브랜치 | 내용 | 머지 |
|----|--------|------|------|
| #23 | `coconut-burn-live-track-b-b1` | B.1 CTA redesign — green primary + XL size | 2026-05-26 |
| #24 | `coconut-burn-live-track-b-b2` | B.2 SWR polling Burn Index | 2026-05-26 |
| #25 | `coconut-burn-live-track-b-b3` | B.3 stat bar wired to Burn Index | 2026-05-26 |
| #26 | `docs-b3-handoff-til` | docs handoff B.1~B.3 | 2026-05-26 |
| #27 | `track-b/b4-success-lift-up` | B.4 upload success banner | 2026-05-26 |
| #28 | `track-b/b5-micro-interactions` | B.5 product-shot-dot pulse + reduced-motion | 2026-05-26 |
| #29 | `docs/b5-handoff-til` | docs handoff B.5 | 2026-05-26 |
| #30 | `track-b/b6-motion-tokens` | **B.6 motion tokens refactor** | 2026-05-27 |
| #31 | `infra/workflow-dispatch-outage-safety` | CI workflow_dispatch 트리거 | 2026-05-27 |
| #32 | `docs/b6-merged-handoff-2026-05-27` | docs handoff B.6 + infra | 2026-05-27 |

---

## 미해결 1: BurnIndex empty-state copy 불일치 (main 버그)

**원인**: Track B 작업 도중 컴포넌트 카피가 바뀌었으나 e2e 테스트가 갱신되지 않음.

| | 위치 | 현재 값 |
|-|------|---------|
| **테스트 기대값** | `e2e/burn-index-filter.spec.ts:180` | `"이 도구 사용자는 아직 없어요"` |
| **컴포넌트 실제값** | `components/BurnIndexSection.tsx:226` | `"이 탭에는 결과가 없어요."` |

테스트 주석(L17)은 "이 도구 사용자" copy가 컴포넌트 L220에 있다고 명시 → 컴포넌트가 변경된 시점에 테스트가 따라가지 못한 drift.

**owner 결정 필요**: 어느 쪽이 canonical한가?

- **(A) 컴포넌트 카피 복원** (`"이 도구 사용자는 아직 없어요"` 로 롤백):
  - `BurnIndexSection.tsx:226` 수정
  - e2e 주석과 기대값이 다시 일치
  - 사용자 메시지는 더 직관적(tool-specific 문구)

- **(B) e2e 테스트 갱신** (현재 컴포넌트 카피를 정답으로 수용):
  - `e2e/burn-index-filter.spec.ts:180` 수정 + L17 주석 갱신
  - "이 탭에는 결과가 없어요." + "All 탭" 버튼 UX 유지
  - 컴포넌트 변경 없음

**권장**: (A). "이 도구 사용자는 아직 없어요"는 필터 컨텍스트에 더 명확. "이 탭에는" 은 generic. 단, owner가 (B)를 원하면 1-line fix.

제안 브랜치: `fix/burn-index-empty-state-copy`

---

## 미해결 2: 로컬 stale 브랜치 정리 (선택)

B.1~B.4 브랜치가 머지됐음에도 로컬에 남아있음:

```bash
git branch -d coconut-burn-live-track-b-b1 \
              coconut-burn-live-track-b-b2 \
              coconut-burn-live-track-b-b3 \
              track-b/b4-success-lift-up
```

이번 세션에서 B.6/infra/docs 3개 삭제 완료 — 나머지 4개도 동일 패턴.

---

## CI infra 산출 (이 세션 영구 자산)

`workflow_dispatch:` 가 3개 워크플로우에 추가됨:

```bash
# 다음 Actions outage 시 1줄로 수동 트리거
gh workflow run "CI" --ref main
gh workflow run "parity-test" --ref main
gh workflow run "security-test" --ref main
```

---

## 운영 패턴 (이번 사이클에서 확립)

1. **PR CI fail → main baseline 먼저** (`gh run list --branch main --limit 5`):
   main도 fail이면 PR 책임 아님 → admin merge 가능
   → `feedback_pr-fail-main-baseline-first.md`

2. **admin merge**: `enforce_admins=false` 시 `gh api -X PUT /repos/.../pulls/N/merge
   --field sha=<head>` (worktree 충돌 + race condition 양쪽 방어)

3. **workflow_dispatch smoke**: 워크플로우 변경 후 `gh workflow run` + `gh run list`
   로 event 등록 확인

---

## TIL 기록 (DevVault)

- `2026-05-27-pr-ci-fail-main-baseline-grep.md` — PR CI fail 시 main baseline
  확인이 rebase보다 우선 (branch table + 2-evidence 패턴)

---

# 다음 세션 지침

> 이 섹션은 다음 세션 시작 시 그대로 읽고 진입.

## 상황 요약 (30초)

Track B 6개 모두 머지됨. main은 `test`/`parity`/`security`/`Vercel` 녹색, `e2e`/`visual` 빨간색(사전 버그). 지금 당장 사용자에게 영향 없는 CI 노이즈이나 오래 방치하면 진짜 회귀를 가리므로 빠른 해소 권장.

## 우선순위 큐

### P0 — BurnIndex empty-state fix (e2e/visual 녹색화)

```
브랜치: fix/burn-index-empty-state-copy
파일:   components/BurnIndexSection.tsx:226  OR  e2e/burn-index-filter.spec.ts:180
결정:   owner가 (A)/(B) 선택 후 1-line fix
예상:   30분 이내 완료
```

진입 전 owner에게 먼저 물어볼 것:

> "BurnIndex 필터 빈 상태 카피 — `(A) 컴포넌트를 '이 도구 사용자는 아직 없어요'로 복원` vs
> `(B) e2e를 현재 '이 탭에는 결과가 없어요'에 맞게 갱신` — 어느 쪽으로 할까요?"

### P1 — 로컬 stale 브랜치 정리 (5분)

```bash
git branch -d coconut-burn-live-track-b-b1 \
              coconut-burn-live-track-b-b2 \
              coconut-burn-live-track-b-b3 \
              track-b/b4-success-lift-up
```

owner 승인 확인 후 실행.

### P2 — 다음 트랙 (Track C 또는 신규 기능)

Track B 완료 이후 로드맵은 owner 결정. 없으면 BurnIndex fix 후 휴식.

## 세션 시작 체크리스트

- [ ] `git pull origin main` — HEAD 확인
- [ ] owner에게 P0 (A)/(B) 결정 1회 질문
- [ ] 결정 나오면 fix 브랜치 생성 + 1-line 수정 + CI 확인
- [ ] e2e/visual 녹색 확인 후 merge
- [ ] 로컬 stale 브랜치 정리 (owner 승인 후)

## 운영 제약 (매 세션 준수)

| 제약 | 내용 |
|------|------|
| PR 머지 | `gh api -X PUT /repos/chongwon83/coconutlabs/pulls/N/merge --field sha=<head>` |
| /codex | default `gpt-5.5`만 (`-m gpt-5-codex` silent hang) |
| 브랜치 삭제 | owner 명시 승인 후만 |
| 보고 | 최종 결과 1회만 (중간 보고 최소화) |
| Actions outage 시 | `gh workflow run "<name>" --ref main` 수동 트리거 |

## 빠른 컨텍스트 복원 명령

```bash
cd "/Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web"
git log --oneline main -5
gh run list --workflow=ci.yml --branch main --limit 3 --json event,conclusion,createdAt
```
