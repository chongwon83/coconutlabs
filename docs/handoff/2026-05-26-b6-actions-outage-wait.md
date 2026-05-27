# B.6 PR #30 — Actions Outage Wait (2026-05-26 ~21:30 KST 작성)

GitHub Actions `major_outage` → `degraded_performance` 부분 회복 중. PR #30
워크플로우가 outage 윈도우(10:57Z~) 푸시였던 탓에 0 run firing. 능동 액션
없이 1시간 단위로 회복 여부 polling 후 표준 3-step 플레이북 실행.

---

## 새 세션 첫 메시지 (paste-ready)

```text
docs/handoff/2026-05-26-b6-actions-outage-wait.md 읽고
"1단계 — 회복 확인"부터 이어줘.
```

---

## 현재 상태 (이 파일 작성 시점)

| 항목 | 값 |
|------|----|
| GH Actions component | `degraded_performance` (incident `investigating`, impact `critical`) |
| Incident 마지막 update | 2026-05-26T12:17:55Z (~21:17 KST) |
| Webhooks / API Requests | `operational` |
| PR #30 head SHA | `1f90e677ada2ca39b9f11570df5e3d7857b8b02b` |
| PR #30 workflow runs | **0건** (only Vercel SUCCESS — Vercel은 별도 webhook path) |
| PR #30 mergeStateStatus | `BLOCKED` (required: parity + security, never ran) |
| PR #30 mergeable | `MERGEABLE` (충돌 없음) |
| Branch protection on main | `parity+security` required, `enforce_admins=false` → admin bypass 가능 |
| Last green main 빌드 | 2026-05-26T10:35:24Z (직전 PR docs/b5-handoff-til 머지 직후) |
| Outage 시작 추정 | 2026-05-26T10:57Z |

`enforce_admins=false`가 핵심. chongwon83(repo owner)은 분기보호 우회 가능.

---

## /codex 진단 (이미 받음, 2026-05-26 ~21:25 KST, gpt-5.5, 60.6k tokens)

| Q | 결론 |
|---|------|
| **Q1**: Outage 중 empty commit / reopen retrigger? | ❌ **비신뢰**. Outage 윈도우에 잃어버린 Actions 이벤트는 user-redeliverable 아님. Actions가 `operational`/`monitoring` 될 때까지 retrigger 무의미 |
| **Q2**: `gh api -X PUT /merge` admin bypass 동작? | ✅ **동작 기대**. `enforce_admins=false` + chongwon83 admin = 표준 bypass. `--field sha=<head>` 추가로 race 차단 권장 |
| **Q3**: infra PR 우선 머지 → workflow_dispatch로 B.6 트리거? | ⚠️ 가능하지만 위험↑. infra PR 자체 CI도 같은 outage 영향. `workflow_dispatch:` 1줄만 추가 + job 무변경이면 통제 가능 |
| **Q4**: 안전 순서 | (a) 대기→empty commit / (b) 지금 1회 probe / (c) close+reopen / (d) admin merge now / (e) infra PR 먼저 |

**Verdict 직역**: "do `a` if you can wait" — owner 선택 (1) 대기와 정확히 일치.

---

## 1단계 — 회복 확인 (1시간 후 첫 액션)

```bash
curl -sS https://www.githubstatus.com/api/v2/components.json \
  | jq -r '.components[] | select(.name=="Actions") | "\(.status) (updated \(.updated_at))"'
```

판정:

| 결과 | 액션 |
|------|------|
| `operational` 또는 `monitoring` | → 2단계 진입 |
| `degraded_performance` 여전 | → 추가 1시간 대기 또는 § "비상 옵션" 검토 |
| `partial_outage` / `major_outage` 재악화 | → 계속 대기, owner 보고 |

병행 — 진행 중 인시던트 본문 확인:

```bash
curl -sS https://www.githubstatus.com/api/v2/incidents/unresolved.json \
  | jq '.incidents[] | select(.components[]?.name | test("Actions"; "i"))
        | {name, status, impact, latest: .incident_updates[0].body}'
```

---

## 2단계 — B.6 CI retrigger (Actions 회복 확인 후)

```bash
cd "/Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web"
git switch track-b/b6-motion-tokens
git commit --allow-empty -m "chore: retrigger CI after Actions outage recovery"
git push
```

5~10초 후 확인:

```bash
gh run list --branch track-b/b6-motion-tokens --limit 5
```

기대: `CI` / `parity-test` / `security-test` 3종 run 출현 (event=push). 안 보이면:

```bash
# fallback 1: close+reopen
gh pr close 30 -R chongwon83/coconutlabs
gh pr reopen 30 -R chongwon83/coconutlabs

# fallback 2: 그래도 0건이면 owner 보고 + § 비상 옵션 검토
```

---

## 3단계 — CI 8/8 green 확인 후 admin merge

```bash
# 게이트 확인
gh pr checks 30
gh pr view 30 --json mergeStateStatus,statusCheckRollup --jq '{state: .mergeStateStatus, checks: [.statusCheckRollup[] | {name, state: (.conclusion // .state)}]}'
```

모두 SUCCESS면 (worktree-safe, sha-pinned):

