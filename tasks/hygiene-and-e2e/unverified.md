# Unverified — Hygiene + e2e Phase #1 (2026-05-22)

미통과 / 미검증 / Codex Phase 2 follow-up 항목 + 차후 액션.

---

## Planner contract/criteria spot check

**Planner spot check**: contract/criteria 섹션에 코드 스니펫·diff·라인 단위 지시 ✅ 없음.

근거:
- `criteria.md` 10항목은 모두 [security.md] [coding.md] [decision-log] anchor 기반 평가 기준. 코드 작성 지시 없음
- 본 사이클은 Planner subagent를 발동시키지 않은 spec-only fixup. PGE 골격 미적용
- 따라서 Planner 권한 0 침범 위험 0건

---

## Codex Phase 2 follow-up (deferred, merge unblock)

Codex Phase 2 verdict: **CONDITIONAL APPROVE** — 2 follow-up 항목을 본 사이클에 포함하지 않고 다음 사이클 backlog로 이관.

### #1 [P2] Token-path real verification unit test

**상태**: ✅ [resolved by `__tests__/burn-route-token-integration.test.ts` 2026-05-22, Option C — route-layer integration]

**해결 요약**: Plan `~/.claude/plans/rosy-greeting-crab.md` Option C 채택. unverified.md 액면가(B1) `__tests__/burn-token-verify.test.ts`는 commit 8e435d2 `burn-token.test.ts`와 100% 중복으로 폐기. 진짜 gap이 route layer(e2e `route.fulfill` + period-gate.test.ts `vi.mock` 우회)에 있다는 사전 조사 결과를 반영해 `/api/burnindex` POST + `/api/telemetry/auto-detect` POST 양쪽에 real-issued token 경유 통합 테스트 10케이스 추가. invariant: `@/lib/server/burn/token` 모듈 mock 0건 (sanity check 통과 — 임시 mock 추가 시 cases 3/4/5/7/8/10 + 8-replay 총 7 fail로 진짜 token 경로 검증 자체 증명).

**문제** (원본 기록 보존): e2e stub이 `verifyAndConsumeToken` (`lib/server/burn/token.ts:94`)를 우회. 향후 token 스펙 변경 (예: 새 claim 추가, header 검증 강화) 시 e2e는 그린이지만 prod는 500.

**필요 작업**:
- `__tests__/burn-token-verify.test.ts` 신규 작성
- 테스트 케이스: ① malformed token, ② wrong-kind ("collector" vs "burnindex"), ③ expired (TTL 경과), ④ reused nonce (Redis nonce delete 후 재사용 거부), ⑤ valid HMAC + valid Redis nonce → consume 후 nonce 삭제
- Redis fake: `ioredis-mock` 또는 lightweight in-memory map. 실제 Upstash 의존성 없음
- HMAC 서명: `COLLECTOR_HMAC_SECRET` 픽스처로 직접 서명 → 토큰 생성

**우선순위**: P2 (production drift 검출용, 다음 사이클 또는 token 스펙 변경 PR과 동시 추가)

**owner 다음 액션**: 다음 cycle plan에 "token verify 실제 경로 unit test" 항목 추가

### #2 [P2] CI retry policy 검토

**문제**: `playwright.config.ts:25` `retries: process.env.CI ? 1 : 0` — CI에서 retry=1 허용. 1회차 실패 + 2회차 성공이면 flake가 silent하게 회피 → real bug 은폐 가능.

**필요 작업**:
- 옵션 A: `retries: 0` 으로 통일 (CI에서도 first-pass green 강제)
- 옵션 B: retry=1 유지 + `reporter` 에 retry 카운트 출력 → 매 PR 리뷰 시 retry 발생 여부 확인 의무
- 옵션 C: 현 상태 유지 + CI run history (`gh run list`) 주기 점검으로 보완

**우선순위**: P2 (지금 PASS 3건 모두 retry 0회. 향후 flake 발생 시 재평가)

**owner 다음 액션**: 별도 PR로 분리. 본 fixup cycle 영향 0건이므로 본 commit에 포함하지 않음.

---

## Phase 2 input premise 정정 메모

`tasks/hygiene-and-e2e/codex-phase2-input.md` Q3 본문에 다음 문구 있음:
> `workers: 1` + `reuseExistingServer: !!process.env.CI` means tests share the dev server

**정정**: 실제 `playwright.config.ts:25` 는 `reuseExistingServer: !process.env.CI` (NOT `!!process.env.CI`).
- 의미: **CI 환경에서는 fresh server 보장** (reuseExistingServer=false), 로컬에서는 reuse.
- Codex Phase 2 Q3 응답에서 이 정정을 반영 → "CI에선 누적 contamination 위험 없음" 결론은 그대로 유지.

본 메모는 future-self/리뷰어가 phase2-input.md를 다시 읽을 때 혼동 방지용. **commit message에 별도 명시 안 함** (sentence-level typo, mitigation 결과 변동 없음).

---

## Phase 1 mitigation 채택 표 (참고)

| Codex Q | Severity | 채택 여부 | 적용 위치 |
|---------|----------|----------|----------|
| Q1 (token verify path) | P0 | ✅ 채택 (직접) | `burn-import:233-271`, `onboarding-30s:67-99` |
| Q2 (9-field bypass) | P2 | ✅ 채택 (간접) | unit test `__tests__/burn-server-whitelist.test.ts` 무변경 유지 |
| Q3 (regex brittleness) | P2 | ✅ 채택 | `burn-import:368-372` regex 정밀화 |
| Q4 (race condition) | P3 | ✅ 채택 | `burn-import:299-302` POST predicate |
| Q5 (CI retries) | P3 | ⏸️ 보류 | follow-up #2 (위) |
| Q6 (BURN_STORE accumulation) | P3 | ✅ 채택 (간접) | `workers=1` + unique handle 유지 |

---

## 평가기준 미통과 항목

| # | 항목 | 상태 |
|---|------|------|
| — | — | 없음 (`criteria-execution-log.md` 통과율 9/10 ✅ + 1/10 ⏳ Step 8에서 검증) |

---

## 다음 사이클 backlog (참고)

- follow-up #1: token verify unit test (별도 cycle)
- follow-up #2: CI retry policy 검토 (별도 PR)
- folder-picker-ux finding 1 cycle 후속: auto-detect 전체 활성화 절차 (memory `project_auto-detect-flip-procedure.md` — Axis 1 ≥ 15 후 Vercel env `NEXT_PUBLIC_AUTO_DETECT_DEFAULT=true`)
