# Codex Phase 1 — Adversarial Review (before fixup)

**Date**: 2026-05-22
**Owner**: chongwon83 (solo)
**Cycle**: Hygiene + e2e Phase #1 — CI e2e 3-spec fixup
**Working dir**: `web/`
**Trigger plan**: `.claude/plans/structured-pondering-ritchie.md`

---

## 1. Context (왜 이 리뷰가 필요한가)

핸드오프 작성자가 Phase #1을 "신규 인프라 60~75분 헤비 작업"으로 기록했으나 실제 git에는 `playwright.config.ts` + `e2e/burn-import-fsa-picker.spec.ts` (360줄, 2 test) + `e2e/onboarding-30s.spec.ts` (123줄, 1 test) + fixtures + CI yaml + package.json 모두 PR #8 (commits `edff1c7` + `378c034`, 2026-05-21)로 이미 머지 완료. 그러나 CI 5연속 failure — e2e 3 spec 전부 빨강.

진짜 잔여는 **이미 머지된 e2e specs를 컴포넌트 현재 상태에 맞춰 fixup**하는 것이지, 신규 인프라 작성이 아님. 원인 추정: 2026-05-22 folder-picker-ux finding 1 사이클에서 `JoinBurnIndexForm.tsx` 메시지/플로우를 손보면서 spec과 desync.

위험 3축 (재평가): **0~1/3 (라이트)** — spec 수정만, 컴포넌트 무변경, deterministic 즉시 검출 가능. 그러나 owner가 검증 분리 + codex 교차 리뷰 명시 요청 → 본 리뷰 발동.

---

## 2. Root Cause Analysis (구현자가 본 단정)

### 2.1 Happy path (`burn-import-fsa-picker.spec.ts:221-317`)

**증상**: `expect(postCount).toBe(1)` received 0. `await responseReady = page.waitForResponse("**/api/burnindex")` 30s timeout.

**Root cause**: "Upload to leaderboard" 클릭 시 `JoinBurnIndexForm.tsx:246`이 `fetchCollectorToken("burnindex")` 호출 → `/api/internal/issue-collector-token` POST.

```typescript
// lib/client/burn/token.ts
export async function fetchCollectorToken(kind: TokenKind): Promise<string> {
  const res = await fetch("/api/internal/issue-collector-token", {...});
  if (!res.ok) throw new Error(`Token issuance failed: ${res.status}`);
  ...
}
```

토큰 엔드포인트는 Redis 의존:

```typescript
// app/api/internal/issue-collector-token/route.ts:46
const limit = await checkRateLimit(ip);
// → lib/server/burn/rateLimiter.ts:17
//   _redis = Redis.fromEnv();  // throws if UPSTASH_REDIS_REST_URL missing
```

`playwright.config.ts:16` 주석에서 **의도적으로 Redis URL 누락** (security boundary — dev `.env.local`이 e2e로 leak 금지). 결과:

```
rateLimiter throws → route.ts:60 catch → return 503
→ fetchCollectorToken throws → handleFsaUpload catch → setFsaError
→ POST /api/burnindex NEVER FIRES
→ spec waitForResponse timeout 30s
```

### 2.2 Reject (`burn-import-fsa-picker.spec.ts:321-358`)

**증상**: `getByText('Selected folder must be the .claude/projects (or .codex/sessions) directory itself, not your home directory. You selected "random-folder".')` not found.

**Root cause**: 컴포넌트 실제 메시지 (`JoinBurnIndexForm.tsx:159`):

```typescript
setFsaError(
  `You picked "${h.name}". We need the directory literally named "${expectedName}" (inside ~/.claude/ or ~/.codex/). Try again.`,
);
// expectedName = "projects" (kind === "claude")
```

Spec 기대 문자열이 옛 메시지. 컴포넌트 변경(folder-picker-ux finding 1 cycle 2026-05-22)에서 4 error.name 분기 도입 시 reject UX 단순화됨.

### 2.3 Onboarding-30s (`onboarding-30s.spec.ts:97`)

