# Coconut Labs Burn-Import — Production Verification Report

**날짜**: 2026-05-21
**확인자**: chongwon83
**상태**: ✅ 12/12 PASS — 프로덕션 검증 완료, F8/F9 모두 CLOSED
**검증 환경**: Chrome (claude-in-chrome MCP) · https://www.coconutlabs.xyz/ · main @ db4c974 (PR #5 squash-merge)

---

## 1. Summary

handoff.md §4 의 12개 검증 기준이 모두 통과되었음을 본 보고서가 audit-trail 로 기록한다.
F8(rowTotalTokens 파생 합산)·F9(envelope canonicalized POST) 픽스는 모두 프로덕션에 배포되어
런타임 증거로 PASS 가 확인되었다. ImportedEntry 9-field projection·FSA picker 거부·소스
앵커는 본문 §3 이하에 1:1 로 매칭된다.

---

## 2. 검증 환경

| 항목 | 값 |
|------|----|
| 도메인 | https://www.coconutlabs.xyz/ |
| 브라우저 | Chrome 129+ (Chromium FSA 지원) |
| 도구 | claude-in-chrome MCP (tabs_context / navigate / read_console_messages / read_network_requests) |
| 배포 커밋 | `db4c974` (main, PR #5 squash-merge) |
| 데이터 셋 | Claude JSONL × 3 세션 + Codex rollout × 1 세션 (테스트 핸들 `@coconut-verify-bot`) |
| 시점 | 2026-05-20 22:30 ~ 23:55 KST |
| Feature flag | `?auto-detect=1` (Phase 2 FSA 활성 — 프로덕션 default OFF 유지) |

---

## 3. 12개 기준별 결과 (handoff.md §4 ↔ 본 보고서 1:1)

| # | 기준 (handoff §4) | 판정 | 근거 / 위치 |
|---|------------------|------|------------|
| 1 | `npx tsc --noEmit` 0 에러 | ✅ | 로컬 `web/` 실행 시 0 에러 — §4.1 |
| 2 | Codex 4th audit 0 HIGH (Findings 1/2/3 CLOSED) | ✅ | F8/F9 픽스 후 4차 라운드 audit log §4.2 |
| 3 | `pricing.generated.ts` byte-identical regen | ✅ | `node scripts/codegen-pricing.mjs` 재실행 후 diff 0 — §4.3 |
| 4 | `hashing.ts` SHA-256 hex slice ≡ Python hashlib (50+ pair) | ✅ | `__tests__/burn-parity.test.ts` 통과 — §4.4 |
| 5 | 필드별 zeroing semantics | ✅ | tokenCount 누락 필드는 0 으로 정규화 — `parsers.ts` 단위 테스트 |
| 6 | 9-field whitelist via validateSummary | ✅ | `__tests__/burn-server-whitelist.test.ts` L48-111 grouped 통과 |
| 7 | `SECRET_SENTINEL_XYZ_2026` 업로드 페이로드 비검출 | ✅ | `__tests__/burn-security.test.ts` L21-65 + Chrome network capture §4.5 |
| 8 | forbidden-key regex 0 hits (`prompt|response|content|source|path|repo|secret|apiKey|env|password|token`) | ✅ | network capture 전수 grep §4.5 |
| 9 | salt 값 업로드 페이로드 비검출 | ✅ | `~/.coconutlabs/salt` 값 grep 0건 — §4.5 |
| 10 | FSA picker 폴더 이름 거부 (`projects`/`sessions` 외) | ✅ | Chrome 런타임 거부 메시지 §4.6 |
| 11 | Safari/Firefox/no-`showDirectoryPicker` Phase 1 fallback | ✅ | `JoinBurnIndexForm.tsx:62-66` 소스 게이트 §4.7 |
| 12 | Browser fetch 인터셉트 0 forbidden + 0 sentinel + 0 salt leak | ✅ | full flow capture §4.5 |

---

## 4. 런타임·소스 증거

### 4.1 TypeScript 컴파일 (기준 #1)

```
$ cd web && npx tsc --noEmit
$ echo $?
0
```

### 4.2 Codex 4th audit (기준 #2)

- Finding 1 (F8 — row 합계 0 표기) → **CLOSED** (commit `686e334`)
- Finding 2 (F9 — manual upload duplicate-key 채널) → **CLOSED** (commit `686e334`)
- Finding 3 (telemetry envelope 외 라우트) → **CLOSED** (이전 라운드)
- 4차 라운드: 추가 HIGH 0건.

### 4.3 Pricing codegen 재생성 (기준 #3)

```
$ node scripts/codegen-pricing.mjs
$ git diff lib/client/burn/pricing.generated.ts
(no output — byte-identical)
```

### 4.4 SHA-256 byte-parity (기준 #4)

- `__tests__/burn-parity.test.ts` 의 50+ 랜덤 `(slug, salt)` 쌍에 대해
  WebCrypto SHA-256 hex slice(0,12) = Python `hashlib.sha256(...).hexdigest()[:12]`.
- projectHash 형식: 정확히 12 lowercase hex.

### 4.5 9-field projection · Sentinel · Salt · Forbidden-key (기준 #6/#7/#8/#9/#12)

**F8 런타임 증거** — Chrome leaderboard 카드 token 합계:

| Row | tokenCount (input/output/cacheRead/cacheWrite/cachedInput) | rowTotalTokens(derived) | UI 표시 |
|-----|-----------------------------------------------------------|--------------------------|--------|
| Claude (week) | 800 / 600 / 200 / 100 / 100 | **1800** | 1,800 ✅ |
| Codex (week) | 200 / 80 / 10 / 0 / 0 | **290** | 290 ✅ |
| Grand total | — | — | **2,090** ✅ |

- `BurnIndexPreviewCard.tsx:22-25` 의 `rowTotalTokens()` 가 5개 sub-field 합산.
- 9-field whitelist 가 `totalTokens` 를 제외했으므로 envelope row 에는 derived 값만 존재.

**F9 런타임 증거** — manual upload POST body 인터셉트:

```
POST /api/burnindex
content-type: application/json
body (canonical raw): {"schemaVersion":"2","generatedAt":"2026-05-20T...","periodWindow":{...},"rows":[...],"grandTotal":{...}}
                      └─ JoinBurnIndexForm.tsx:282 `JSON.stringify(envelope)` 결과
                         (validateSummary 통과한 envelope 만 직렬화)
```

- duplicate JSON keys 가 포함된 페이스트도 canonical raw 로 재직렬화 → drift 채널 차단.
- `lib/client/burn/import.ts:49` 의 FSA 자동 경로와 **동일 계약**.

**Forbidden-key / sentinel / salt grep** (Chrome `read_network_requests` 캡처 전수):

```
forbiddenLeaksOnEntry = []         # 0 hits
sentinelHitsOnPayload = []         # 0 hits  (SECRET_SENTINEL_XYZ_2026)
saltHitsOnPayload     = []         # 0 hits  (chmod 0600 ~/.coconutlabs/salt 값)
```

**ImportedEntry projection** — `lib/server/burnStore/redisStore.ts:78` `projectEntry()`:

- 9 declared fields 만 explicit list 로 직렬화 (input spread 금지).
- ChallengeRecord 도 `projectChallenge()` 동일 패턴 (`redisStore.ts:100`).
- runtime 단위 검증: `__tests__/burn-server-whitelist.test.ts` L124-245.

### 4.6 FSA picker 거부 트랜스크립트 (기준 #10)

- 시도 입력: `~/random-folder` (이름이 `projects`/`sessions` 로 끝나지 않음)
- 결과: Phase 2 FSA picker 즉시 거부, UI 에 다음 에러 표시:

```
Select a folder whose name ends in "projects" or "sessions"
(e.g. ~/.claude/projects, ~/.codex/sessions).
```

- 소스 앵커: `lib/client/burn/parsers.ts` 의 `findClaudeLogs` / `findCodexLogs` 진입 가드.
- 임시 폴더에 잘못된 파일을 두고 직접 선택해도 traversal 차단 확인.

### 4.7 Source-confirmed gate (기준 #11)

```
components/forms/JoinBurnIndexForm.tsx:62-66

const params = useSearchParams();
const autoDetect =
  params.get("auto-detect") === "1" &&
  typeof window !== "undefined" &&
  "showDirectoryPicker" in window;
```

- `?auto-detect=1` 누락 → Phase 1 (수동 업로드) 강제.
- `showDirectoryPicker` 미지원 브라우저(Safari/Firefox) → 자동 Phase 1 fallback.
- 프로덕션 default OFF (internal/dogfood 외 영향 0).

---

## 5. Verification telemetry — full POST capture (요약)

| 항목 | 측정값 |
|------|--------|
| 총 POST `/api/burnindex` 호출 | 2건 (FSA 1, manual 1) |
| 페이로드 평균 크기 | 2.1 KB |
| forbidden-key regex 매칭 | 0 |
| sentinel/salt 매칭 | 0 / 0 |
| validateSummary 통과율 | 2/2 (100%) |
| `additionalProperties: false` 위반 | 0 |
| projectHash 형식 위반 (≠ 12 hex) | 0 |

---

## 6. 잔여 액션

| # | 액션 | 상태 | 비고 |
|---|------|------|------|
| B | 프로덕션 leaderboard `@coconut-verify-bot` 테스트 entry 정리 | ✅ 완료 (2026-05-21) | §8 참조 — Upstash CLI 직접 실행, HEXISTS=0 + 시각 확인 |
| C | 미커버 14개 함수 중 HIGH 4 + MED 3 vitest 커버리지 추가 | ✅ 완료 | 7개 신규 test 파일 (`__tests__/burn-*.test.ts`) |
| D | Codex 교차 리뷰 (위험 3축 2/3 충족) | Owner 호출 대기 | `/codex` 1회 호출 — 가수금 슬래시는 owner-invoked |

---

## 8. `@coconut-verify-bot` 정리 audit trail (2026-05-21)

**실행 경로**: Upstash 콘솔 인증 세션의 in-browser CLI 탭 (`console.upstash.com/redis/<db-id>/cli`)
**DB**: `coconutlabs-contract-check` (ID `ffdbeb38-e238-4194-9b2f-689684677bdb`)
**실행자**: chongwon83 (Claude in Chrome MCP via JavaScript dispatch)
**자격증명**: 로컬 추출 0회 — 인증된 브라우저 세션 내에서만 명령 실행, REST TOKEN 평문 노출 없음.

### 8.1 사전 readback (destructive 전)

```
HEXISTS burn:leaderboard @coconut-verify-bot       → 1
HGET    burn:leaderboard @coconut-verify-bot       → {"handle":"@coconut-verify-bot","avatar":"CO","verif":"Estimated","totalTokens":2090,"estimatedCostUsd":0.0284,"period":"week","since":"2026-05-14T00:00:00Z","until":"2026-05-20T00:00:00Z","importedAt":"2026-05-20T15:06:36.204Z"}
EXISTS  burn:hist:@coconut-verify-bot              → 1
HLEN    burn:hist:@coconut-verify-bot              → 1
LLEN    burn:challenges                            → 1
LRANGE  burn:challenges 0 -1                       → {"handle":"contract-1779201784594-challenge",...}  (스코프 외 — 정리 대상 아님)
```

**검증 사항**: HGET 결과가 정확히 9개의 whitelist 키만 반환 — F8 9-field parity 가 런타임에서 재확인됨.
challenges 리스트 단일 entry 는 `@coconut-verify-bot` 가 아닌 별도 `contract-*` 테스트 핸들 → LREM 불필요.

### 8.2 Apply (2 destructive ops, scoped)

```
HDEL burn:leaderboard @coconut-verify-bot          → 1   (1 field removed)
DEL  burn:hist:@coconut-verify-bot                 → 1   (key deleted)
```

### 8.3 사후 verification

```
HEXISTS burn:leaderboard @coconut-verify-bot       → 0   ✅
EXISTS  burn:hist:@coconut-verify-bot              → 0   ✅
HLEN    burn:leaderboard                           → 4   (4 legitimate handles remain)
```

### 8.4 프로덕션 시각 확인

- URL: https://www.coconutlabs.xyz/ (재로드 후 측정)
- `document.body.innerText` 정규식 `/@[a-zA-Z0-9_-]+/g` 매칭 결과: `@shellcoder`, `@tinyshipper`, `@noor`, `@4ndres`, `@coconutfix` (5건, 모두 정상)
- `@coconut-verify-bot` 페이지 내 매칭: **0건** ✅

### 8.5 결과

| 체크 | 결과 |
|------|------|
| Redis layer — `@coconut-verify-bot` 제거 | ✅ 0건 |
| HTTP layer — 프로덕션 DOM 노출 | ✅ 0건 |
| 9-field whitelist runtime parity | ✅ 재확인 |
| 토큰/credential leak | ✅ 없음 (브라우저 세션 내 실행) |
| Out-of-scope 핸들 영향 | ✅ 없음 (`contract-*` challenge entry 보존) |

---

## 7. 참조

- handoff: `tasks/coconut-burn-import/handoff.md`
- 7-axis gate: `tasks/production-rollout-gate/owner-gate-confirmation.md`
- 커밋: `686e334` (F8+F9 close), `e805008` (7-axis gate), `41bec83` (Phase 2 FSA), `13d449c` (Redis migration)
- 소스 앵커: `components/forms/JoinBurnIndexForm.tsx:62-66, 282` · `components/BurnIndexPreviewCard.tsx:22-25` · `lib/client/burn/import.ts:49` · `lib/server/burnStore/redisStore.ts:78, 100`

---

## 9. Codex 교차 리뷰 (2026-05-21)

**근거**: 본 plan 위험 3축 평가 — 실패비용 ② (Redis 영속 데이터) + 영향범위 ③ (scripts/ + __tests__/ + tasks/, 3+ 모듈) = 2/3 충족 → 코덱스 교차 리뷰 강력 권장. `task-standards.md` "검증 분리 원칙" + 1순위 검증자 = `/codex`.

### 9.1 실행

- 도구: `codex review --base HEAD -c 'model_reasoning_effort="high"'` (codex-cli 0.128.0)
- 스코프: uncommitted 변경 (Task A `verification-report.md` + Task B `scripts/cleanup-test-handle.mjs` + Task C 7개 `__tests__/burn-*.test.ts` + `package.json`/`./gitignore` 변경)
- 사전 게이트: `tsc --noEmit` EXIT=0, `vitest run` 188/188 PASS

### 9.2 Codex Findings (2건, 모두 P2)

| # | 위치 | 결함 | 조치 |
|---|------|------|------|
| 1 | `package.json:14` | `test:coverage` 스크립트 추가됐으나 `@vitest/coverage-v8` 미설치 — 실행 시 `MISSING DEPENDENCY` 에러 | **스크립트 제거** (Plan verification에 미사용, 새 devDep 도입 회피) |
| 2 | `scripts/store-contract-check.mjs:51` | F8에서 row whitelist의 `totalTokens`를 제거했으나 contract-check fixture는 row-level `totalTokens` 유지 → 400 unexpected-key 에러로 contract verify 깨짐 | **row 필드 삭제 + 의도 주석 추가** (grandTotal은 보존) |

### 9.3 사후 재검증

```
tsc --noEmit                                            → EXIT=0  ✅
vitest run                                              → 188/188 PASS ✅
grep totalTokens scripts/store-contract-check.mjs       → 2건 (둘 다 grandTotal, row-level 0건) ✅
grep test:coverage package.json                         → 0건 ✅
```

### 9.4 결과

- AUDIT PASS — 0 HIGH, 2 P2 모두 즉시 close
- Codex 교차 리뷰가 owner 단독 검증으로는 놓쳤을 contract-check fixture 동기화 누락(F8 후속 정리)을 검출
- 이번 사이클 검증 분리 원칙 통과 — owner "완료" 발화 가능
