# F1 Backlog — Nonce GET-then-DEL Atomicity

> 출처: CSO 감사 `.gstack/security-reports/2026-05-22-203503-token-path-real-verify.md` Phase 12 F1 (INFO)
> 발견 사이클: token-path-real-verify (2026-05-22)
> 상태: **pre-existing** — 본 사이클로 도입된 결함 아님. 본 사이클은 테스트만 추가, production code 0 변경.
> 우선순위: P2 (이론적 race, 실측 영향 미확인. token 스펙 변경 시 동시 처리 가드 필요)

---

## 문제

`lib/server/burn/token.ts:127-131`:

```ts
const exists = await redis.get(nonceKey);
if (!exists) {
  return { ok: false, status: 401, reason: "nonce already used or not issued" };
}
await redis.del(nonceKey);
```

GET → DEL이 **non-atomic**. 두 동시 요청(같은 valid token)이 둘 다 `exists=1`을 관찰한 뒤 양쪽이 DEL에 진입 → **single-use nonce가 사실상 2회 consume**.

### 위협 시나리오

- HMAC + nonce + kind + exp 모두 valid한 토큰을 공격자가 동시에 N회 POST
- 이론상 `verifyAndConsumeToken`은 1회만 성공해야 하지만, race 윈도우 안에서 다중 성공 가능
- 결과: 동일 토큰으로 `upsertEntry` (burnindex) 또는 `recordAutoDetectStarted` (telemetry)가 의도 외 다중 호출
- **실측 영향 미확인** — Upstash REST API의 직렬화 특성, 실제 동시 요청 분포에 따라 hit 빈도가 매우 낮을 수 있음

---

## 왜 본 사이클에서 처리 안 했나

1. **Pre-existing**: `git diff --stat HEAD` 결과 `lib/server/burn/token.ts` 무변경. CSO Phase 12에서 "본 cycle 도입 결함 아님" 확정
2. **사이클 scope 위반**: token-path-real-verify는 테스트 추가 cycle. token.ts 수정은 별 cycle (production code 변경 + `/codex` + `/cso` 재실행)
3. **회귀 가드 이미 확보**: 본 사이클 추가된 `__tests__/burn-route-token-integration.test.ts` case 6 (nonce reuse) + case 8 (8-replay)이 atomic 전환 후에도 그대로 PASS 해야 하므로 별 cycle에서 회귀 가드로 재사용 가능

---

## 대안 옵션

### Option A: DEL-first reply-count 패턴 (권장)

```ts
const deleted = await redis.del(nonceKey);
if (deleted === 0) {
  return { ok: false, status: 401, reason: "nonce already used or not issued" };
}
```

- Upstash Redis `DEL`은 삭제된 키 개수 반환. 1이면 본 요청이 winner, 0이면 이미 다른 요청이 consume
- 1 round-trip으로 atomic
- 부수효과: GET이 사라져 미발급/오타 nonce도 같은 응답 경로. 응답 reason 메시지 동일성 유지로 timing-leak 방지

### Option B: Lua script atomic check-and-delete

```lua
local v = redis.call('GET', KEYS[1])
if v then
  redis.call('DEL', KEYS[1])
  return 1
else
  return 0
end
```

- Upstash REST API의 Lua 지원 여부 사전 검증 필요 (`@upstash/redis` SDK `eval` 메서드)
- GET 결과를 함께 반환해 디버깅 친화적이지만 round-trip 1회는 Option A와 동일
- 복잡도 ↑, 이득 ↓ → Option A 선호

### Option C: 현 상태 유지 + 사후 모니터링

- 운영 로그에서 동일 nonce 2회+ verify 성공이 관측되면 그때 patching
- 단점: 사일런트 실패 가능 (관측 인프라 부재)
- 비추천

---

## 회귀 가드 (재사용 가능 자산)

`__tests__/burn-route-token-integration.test.ts` (294 lines):
- **case 6** (nonce reuse): 동일 토큰 2회 전송 → 1st: 201, 2nd: 401 reason matches /nonce/i
- **case 8** (8-replay sequential): nonce-consumed 후 same-token request → 401

위 두 케이스는 Option A/B 적용 후에도 통과해야 함. 통과 안 되면 회귀.

> 💡 단, 본 케이스는 **sequential**이라 race 자체를 재현하지 못함. 진짜 race 검증은 concurrent test 별도 추가 필요 (예: `Promise.all([POST, POST])` 후 1 성공 / 1 실패 assertion). Option A/B 적용 cycle 시 회귀 가드 case 11으로 추가 권장.

---

## 우선순위 판단

| 축 | 평가 | 근거 |
|-----|------|------|
| 실패비용 | Medium | 토큰 다중 consume → 데이터 멱등성 의존 (`upsertEntry`는 idempotent, telemetry는 카운트 부풀림 가능). DB rollback/사용자 통지 수준 아님 |
| 영향범위 | Low-Medium | `lib/server/burn/token.ts` 단일 파일, 영향 모듈은 `/api/burnindex` + `/api/telemetry/auto-detect` 2개 |
| 관찰가능성 | **High (사일런트 실패)** | 단위 테스트로 검출 불가, 운영 로그에 동일 nonce 다중 verify 흔적 없음 (현 구조상). 충족 |

→ 위험 3축 **1/3 (관찰가능성)** → 코덱스 교차 리뷰 **권장** (의무 아님). 보안 행이므로 `/cso` 병행.

---

## owner 다음 액션 (별 사이클)

1. **사이클 분리**: `tasks/nonce-atomic-del/` 신규 디렉토리
2. **S0 Decision Log**: 5줄 (문제 / Option A·B·C / 트레이드오프 / 선택 이유 / 강한 증거 — 본 backlog 파일이 강한 증거)
3. **S3 plan**: Option A 단순 수정 (~3줄 코드 변경) + concurrent test case 11 추가
4. **S6 구현**: TDD — case 11 RED 먼저 (현 코드에서 race 재현이 어렵다면 mock 시점 제어) → Option A 패치 → GREEN
5. **S8 게이트**:
   - `/codex` — Option A 패턴이 진짜 atomic 보장하는지, Upstash DEL 반환값 신뢰성 검증
   - `/cso` — HMAC/timingSafeEqual/nonce/fail-closed 4 invariant 보존 + DEL-first 전환이 새 사이드채널 안 만드는지
6. **S9**: 솔로 direct-push (`feedback_coconutlabs-solo-no-review-request.md`)

---

## 참조

- CSO 감사: `.gstack/security-reports/2026-05-22-203503-token-path-real-verify.md` (F1 detail)
- 본 사이클 plan: `~/.claude/plans/rosy-greeting-crab.md` (Option C, route-layer integration test)
- 본 사이클 commit: `2a18790` test(burn) + `bbdaa1e` docs(decision-log) S10
- decision-log entry: `docs/decision/decision-log.md` 2026-05-22 [Token-path real verify…]
