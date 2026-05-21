# Plan v2 Delta — Codex Phase 1 Mitigation

**Date**: 2026-05-21
**Base plan**: `~/.claude/plans/p1-rollout-lazy-trinket.md`
**Codex verdict**: `needs-attention` (PARTIAL — 1 in-scope MEDIUM finding + 2 out-of-scope critical/high alerts)

본 delta는 Codex Phase 1 적대적 리뷰에서 식별된 in-scope 결함(Finding #3)을 반영한 변경 사항만 기술. base plan의 나머지 섹션은 변경 없음.

---

## §A. Codex Findings 요약

| # | Severity | 범위 | 처리 |
|---|----------|------|------|
| 1 | **critical** | **out-of-scope** | PyPI recovery codes 평문 working tree 노출 — 별 즉시 처리 (owner 액션) |
| 2 | **high** | **out-of-scope** | e2e onboarding test 비-hermetic, 실 backend 오염 가능 — 별 사이클 |
| 3 | **medium** | **in-scope** | `pickFolder()` saveHandle 실패가 hard blocker — 본 plan v2 반영 |

---

## §B. In-scope Mitigation (Finding #3) — S2 재작성 로직 변경

### B.1 변경 의도

현 base plan의 S2 재작성은 `pickFolder()`의 catch 블록을 4분기로 확장하는 데 그침. 그러나 picker 성공 후 `saveHandle()` 실패 시(IDB 차단/quota/managed browser/DataCloneError) handle React state가 set되지 않아 사용자가 **유효한 폴더를 선택했음에도 scan 진행 불가** + generic picker error로 오인 유도.

→ Picker 분기 / Name 검증 / Handle React state set / IDB persistence를 **4단계로 명시 분리**. IDB 실패는 non-fatal scoped warning.

### B.2 v2 pickFolder 로직 (의도 명세, 구현은 Phase 5)

다음 **4단계 의도**로 재작성. 코드 스니펫은 Generator(Phase 5)가 결정:

**Step 1 — Picker 호출 (DOMException 4분기)**
- `AbortError` → `return` (silent)
- `SecurityError` → `setFsaError("Chrome blocked that folder…")`
- `NotAllowedError` → `setFsaError("Read access wasn't granted…")`
- 그 외 → `setFsaError("Couldn't open the folder picker…")`

**Step 2 — Name 검증**
- `h.name !== expectedName` → `setFsaError("You picked **${h.name}**. We need…")` + return

**Step 3 — Handle React state 즉시 set (saveHandle 전)**
- `setFsaError("")` + `setFsaWarning("")` (양 channel 모두 clear)
- `setClaudeHandle(h)` 또는 `setCodexHandle(h)`
- 이 시점에서 **scan 진행 가능** (handle in-memory 유효)

**Step 4 — IDB persistence (non-fatal try-catch)**
- `await saveHandle(kind, h)` 별도 try-catch
- 실패 시 `setFsaWarning("Folder selected for this session, but it could not be remembered. You may need to re-select on next visit.")`
- `fsaError`는 빈 채로 유지 — picker는 정상 진행

### B.3 신규 React state

- `const [fsaWarning, setFsaWarning] = useState<string>("")` 추가
- 기존 `fsaError`와 별도 channel — non-blocking scoped warning 전용
- 두 channel은 동시 노출 가능 (예: 새 폴더 mismatch 후 재선택 시 warning만 잔존)

### B.4 신규 CSS class

- `.form-warning` 신규 — `.form-error`와 시각적으로 구분 (예: `--young-coconut-dark` 1px border + `--fg2` text + 작은 padding)
- raw hex 금지, token reuse만
- DESIGN.md `## Components` 섹션 entry 추가 검토 (Phase 3 design-review에서 결정)

---

## §C. Success Criteria 추가 (Must-pass #7)

base plan §성공조건의 Must-pass 6개 + 다음 1개 추가:

7. **[error]** `saveHandle()` 실패 (IDB 차단/quota/DataCloneError) 시 다음 모두 충족:
   - Handle React state는 정상 set (claudeHandle/codexHandle null이 아님)
   - `fsaError` 빈 상태 유지 (picker는 성공으로 표시)
   - `fsaWarning`에 "could not be remembered" 메시지 노출
   - 사용자가 scan 진행 가능 (button disabled 아님)

---

## §D. Invariant 추가 (#5)

base plan §중단조건의 4 invariants + 다음 1개 추가:

5. **Handle React state ≠ IDB persistence**: `pickFolder()` 안에서 `setClaudeHandle()`/`setCodexHandle()` 호출이 `saveHandle()` 결과에 의존하면 머지 차단. 반드시 picker name 검증 직후 set, IDB save는 별도 try-catch.

---

## §E. Phase 6 Cell 추가 (#7 IDB persistence failure)

base plan Phase 6의 6 cells + 다음 1개 추가 (owner 직접 실행, smoke-golden-regression.md에 손으로 ✅/❌ 기록):

| # | 입력 | 기대 결과 |
|---|------|----------|
| 7 | Chrome DevTools > Application > Storage > Clear site data → IndexedDB throttle (또는 Brave/managed mode 시뮬레이션) → `~/.claude/projects` 선택 | Handle UI에 ✓ 표시 (claudeHandle set), `fsaError` 비어 있음, `fsaWarning`에 "could not be remembered" 노출. Scan 버튼 enabled. 새로고침 후 handle 재선택 필요 (정상 동작) |

> 💡 IDB block 시뮬레이션이 Chrome DevTools에서 직접 불가하면 cell #7은 "코드 검사로 갈음" 명시 — `saveHandle` 호출을 임시로 `throw new Error("test")`로 바꿔 dev server 실행 후 확인.

---

## §F. 변경 파일 영향 라인 수 갱신

| 파일 | base plan 예상 | v2 갱신 | 차이 |
|------|----------------|---------|------|
| `components/forms/JoinBurnIndexForm.tsx` | ~+80/-15 | **~+105/-15** | +25 (IDB 분리 try-catch + fsaWarning state + JSX warning slot) |
| `app/globals.css` | ~+30/-0 | **~+38/-0** | +8 (`.form-warning` 신규 클래스) |
| `DESIGN.md` | ~+10/-0 (조건부) | ~+10/-0 (조건부) | 변동 없음 (Phase 3에서 결정) |

총 핵심 코드 변경: **~110 lines → ~143 lines**.

---

## §G. Out-of-scope Critical Alerts (Owner 액션 필요)

본 plan 범위 밖이지만 Codex 식별 severity critical/high 항목. owner 즉시/별 사이클 처리 권고.

### G.1 [critical] PyPI recovery codes 평문 노출

- **위치**: `credentials/PyPI-Recovery-Codes-chongwon5026-2026-05-21T07_35_20.758710.txt` (working tree에 실존 확인)
- **위험**: 8개 recovery code 평문. `.gitignore`에 `credentials/` 미포함 → commit/zip/upload 시 노출
- **owner 즉시 액션 (4종)**:
  1. PyPI 콘솔에서 recovery codes **재발급** (파일 삭제만으론 부족 — 노출 자체로 인증 무효화)
  2. `credentials/PyPI-Recovery-Codes-chongwon5026-2026-05-21T07_35_20.758710.txt` 파일 삭제
  3. `.gitignore`에 `credentials/` 추가
  4. `git log --all --full-history -- credentials/` 또는 `git rev-list --all | xargs git grep "PyPI-Recovery"`로 git history 노출 여부 확인

### G.2 [high] e2e onboarding test 비-hermetic

- **위치**: `e2e/onboarding-30s.spec.ts:93-97`
- **위험**: `/api/internal/issue-collector-token` + `/api/burnindex` mock 안 함 → 로컬 `.env.local` + Upstash configured 환경에서 synthetic `abc123def456` project hash + `@e2e-30s-*` handle 5개 실 Redis로 주입 가능. `BURN_STORE=memory`는 leaderboard만 isolate, token Redis/rollout metrics는 미보호. `reuseExistingServer`로 우회 가능
- **별 사이클 권고**: 본 사이클 plan 범위 밖. 별도 작업으로 (a) route/mock token issuance + `/api/burnindex` (b) 전용 test Redis namespace + cleanup (c) e2e 실행 시 freshly launched server 강제 + metrics writes namespace 분리

---

## §H. 다음 단계

1. owner: §G.1 즉시 처리 (PyPI 재발급 + 파일 삭제 + gitignore + history 검증)
2. owner: §G.2를 별도 task로 backlog 등록 (본 사이클 진행 차단 아님)
3. 본 사이클: Phase 3 (`/plan-design-review`) 진입 — v2 delta + `design-review-phase3.md` 입력
4. Phase 3 PASS 시 Phase 4 (Plan v3 또는 v2 그대로) → Phase 5 구현

---

## §I. Phase 2 self-check (Planner contract/criteria spot check)

본 v2 delta는 **무엇을·왜·어떤 분기 기준으로**만 기술. 코드 스니펫·diff·라인 단위 수정 지시 ✅ **없음**. Step 1~4 의도 명세는 Generator(Phase 5)가 실제 코드로 옮길 때 결정. 구현 권한 위반 흔적 0.
