# Diff Summary — Hygiene + e2e Phase #1 (2026-05-22)

페이즈 산출물 diff 요약. 파일별 +/- 라인 + 변경 의도 1줄.

---

## 변경 파일 (spec-only invariant 준수)

```
 e2e/burn-import-fsa-picker.spec.ts | 65 +++++++++++++++++++++++++++++---------
 e2e/onboarding-30s.spec.ts         | 34 ++++++++++++++++++++
 2 files changed, 84 insertions(+), 15 deletions(-)
```

### 1. `e2e/burn-import-fsa-picker.spec.ts` (+65 / -15)

**변경 의도**: Phase 1 P0 token mock + Q3 P2 regex 정밀화 + Codex Phase 2 Q2 P3 overlay-first hardening.

| 위치 | 변경 종류 | 의도 |
|------|----------|------|
| L233-244 | 신규 추가 | `/api/internal/issue-collector-token` mock — `fetchCollectorToken("burnindex")`가 throw하지 않게 (`COLLECTOR_HMAC_SECRET` + Upstash Redis 없이 token 발급) |
| L246-271 | 신규 추가 | `/api/burnindex` POST stub + GET passthrough — `verifyAndConsumeToken` HMAC/Redis nonce 우회, GET leaderboard는 실제 BURN_STORE=memory 사용 |
| L273-281 | 수정 | manual "Join Burn Index" click 제거 → `.modal-overlay` visibility(2s) + "Select .claude/projects folder" 버튼 visibility(5s). `?auto-detect=1` auto-open과 호환 (folder-picker-ux finding 1 회귀 차단) |
| L299-302 | 수정 | `waitForResponse` URL 매칭 → POST predicate `(res) => res.url().includes("/api/burnindex") && res.request().method() === "POST"`. GET-on-mount 우연 매칭 차단 (Codex Q1 P3 race condition) |
| L362-371 | 수정 | reject 케이스 동일 overlay-first 패턴 적용 |
| L368-372 | 수정 | 기존 `Selected folder must be the .claude/projects ...` 문자열 → 실제 컴포넌트 메시지 regex `/You picked "random-folder"\. We need the directory literally named "projects" \(inside ~\/\.claude\/ or ~\/\.codex\/\)\. Try again\./` (component:`JoinBurnIndexForm.tsx:159`와 1:1 매칭). brittleness 낮추면서 user-supplied name + canonical name 양쪽 회귀 검출 |

### 2. `e2e/onboarding-30s.spec.ts` (+34 / -0)

**변경 의도**: burn-import와 동일한 token + POST stub 적용. 5-run loop 외부에 1회 설치 (page-scoped, leak 없음).

| 위치 | 변경 종류 | 의도 |
|------|----------|------|
| L67-80 | 신규 추가 | `/api/internal/issue-collector-token` mock — burn-import와 동일 |
| L82-99 | 신규 추가 | `/api/burnindex` POST stub + GET passthrough — 5-run iteration이 모두 동일 mock 공유, 매 iteration unique `@e2e-30s-${i}-${Date.now()}` handle 사용 (`L106` 기존 코드 유지) |

---

## 컴포넌트 무변경 (Invariant 보존)

| 파일 | 상태 | 검증 |
|------|------|------|
| `components/forms/JoinBurnIndexForm.tsx` | 무변경 | `git diff` 확인 |
| `components/LandingApp.tsx` | 무변경 | `git diff` 확인 |
| `components/Toast.tsx` | 무변경 | `git diff` 확인 |
| `app/api/burnindex/route.ts` | 무변경 | `git diff` 확인 |
| `lib/server/burn/token.ts` | 무변경 | `git diff` 확인 |
| `playwright.config.ts` | 무변경 | `git diff` 확인 |
| `.github/workflows/ci.yml` | 무변경 | `git diff` 확인 |

---

## 신규 산출물 (untracked)

```
tasks/hygiene-and-e2e/
├── codex-phase1-input.md           (10,217 bytes)
├── codex-phase2-input.md           (8,502 bytes)
├── criteria.md                     (2,986 bytes — B3 #1)
├── criteria-execution-log.md       (2,712 bytes — B3 #2)
├── diff.md                         (본 파일 — B3 #3)
├── unverified.md                   (작성 예정 — B3 #4)
├── smoke-golden-regression.md      (작성 예정 — B3 #5, owner 손기록)
└── SESSION_HANDOFF.md              (prior session, stale — Step 8에서 STALE 마킹)
```

---

## 테스트 결과

```
Running 3 tests using 1 worker
  3 passed (4.5s)
  onboarding-30s 5-run median: 120ms (threshold 30,000ms)
```

3 specs PASS, retries=0 (로컬), wall-clock 4.5s, deterministic threshold 250x 여유.