**증상**: `page.waitForSelector('div[role="status"]')` 120s timeout (toast 미발생).

**Root cause**: Phase 1 paste flow의 `handleConfirm` (JoinBurnIndexForm.tsx:368-373)도 `fetchCollectorToken("burnindex")` 호출 (L350). 2.1과 **동일 503 패턴** → onSuccess 미호출 → showToast 미실행 → toast div 미렌더링.

Toast 셀렉터 자체는 정확 (`components/Toast.tsx:22`):
```tsx
<div className="toast-v3" role="status" aria-live="polite">
```

---

## 3. Proposed Fix (spec-only, 컴포넌트 무변경)

### 3a. Happy path + Onboarding-30s — 토큰 엔드포인트 mock 추가

두 spec 모두 navigation 전에:

```typescript
await page.route("**/api/internal/issue-collector-token", async (route) => {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ token: "test-token-for-e2e" }),
  });
});
```

- Redis 의존성 우회 (security boundary 보존)
- HMAC issueToken 우회 (COLLECTOR_HMAC_SECRET 미주입 OK)
- 서버 측 토큰 검증 (POST /api/burnindex)이 e2e에서 어떻게 동작하는지 확인 필요 — 만약 서버가 토큰 verify면 mock token이 거절될 가능성

### 3b. Reject 케이스 — 문자열 교체

L350-352:
```typescript
// BEFORE
page.getByText(
  'Selected folder must be the .claude/projects (or .codex/sessions) directory itself, not your home directory. You selected "random-folder".',
)
// AFTER (regex partial — brittleness ↓)
page.getByText(
  /You picked "random-folder"\. We need the directory literally named "projects" \(inside ~\/\.claude\/ or ~\/\.codex\/\)\. Try again\./,
)
```

### 3c. Onboarding-30s — 셀렉터 유지

`div[role="status"]` 그대로 (Toast.tsx와 정합). 3a 토큰 mock만 추가하면 통과.

---

## 4. Dependency / Out-of-Scope Map

**수정 대상 (spec only)**:
- `e2e/burn-import-fsa-picker.spec.ts` — happy path token mock + reject 문자열
- `e2e/onboarding-30s.spec.ts` — token mock 추가

**절대 수정 금지 (invariant)**:
- `components/forms/JoinBurnIndexForm.tsx` — 컴포넌트 회귀 방지
- `playwright.config.ts` UPSTASH_REDIS_REST_URL — security boundary
- `app/api/internal/issue-collector-token/route.ts` — production fail-closed 유지
- `.github/workflows/ci.yml` — e2e job 정의 OK (CI 환경변수도 의도된 누락)

---

## 5. Adversarial Questions (codex에게 검증 요청)

**Q1. 서버 측 토큰 검증의 e2e 영향 (구현자 확정 — 검증 필요)**

`POST /api/burnindex` (`app/api/burnindex/route.ts:53-66`)가 `Authorization: Bearer <token>`를 받아 `verifyAndConsumeToken(rawToken, "burnindex")` 실행. 이 함수(`lib/server/burn/token.ts:94-134`):
1. `parseToken(raw)` — 4부분 미만이면 null
2. HMAC verify (`COLLECTOR_HMAC_SECRET` 필요)
3. nonce 단발사용 (Redis 필요)

Playwright config는 `BURN_STORE=memory`만 주입 — `UPSTASH_REDIS_REST_URL`/`COLLECTOR_HMAC_SECRET` **둘 다 없음**. 따라서:

| 시나리오 | 토큰 endpoint | /api/burnindex |
|----------|--------------|----------------|
| **happy path (FSA)** | spec mock 필요 | spec `route.fulfill` 이미 stub (L239-255) → server verifyToken 실행 안 됨 ✅ |
| **onboarding-30s (paste Phase 1)** | spec mock 필요 | **현재 stub 없음** — 실제 server 호출 → `parseToken("test-token")` null → 401 malformed token → toast 미발생 ❌ |

**제안 fix (구현자 결정)**: onboarding-30s에도 happy path와 동일한 `page.route("**/api/burnindex", ...)` POST stub 추가. 클라이언트 sends `Authorization: Bearer test-token` but stub fulfills before server sees it.

