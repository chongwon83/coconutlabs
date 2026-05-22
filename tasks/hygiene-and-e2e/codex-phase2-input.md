# Codex Phase 2 — Final Verification (post-fixup)

**Date**: 2026-05-22
**Owner**: chongwon83 (solo)
**Cycle**: Hygiene + e2e Phase #1 — CI e2e 3-spec fixup
**Phase 1 verdict**: NEEDS_REVISION → 6 mitigations adopted (P0/P2/P3 all addressed)
**Working dir**: `web/`

---

## 1. Phase 1 → Implementation Trace

| Codex Q | Codex Verdict | Mitigation adopted | Implementation site |
|---------|---------------|--------------------|---------------------|
| Q1 (token verify path) | P0 | `page.route("**/api/burnindex", POST→fulfill, GET→continue)` for both specs | `burn-import-fsa-picker.spec.ts:230-268`, `onboarding-30s.spec.ts:67-97` |
| Q1 (token endpoint) | P0 | `page.route("**/api/internal/issue-collector-token", fulfill {token: "test-token-for-e2e"})` | `burn-import-fsa-picker.spec.ts:233-244`, `onboarding-30s.spec.ts:74-80` |
| Q2 (9-field bypass) | P2 (covered) | `__tests__/burn-server-whitelist.test.ts` continues to assert server-side; e2e stubs do not weaken it | unchanged |
| Q3 (regex brittleness) | P2 | Regex includes BOTH `"random-folder"` AND `"projects"` — refactor-tolerant, name-mismatch-strict | `burn-import-fsa-picker.spec.ts:368-372` |
| Q4 (race condition) | P3 | Predicate-form `waitForResponse((res) => POST && /api/burnindex)` filters out GET-on-mount | `burn-import-fsa-picker.spec.ts:299-302` |
| Q5 (CI retries) | P3 (deferred) | retries:1 kept — flakes will surface in CI run history; explicit retries=0 not required | `playwright.config.ts:25` unchanged |
| Q6 (BURN_STORE accumulation) | P3 (covered) | `workers=1` + unique `@e2e-30s-${i}-${Date.now()}` handles already isolate runs | unchanged |

---

## 2. NEW finding during execution (not in Phase 1)

**Regression**: `?auto-detect=1` auto-opens the modal via `LandingApp.tsx:44-52` useEffect — when the spec previously clicked "Join Burn Index" button to open the modal, it was hitting a button behind the now-already-open `<div class="modal-overlay">`. Pointer events intercepted → click timeout 30s.

**Symptom in run #2 (after token mock applied)**:
```
Test timeout of 30000ms exceeded.
Error: locator.click: Test timeout of 30000ms exceeded.
  - <div class="modal-overlay">…</div> intercepts pointer events
```

**Root cause**: `LandingApp.tsx:46` — `searchParams?.get("auto-detect") === "1" && modal === null && !userClosedRef.current → setModal("join")`. This is the folder-picker-ux finding 1 cycle's "deferred auto-open" pattern (decision-log 2026-05-21). Spec was written before this auto-open behavior landed.

**Fix (spec-only)**: Remove the manual `Join Burn Index` click — replace with `expect(button).toBeVisible({timeout: 5_000})` to wait for modal to render itself. Applied to both happy path (L274-278) and reject (L362-366).

**Verification**: All 3 specs PASS in 4.5s wall clock.

---

## 3. Final Test Result

```
> web@0.1.0 test:e2e
> playwright test

Running 3 tests using 1 worker

[1/3] [chromium] › e2e/burn-import-fsa-picker.spec.ts:221:7 › happy path: picks projects folder → scan → POST has valid 9-field envelope
[2/3] [chromium] › e2e/burn-import-fsa-picker.spec.ts:342:7 › reject: wrong folder name shows error message and never POSTs
[3/3] [chromium] › e2e/onboarding-30s.spec.ts:66:5 › onboarding upload flow completes in ≤ 30 s (5-run median)
  run 1/5: 186 ms
  run 2/5: 124 ms
  run 3/5: 131 ms
  run 4/5: 127 ms
  run 5/5: 124 ms
  median  : 127 ms
  result  : PASS

3 passed (4.5s)
```

---

## 4. Diff Summary

```
e2e/burn-import-fsa-picker.spec.ts | 57 ++++++++++++++++++++++++++++----------
e2e/onboarding-30s.spec.ts         | 34 +++++++++++++++++++++++
2 files changed, 76 insertions(+), 15 deletions(-)
```

**Components unchanged** (invariant preserved): `JoinBurnIndexForm.tsx`, `LandingApp.tsx`, `Toast.tsx`, `app/api/burnindex/route.ts`, `lib/server/burn/token.ts`, `playwright.config.ts`, `.github/workflows/ci.yml`.

---

## 5. Final Adversarial Questions (Phase 2)