```bash
gh api -X PUT /repos/chongwon83/coconutlabs/pulls/30/merge \
  --field merge_method=squash \
  --field sha=1f90e677ada2ca39b9f11570df5e3d7857b8b02b
```

기대 응답: `200` + `{"merged": true, "sha": "<new-squash-sha>"}`. 에러 코드:

| 코드 | 의미 | 대응 |
|------|------|------|
| 403 | 권한 또는 ruleset bypass 차단 | branch protection 재조회, enforce_admins 확인 |
| 405 | merge method 차단 또는 PR 타입 (draft 등) | merge_method 변경 또는 PR ready 처리 |
| 409 | head SHA 이동 (PR에 새 커밋) | `gh pr view 30 --json headRefOid` 로 SHA 갱신 후 재시도 |

머지 후:

```bash
git checkout main
git pull origin main
git log -1 --oneline   # squash commit 확인
```

---

## 4단계 — infra PR (workflow_dispatch 추가) 진행

기존 plan 그대로 따른다 — 본 핸드오프 작성 시점 이미 lock된 plan:

```
/Users/dg-2412-pn-002/.claude/plans/docs-handoff-2026-05-26-b5-exit-md-melodic-crystal.md
```

핵심만 요약:

1. main 동기화
2. `infra/workflow-dispatch-outage-safety` 브랜치 생성
3. 3 파일에 `workflow_dispatch:` 1줄씩 추가 (`ci.yml`, `parity-test.yml`, `security-test.yml`)
4. YAML lint + 로컬 검증
5. PR 생성 (CI 8/8 자체 통과 확인)
6. `gh api -X PUT /merge` 머지
7. main에서 `gh workflow run "CI" --ref main` 1회 smoke test

---

## 비상 옵션 (대기 길어질 시 — 지금은 권장 안 함)

owner가 추후 마음 바뀌면 사용. **회복 신호 없이 능동 발동 금지**.

### 옵션 (d) — CSS-only admin bypass 즉시 merge

PR #30 은 pure CSS refactor (motion tokens). 로컬에서 모든 게이트 통과
(typecheck/lint, bun test 267/267, e2e 52/52, design.md lint error 0).
/codex 1차 REVISE → 2차 APPROVE 완료. CI 미실행 머지 기록이 main에 남는
것을 owner가 수용하면 즉시 가능.

```bash
gh api -X PUT /repos/chongwon83/coconutlabs/pulls/30/merge \
  --field merge_method=squash \
  --field sha=1f90e677ada2ca39b9f11570df5e3d7857b8b02b
```

### 옵션 (e) — infra PR 먼저 머지 → workflow_dispatch로 B.6 트리거

순서 역전. infra PR 자체 CI도 outage 영향이라 admin bypass 두 번 누적.
실용 가치는 "향후 동일 incident 시 영구적 unblock 수단 확보". 위험 누적이
허용 가능할 때만.

---

## 위반 금지 invariants (1시간 후 작업 시도 절대 위반 X)

- `lib/validateSummary.ts:52` VerifLevel 4-union 무수정
- `lib/validateSummary.ts:48` TOOLS 2-union 무수정
- `JoinBurnIndexForm` props는 `{ onSuccess, onImport }` 2개뿐
- `aria-live="polite"` (assertive 아님)
- DESIGN.md lint error 0
- BurnSummaryEnvelope schemaVersion=2
- E2E selector `.lb-row .lb-handle` + `[role='columnheader']` 보존
- Korean copy: `"리더보드에 추가되었어요"` + `"리더보드 보기"`

---

## 운영 메모 (1시간 후도 유효)

- PR merge 명령은 **반드시** `gh api -X PUT /repos/chongwon83/coconutlabs/pulls/<N>/merge --field merge_method=squash` — `gh pr merge`는 worktree 충돌 위험 (memory: `feedback_gh-pr-merge-worktree-conflict`).
- coconutlabs는 chongwon83 솔로 — PR review request 없이 바로 merge (memory: `feedback_coconutlabs-solo-no-review-request`).
- `/codex` 호출은 **default gpt-5.5만** — `-m gpt-5-codex`는 silent hang (memory: `feedback_codex-cli-gpt5-codev-unavailable`).
- workflow YAML 변경 시 macOS local에서 visual PNG commit 금지 — Linux CI workflow_dispatch만.
- UI 작업이 아닌 infra/CI 변경 — Claude-in-Chrome verify 불필요. CI 자체 통과가 1차 verify.

---

## 보존해야 할 untracked items

작업과 무관, 별도 지시 없으면 그대로 둔다:

- `.gstack/`
- `tasks/F1-nonce-atomic-del-backlog.md`
- `tasks/folder-picker-ux-finding1/SESSION_HANDOFF.md`
- `tasks/token-path-real-verify/SESSION_HANDOFF.md`

---

## 만약 1시간 후도 outage 지속 시

옵션 트리:

1. 4시간 누적 outage → owner에게 § 비상 옵션 (d) 또는 (e) 결정 요청
2. 8시간 누적 outage → CSS-only refactor의 가치 < 추가 대기 비용 → (d) 강하게 권장
3. 24시간 누적 outage → 별도 incident 후처리 워크플로우 진입 (이 핸드오프 범위 외)
