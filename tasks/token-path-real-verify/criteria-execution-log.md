# Review Harness — token-path-real-verify (2026-05-22)

> 평가기준 출처: `tasks/token-path-real-verify/criteria.md` (10항목)
> 사이클: token-path-real-verify (Codex Phase 2 follow-up #1)
> Plan: `~/.claude/plans/rosy-greeting-crab.md` Option C

---

## ① 테스트 실행 결과

### Target test (`burn-route-token-integration`)

```
npm test -- burn-route-token-integration

 Test Files  1 passed (1)
      Tests  10 passed (10)
   Start at  20:29:24
   Duration  167ms
```

### Full regression

```
npm test

 Test Files  18 passed (18)   ← 기존 17 + 신규 1
      Tests  244 passed (244)
   Start at  20:29:31
   Duration  349ms
```

### Invariant grep (정적 검증)

```
grep -E 'vi\.mock.*server/burn/token|verifyAndConsumeToken: vi\.fn' \
  __tests__/burn-route-token-integration.test.ts
# 결과: (빈 결과) exit=1 → 0 matches ✅
```

### Sanity check (임시 mock 주입 → revert)

`verifyAndConsumeToken`을 강제 `{ ok: true }` mock으로 임시 주입 시:

```
 Test Files  1 failed (1)
      Tests  7 failed | 3 passed (10)
   ❌ case 2 (missing Authorization 401)
   ❌ case 3 (malformed token 401)
   ❌ case 4 (expired token 401)
   ❌ case 5 (wrong-kind 401)
   ❌ case 7 (tampered signature 401)
   ❌ case 8 (8-replay nonce consumed 401)
   ❌ case 10 (cross-kind telemetry 401)
```

→ 본 파일이 **진짜 token 경로**를 검증한다는 사실 증명. mock revert 후 10/10 PASS 복귀.

> Note: case 6 (nonce reuse) 은 mock 우회 시에도 일부 통과. 이유: bypass mock이 nonce delete를 호출하지 않아 2회차도 우연히 통과. 본 invariant 검증의 본질(signature/kind/expiry 우회 시 fail)은 영향 없음.

---

## ② 평가기준 통과 여부 표

### A. 진짜 token 경로 검증 (invariant)

| # | 항목 | 상태 | 근거 |
|---|------|------|------|
| 1 | `@/lib/server/burn/token` 모듈 mock 금지 | ✅ | grep 0 matches (exit=1) |
| 2 | 임시 token mock 시 6+ 케이스 FAIL | ✅ | sanity check 7 FAIL (cases 2/3/4/5/7/8-replay/10) |
| 3 | `issueToken` real path 사용 | ✅ | line 9 real import + 케이스 1·6·8·9·10에서 `issueToken("burnindex"\|"telemetry")` 호출 |

### B. Route handler 진짜 호출

| # | 항목 | 상태 | 근거 |
|---|------|------|------|
| 4 | `new Request(...)` + dynamic `await import()` + `POST(req)` | ✅ | period-gate.test.ts 패턴 차용, supertest/MSW 미사용 |
| 5 | Authorization header parsing 검증 | ✅ | case 2: missing header → 401 + `expect(upsertEntry).not.toHaveBeenCalled()` |

### C. Token 스펙 8 + telemetry 2 케이스

| # | 항목 | 상태 | 근거 |
|---|------|------|------|
| 6 | burnindex 8 케이스 (valid/missing/malformed/expired/wrong-kind/nonce-reuse/tampered/store-throws) | ✅ | 케이스 1~8 모두 PASS, reason string assertion 포함 |
| 7 | telemetry 2 케이스 (valid + cross-kind) | ✅ | 케이스 9·10 PASS, recordAutoDetectStarted 1회 호출 검증 |

### D. Mock 정책

| # | 항목 | 상태 | 근거 |
|---|------|------|------|
| 8 | `@upstash/redis` in-memory Map + downstream 5종만 mock | ✅ | burn-token.test.ts Redis 패턴 + period-gate downstream 패턴 차용, token 모듈 mock 0건 |
| 9 | 환경 변수 = burn-token.test.ts 값 재사용 | ✅ | `COLLECTOR_HMAC_SECRET="test-secret-value-that-is-long-enough-32chars"`, `COLLECTOR_TOKEN_TTL_SECONDS="300"` — 하드코드 비밀 logging 0건 |

### E. 회귀 안전

| # | 항목 | 상태 | 근거 |
|---|------|------|------|
| 10 | 전체 회귀 0 실패 | ✅ | 18 test files × 244 tests PASS, 기존 burn-token.test.ts·burn-api-period-gate.test.ts 보존 |

---

## ③ 미통과 사유 + 다음 액션

| # | 항목 | 상태 |
|---|------|------|
| — | — | 없음 (10/10 ✅, 통과율 100%) |

---

## 보안 행 의무 (S8 다음 단계)

본 사이클은 인증 경계 신규 다룸 → 정책상 의무:

- ⏳ **/codex 의무** — 적대적 검증 (token 스펙 변경 detect 여부, 케이스 누락, sanity check 회피 패턴 점검)
- ⏳ **/cso 의무** — HMAC/timingSafeEqual/nonce 보안 invariant 보존 여부 점검

> /codex와 /cso는 owner 명시 호출. 본 작업자(subagent) 권한 외.

---

## 산출물 sha256 (체크포인트)

```
__tests__/burn-route-token-integration.test.ts       (신규)
tasks/token-path-real-verify/criteria.md             (신규)
tasks/token-path-real-verify/criteria-execution-log.md (본 파일)
tasks/hygiene-and-e2e/unverified.md                  (#1 resolved 마킹)
docs/decision/decision-log.md                        (S0 entry append)
```

owner 다음 액션: `/codex` + `/cso` 호출 후 통과하면 S9 commit + push (solo, no PR).