코덱스에게 묻는 것: 위 분석 정확? 더 깨끗한 우회 방법 있나? (옵션 c) `process.env.E2E_SKIP_TOKEN_VERIFY=1` 같은 server-side 플래그가 더 honest e2e인가, 아니면 stub이 우월?

**Q2. 9-field whitelist 검증 우회 가능성**
mock token으로 fake envelope을 보낼 수 있다면, 악의적 e2e가 production 검증을 우회하지 않나? happy path spec의 stub 패턴(`route.fulfill`)이 실제 서버 코드를 안 건드리므로 9-field 검증은 e2e에서 검증되지 않는다. 별도 unit test가 필요한가? (`__tests__/burn-server-whitelist.test.ts`가 이미 있다는 가정)

**Q3. Reject 메시지 regex brittleness (i18n / refactor 취약성)**
regex partial이 `getByText` 정확 매칭보다 안정적이긴 하나, 컴포넌트가 다음에 또 변경되면 (예: "We need" → "Need a directory named") 다시 깨진다. 안정적 대안: a) `data-testid="folder-name-mismatch-error"` 추가 b) error code 노출 (`data-error-code="folder-name-mismatch"`) c) regex 유지하되 핵심 단어 1개만 (`/random-folder/`)

**Q4. happy path postCount=1 가정의 race condition**
spec L284 `const responseReady = page.waitForResponse(...)` + L286 클릭 + L288 `await responseReady`. 만약 클릭 직후 POST가 fulfilled됐는데 waitForResponse가 그 응답을 놓치면? clock fix(L216 `page.clock.install`)가 token mock latency를 변경하는지? 토큰 fetch가 비동기 chain이라 race 가능?

**Q5. CI vs local divergence**
`playwright.config.ts:25 retries: process.env.CI ? 1 : 0`. CI에서 retry 1회 허용 — 만약 token mock이 첫 번째에 실패하고 두 번째에 성공하면 silent flake가 누적된다. retries: 0으로 강제해야 하나?

**Q6. onboarding-30s 5-run loop의 BURN_STORE 누적**
MemoryBurnStore는 process-local — 5 runs에서 5번 upsertEntry 호출. 각 run의 handle은 `@e2e-30s-${i}-${Date.now()}`로 unique하지만, 같은 process에서 누적된 5+ entries가 다음 spec (burn-import-fsa-picker)의 GET /api/burnindex 응답에 끼어들지 않나? Workers: 1 + reuseExistingServer가 격리를 깨는 시나리오?

---

## 6. Expected Codex Response Format

각 Q에 대해:
- **판정**: P0(블로커) / P1(중대) / P2(주의) / P3(개선)
- **근거**: 1-2줄
- **권장 mitigation**: 채택 가능한 1-3개 대안

P2+ 캐치는 즉시 spec 수정안에 반영. P3는 unverified.md에 기록.

---

## 7. 참고 파일 (codex가 직접 확인 가능)

- `web/components/forms/JoinBurnIndexForm.tsx` (705줄) — pickFolder L120-180, handleFsaUpload L240-410, handleConfirm L340-380
- `web/lib/client/burn/token.ts` — fetchCollectorToken
- `web/app/api/internal/issue-collector-token/route.ts` — 토큰 발급 (Redis + HMAC 의존)
- `web/lib/server/burn/rateLimiter.ts` — `Redis.fromEnv()` throw 동작
- `web/lib/server/burn/token.ts` (미확인) — issueToken + verifyToken 구현
- `web/lib/server/burnStore/index.ts` — getStore() factory, BURN_STORE 분기
- `web/playwright.config.ts` — 47줄, env BURN_STORE=memory만
- `web/e2e/burn-import-fsa-picker.spec.ts` (360줄) + `web/e2e/onboarding-30s.spec.ts` (123줄)
- `web/components/Toast.tsx` — toast div[role="status"]
- `web/components/LandingApp.tsx` L87-93 — showToast 정의