Please re-verify the following with the same rigor as Phase 1. **Goal**: merge readiness verdict.

### Q1. Stub vs reality drift

The two `page.route(...)` stubs simulate happy-path responses. **Is there a realistic production failure mode that these stubs HIDE from CI?**

- e.g., if `verifyAndConsumeToken` later changes to require a new claim, will CI continue green while prod 500s?
- e.g., if the client adds a new required header (`X-Idempotency-Key`?), will the stub still fulfill blindly?
- Should we add a complementary `__tests__/` unit test that exercises the **real** token verify path with a real HMAC signature against an in-memory Redis fake, to catch drift the e2e stub now masks?

Phase 1's Q2 already flagged this for 9-field whitelist. **Phase 2 asks: any OTHER hidden drift?**

### Q2. Auto-detect modal regression — spec hardening

The `?auto-detect=1` regression suggests the same pattern (auto-open behavior change) could recur. Two options:

- (a) Keep `expect(button).toBeVisible()` polling — works but silently waits up to 5s if the modal stops auto-opening
- (b) Assert `expect(page.locator(".modal-overlay")).toBeVisible({timeout: 1_000})` first, then assert the button — fails fast if auto-open regresses

Which is more robust? Or are both equivalent in practice?

### Q3. Token mock leakage across tests

Both spec files install `page.route` handlers. Playwright's default is **page-scoped** routes — they don't bleed across tests. But `workers: 1` + `reuseExistingServer: !!process.env.CI` means tests share the dev server. Could a stub-fulfilled response from spec A somehow influence spec B's server-side state (e.g., via session cookies, server in-memory BURN_STORE, or Next.js fetch cache)?

Specifically: `onboarding-30s.spec.ts` runs 5 iterations of paste→submit→toast within ONE test, and `burn-import-fsa-picker.spec.ts` happy-path runs once. If the dev server is reused, can state accumulate that flakes one of the two runs depending on order?

### Q4. Reject-test regex precision

The new regex:
```typescript
/You picked "random-folder"\. We need the directory literally named "projects" \(inside ~\/\.claude\/ or ~\/\.codex\/\)\. Try again\./
```

This matches `JoinBurnIndexForm.tsx:159` exactly. Phase 1's Q3 suggested using only `/random-folder/` for max brittleness reduction. We chose to keep BOTH `"random-folder"` AND `"projects"` to catch a regression where the component drops the user-supplied name from the error string (a real UX defect).

**Phase 2 ask**: Is this trade-off correct? Or should the regex be even tighter (full literal match) or even looser (`/random-folder.*projects/` only)?

### Q5. CI vs local divergence (final check)

Local: 3 PASS in 4.5s, workers=1, BURN_STORE=memory.
CI (`.github/workflows/ci.yml`): same Playwright config but inside Ubuntu, Chromium, node 20+. Any environmental difference that could cause local-PASS / CI-FAIL?

- Ubuntu's stricter file-permission semantics on `e2e/fixtures/projects/proj-a/session-2026-05-15.jsonl`?
- Chromium version differences between local dev and `mcr.microsoft.com/playwright` (no, we use `npx playwright install` not Docker)?
- `process.env.CI = "true"` enabling `retries: 1` — could a flake in run #1 succeed on retry and silently hide a real bug?

### Q6. Merge-readiness verdict

Given (a) all 3 tests PASS locally, (b) Phase 1's 6 mitigations all applied, (c) one additional regression caught and fixed mid-execution — give a final verdict:

- **APPROVE** — commit + push, expect CI green
- **CONDITIONAL APPROVE** — list of follow-up actions (unit test for token drift? CI retry=0 PR?) deferred to `unverified.md`
- **BLOCK** — find a P0/P1 risk and require fix before commit

---

## 6. Expected Codex Response Format

Per Q:
- **Verdict**: APPROVE / CONDITIONAL / BLOCK
- **Severity**: P0/P1/P2/P3
- **Rationale**: 1-2 lines
- **Required action** (if BLOCK or CONDITIONAL): 1-3 concrete next steps

Then **overall merge verdict** at the end.

---

## 7. Reference Files

- `web/e2e/burn-import-fsa-picker.spec.ts` (current, post-fixup, 379 lines)
- `web/e2e/onboarding-30s.spec.ts` (current, post-fixup, 158 lines)
- `web/components/LandingApp.tsx:44-52` (auto-open useEffect)
- `web/components/forms/JoinBurnIndexForm.tsx:159` (canonical reject message)
- `web/lib/server/burn/token.ts:94-134` (verifyAndConsumeToken — bypassed by stub)
- `web/app/api/burnindex/route.ts:51-66` (POST handler — bypassed by stub)
- `web/tasks/hygiene-and-e2e/codex-phase1-input.md` (Phase 1 baseline)
