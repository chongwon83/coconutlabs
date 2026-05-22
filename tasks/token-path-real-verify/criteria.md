# 평가기준 — token-path-real-verify (2026-05-22)

> 출처: `tasks/hygiene-and-e2e/unverified.md` #1 (Codex Phase 2 follow-up, P2)
> Plan: `~/.claude/plans/rosy-greeting-crab.md` Option C
> 위험 3축: 1/3 (③ 관찰가능성) + 보안 행 → /codex 의무 + /cso 의무

본 평가기준은 매 작업 새로 추출(캐시 금지). ADR/PRD/decision-log를 재스캔하여 본 작업의 평가 기준만 압축.

---

## 평가기준 (10항목)

### A. 진짜 token 경로 검증 (본 사이클 가치의 전부)

1. **[invariant] `@/lib/server/burn/token` 모듈 mock 금지** — 신규 파일 `__tests__/burn-route-token-integration.test.ts`에 `vi.mock("@/lib/server/burn/token", ...)` 또는 `verifyAndConsumeToken: vi.fn` 패턴 0건. 위반 시 burn-token.test.ts와 중복 — 본 사이클 가치 0.

2. **[sanity check] 임시 token mock 추가 시 6+ 케이스 FAIL** — 본 파일에 `verifyAndConsumeToken` 강제 ok mock을 1회 임시 주입했을 때 cases 2/3/4/5/6/7/10이 반드시 FAIL해야 함. PASS면 본 파일은 진짜 token 경로를 검증하지 않음 (burn-token.test.ts와 같은 단위 검증만).

3. **[invariant] `issueToken` real path 사용** — 케이스 1·6·8·9·10은 real `issueToken(kind)` → real serialize → Authorization header 경유. fixture token 직접 작성 금지(HMAC 우회 가능).

### B. Route handler 진짜 호출 (period-gate.test.ts 패턴 차용)

4. **[coding.md] `new Request(...)` + `await import("@/app/api/burnindex/route")` + `POST(req)`** — period-gate.test.ts:33,64-74 패턴 그대로. supertest/MSW 등 추가 의존성 도입 금지.

5. **[security.md] Authorization header parsing 검증** — 케이스 2(missing) → 401 + store 미호출. period-gate.test.ts:124-129 패턴 그대로 `expect(upsertEntry).not.toHaveBeenCalled()`.

### C. Token 스펙 8 케이스 + telemetry 2 케이스

6. **[unverified.md #1 spec] burnindex 8 케이스 cover** — ① valid → 201, ② missing Authorization → 401, ③ malformed → 401, ④ expired (parseToken+exp 과거+serializeToken) → 401 + `reason.toContain("expired")`, ⑤ wrong-kind (telemetry token → burnindex endpoint) → 401 + `reason.toContain("kind")`, ⑥ nonce reuse (1st 201, 2nd 401 + `reason.toMatch(/nonce/i)`), ⑦ tampered signature (slice+xxxx) → 401, ⑧ valid + store throws → 500 (token consumed).

7. **[unverified.md #1 spec] telemetry 2 케이스 cover** — ⑨ valid telemetry token + valid event → 200, ⑩ cross-kind (burnindex token → telemetry endpoint) → 401.

### D. Mock 정책 (security.md + decision-log 8e435d2 차용)

8. **[security.md] `@upstash/redis`만 in-memory Map mock + downstream mock 5종** — burn-token.test.ts:19-50 Redis 패턴 + period-gate.test.ts:15-30 downstream 패턴(`@/lib/server/store`, `@/lib/server/challenge`, `@/lib/server/trend`, `@/lib/server/burn/metrics`, `@/lib/client/burn/telemetry`) 차용. 그 외 추가 mock 금지.

9. **[security.md] 환경 변수 = burn-token.test.ts 값 재사용** — `COLLECTOR_HMAC_SECRET = "test-secret-value-that-is-long-enough-32chars"`, `COLLECTOR_TOKEN_TTL_SECONDS = "300"`. 하드코드 비밀 값 logging/console 출력 0건.

### E. 회귀 안전 (Review Harness Tier 1 #3)

10. **[Review Harness] 전체 회귀 0 실패** — `npm test` (target 단독) 신규 ≥ 10 PASS + `npm test` (full) 기존 17 테스트 파일 0 실패. burn-token.test.ts·burn-api-period-gate.test.ts 둘 다 보존 (삭제 금지 — 단위 정합성 유지).

---

## 통과 기준

- 1-10 모두 ✅ → owner "완료" 발화 가능
- 1 또는 2 또는 3 ❌ → **invariant 위반** → 본 파일 폐기 후 재설계
- 4-10 중 일부 ❌ → 미통과 사유 + 다음 액션 (Review Harness #3) 산출 후 재시도 (한도 3회)

## 보안 행 의무 (위 통과와 무관)

- **/codex 의무** — 본 통합 테스트가 진짜 token 스펙 변경을 detect하는지 적대적 검증. 케이스 누락·sanity check 회피 패턴 점검.
- **/cso 의무** — HMAC/timingSafeEqual/nonce 보안 invariant 보존 여부 점검. 본 사이클은 코드 변경 없이 테스트만 추가지만 인증 경계 신규 다룸 → 정책상 의무.
