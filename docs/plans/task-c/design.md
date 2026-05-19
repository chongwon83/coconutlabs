# Task C — 규칙 기반 자동 triage 검증 파이프라인 (S3.5 Design)

> 분기점 `8ceb3ff` / worktree `coconut-task-c` / branch `task-c-verify`
> 상위 계획: `~/.claude/plans/modular-bubbling-ember.md`
> codex 교차 리뷰 6건 반영 — store 계층 무수정, write-time dedup 폐기.

## 1. 인터페이스 명세

`BurnStore`에 메서드 추가 **없음**. store 계층(`redisStore.ts`/`fileStore.ts`/
`types.ts`) **무수정**. triage·rate-limit은 `challenge.ts` 파생 함수로 흡수.

### 신규: `triageChallenge(claimedFixes, now)`

```ts
function triageChallenge(
  claimedFixes: number,
  now: string,
): { status: ChallengeStatus; verifiedFixes: number | null; verifiedAt: string | null }
```

- 입력: `claimedFixes` (route에서 이미 정수·≥1 검증된 값), `now` (ISO-8601 문자열)
- 규칙: `claimedFixes <= TRIAGE_THRESHOLD`(=5) → `{ status:"verified",
  verifiedFixes:claimedFixes, verifiedAt:now }`
- 초과: `{ status:"unverified", verifiedFixes:null, verifiedAt:null }`
- 순수 함수 — 부수효과·I/O 없음. THRESHOLD 경계(5)는 verified 포함.
- 예외: 던지지 않음. 입력은 호출 전 검증 완료 가정.

### 신규: `isRateLimited(handle, now)`

```ts
function isRateLimited(handle: string, now: string): Promise<boolean>
```

- `readChallenges()`로 전체 레코드 스캔 → 같은 `handle`의 `submittedAt`이
  `[now - RATE_LIMIT_WINDOW_MS, now]` 구간에 든 개수 카운트.
- 카운트 `>= RATE_LIMIT_MAX`(=5) → `true`.
- 신규 store 메서드·Redis TTL 키 **없음** → file/redis 동일 판정 (codex #2).
- 미래 `submittedAt`(시계 오차)은 `<= now` 조건으로 자연 제외.

### 상수

| 상수 | 값 | 의미 |
|------|-----|------|
| `TRIAGE_THRESHOLD` | 5 | 이하 claimedFixes는 자동 verified |
| `RATE_LIMIT_WINDOW_MS` | 3_600_000 | rate-limit 시간창 (1시간) |
| `RATE_LIMIT_MAX` | 5 | 시간창 내 허용 제출 수 |

## 2. 데이터 흐름

```
POST /api/challenge
  → request.json() 파싱 + shape 검증 (기존, 무변경)
  → isRateLimited(handle, now)
       true  → 429 { error } 반환, addChallenge 안 함
       false → triageChallenge(claimedFixes, now)
                 → ChallengeRecord { status, verifiedFixes, verifiedAt, ... }
                 → addChallenge(record)  (append-only, dedup 없음)
                 → 201 { record }
```

- write-time dedup **없음** (codex #1): 같은 `(handle,challenge)` 재제출도 독립
  레코드 append. LIST는 append-only 감사 이력. 최종 집계는 기존 read-time
  `verifiedFixesByHandle()` dedup이 handle별 최신값 산출 — 무변경.
- triage는 append 시점 1회 판정. 각 제출은 독립 `ChallengeRecord`.

## 3. 파일 경계

| 파일 | 변경 | 내용 |
|------|------|------|
| `lib/server/challenge.ts` | MODIFY | `triageChallenge`·`isRateLimited` 추가, 상수 export |
| `app/api/challenge/route.ts` | MODIFY | rate-limit(429) → triage 분기 |
| `scripts/store-contract-check.mjs` | MODIFY | 시나리오 5 수정 + triage·rate-limit 시나리오 추가 |
| `lib/server/burnStore/*` | 무수정 | store 계층 (codex #1) |
| `scripts/verify-challenge.mjs` | 무수정 | owner 수동 verify (unverified 큐 대상) |
| `lib/data.ts` | read-only | 공유 타입 |

## 4. 불변 조건 (invariants)

1. verified 자동 승급은 `1 <= claimedFixes <= 5`에서만. 6+ 는 항상 unverified.
2. `isRateLimited`는 백엔드 무관 동일 판정 — 같은 POST가 file/redis에서 같은 결과.
3. store 계층 무수정 — redisStore "newest-first" LIST·`LTRIM` 캡(500) 불변.
4. 각 제출은 독립 레코드 — 재제출이 과거 레코드를 변경하지 않음 (no-downgrade
   위반 불가, codex #3).
5. rate-limit 차단 시 `addChallenge` 호출 0 — 차단된 제출은 LIST에 안 들어감.
6. `verifiedFixesByHandle()` read-time 집계 무변경 — 리더보드 join 키 안정.

## 5. 알려진 한계 (codex 교차 리뷰 2026-05-20)

- **rate-limit은 check-then-append soft guard** (codex HIGH 채택·문서화): 같은
  handle의 동시 POST 여러 건이 같은 scan을 경쟁하면 모두 한도 미만으로 관측해
  통과할 수 있다. 원자적 보장은 Redis Lua 또는 신규 store 메서드가 필요한데,
  둘 다 본 계획의 "store 계층 무수정" 계약(codex #2 — file/redis 패리티)을 깬다.
  rate-limit은 자동 verified 경로의 **flooding 완충**이지 보안 경계가 아니며,
  신뢰 게이트는 triage THRESHOLD + owner의 unverified 큐 검토다. 프로토타입
  규모(5~20명)에서 동일 handle 동시 POST는 무시 가능 → 한계로 수용. 운영 데이터
  1개월 후 retro에서 원자적 rate-limit 필요성 재평가 (후속 backlog).
- **window 경계는 inclusive** (codex LOW 수용): 정확히 `WINDOW_MS` 경과한 제출도
  카운트. 밀리초 해상도에서 measure-zero 이벤트 → 무변경.
