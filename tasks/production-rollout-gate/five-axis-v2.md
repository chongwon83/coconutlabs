# Five-Axis Production Rollout Gate v2

**작성일**: 2026-05-20  
**기반**: 원안 (modular-bubbling-ember.md) + Codex 5-round adversarial review (R1~R5)  
**상태**: DRAFT — owner 승인 후 확정

---

## 변경 요약 (v1 원안 대비)

| 변경 | 근거 | 라운드 |
|------|------|--------|
| Axis 1 threshold: 6 → 15 | "6 external users"는 no-auth 시스템에서 통계적 의미 없음 | R2 |
| Axis 1 정의: "external users" → "distinct submitting environments" | handle/project_hash는 real user identity 증명 불가 | R2 |
| Axis 2: 임계값 명확화 (미확정 → median≤10분, fail rate≤20%) | 미확정은 gate가 아님 | R2 |
| Axis 3: n≥20 전제 조건 추가 | n=6에서 50%는 의미 없음 | R2 |
| Axis 6 추가: server persistence whitelist | Axis 5가 server-side redisStore violations 잡지 못함 | R1 |
| Axis 7 추가: telemetry privacy schema | 측정 telemetry 자체가 raw data 유출 경로 | R1, R4 |
| INSUFFICIENT_DATA state 추가 | PASS/FAIL 이분법은 소규모에서 false signal | R2 |
| weekKey: ISO week-year (not calendar) + UTC 명문화 | Dec/Jan boundary 발산 위험 | R5 |
| activeDays: start timestamp + UTC only 명문화 | local timezone 개입 금지 | R5 |
| estimatedCostUsd: Python이 JS toFixed(4) 모방 필수 | Python round()와 JS toFixed()는 다를 수 있음 | R5 |

---

## 5-Axis v2 Gate Definition (7축으로 확장)

> **모든 7축이 PASS여야 ON 전환 PR 허용. INSUFFICIENT_DATA는 데이터 수집 대기 (FAIL 아님).**

### Axis 1 — External Adoption
**측정**: `/api/burnindex` POST distinct `(session_id, project_hash)` 쌍 카운트  
**임계값**: ≥ 15 distinct 쌍 (알려진 developer/test hash 제외)  
**정의**: "15 distinct submitting environments" (not "15 external users")  
**식별자 우선순위**: `session_id` primary + `project_hash` secondary. `handle`은 display-only.  
**상태**: PASS (≥15) / INSUFFICIENT_DATA (<15) / FAIL (integrity violation 감지 시)

### Axis 2 — Setup Time & Failure Rate
**측정**: 클라이언트 `auto_detect_started` → `auto_detect_completed`/`auto_detect_failed` 이벤트  
**임계값**: 
- PASS: median setup duration ≤ 10분 AND fail rate ≤ 20%  
- WARN: median 10-20분 OR fail rate 20-35% (gate block 아님, 모니터링)  
- FAIL: median > 20분 OR fail rate > 35%  
- INSUFFICIENT_DATA: n < 10 attempted setups  
**측정 기준**: 온보딩 시작 → 첫 valid upload accepted. 포기 = 실패.

### Axis 3 — Terminal Bottleneck Evidence
**측정**: post-upload survey `survey_responded.hardestStep` 집계  
**임계값**:
- PASS: n ≥ 20 AND ≥ 50% 응답이 `"terminal_setup"` 또는 관련 단계  
- EARLY_SIGNAL: n < 20 AND ≥ 80% — 방향성만, gate block 아님  
- FAIL: n ≥ 20 AND < 50%  
- INSUFFICIENT_DATA: n < 10 survey responses  
**대안**: funnel drop-off가 quickstart 단계에서 명확히 측정될 경우 대체 허용

### Axis 4 — Fixture Parity (TS ≡ Python)
**측정**: vitest parity test suite, CI에서 실행  
**임계값**: 42/42 PASS  
**semantic equality 정의**:
- 무시할 필드: `generatedAt`, session 순서, input file 순서
- 포함할 필드: **9-field envelope 전부** (tool, model, tokenCount, estimatedCostUsd, sessionCount, activeDays, projectHash, verification, weekKey)
- `weekKey`: ISO 8601 week-year + UTC (not calendar year, not local timezone)
- `activeDays`: start timestamp only, UTC calendar date (session span 확장 금지)
- `estimatedCostUsd`: Python이 JS `toFixed(4)` 동작 모방. `abs(ts-py) ≤ 0.00005` tolerance.
- `projectHash`: lowercase hex 64자, UTF-8, slug NFC normalization
- `model`: invalid → "unknown" collapse TS/Python 양쪽 동일

### Axis 5 — Client Network Security Test
**측정**: vitest security test suite (fetch/XHR intercept), CI에서 실행  
**임계값**: 42/42 PASS  
**테스트 강화 사항** (R1 결과):
- salt-like 값 심어놓고 network payload에서 absence 확인
- forbidden key regex (prompt, response, content, path, source, apiKey 등)
- SECRET_SENTINEL_XYZ_2026 leak 0건

### Axis 6 — Server Persistence Whitelist (신규, R1)
**측정**: server-side unit test — `validateSummary` + `redisStore` write
**임계값**: 모든 Redis write에 정확히 9개 허용 key만 포함
**테스트 케이스**:
- 악의적 extra field 포함 요청 (persisted unknown key = FAIL)
- raw prompt-like string, API-key-like string, file path-like string 포함 요청
- parser error shaped payload (stack trace, err.message 포함) 요청
- `import-history.json` write: `{handle, weekKey, totalTokens, importedAt}` 4개만 허용

### Axis 7 — Telemetry Privacy Schema (신규, R1 + R4)
**측정**: telemetry 이벤트 schema 검증 + network interception test  
**임계값**: 4개 이벤트 타입 모두 schema validation PASS + 금지 필드 0건  
**허용 이벤트 타입**: `auto_detect_started`, `auto_detect_completed`, `auto_detect_failed`, `survey_responded`  
**모든 이벤트 공통 허용 필드**: `event`, `schemaVersion`, `weekKey`, `session_id`, 이벤트별 enum 필드  
**모든 이벤트 금지 필드** (일부):
- `content`, `message`, `prompt`, `response`, `rawLine`, `payload`
- `path`, `folderPath`, `fileName`, `projectName`, `directory`
- `error`, `exception`, `stack`, `cause`
- `salt`, `projectHashInput`, `hashPreimage`
- source-tool derived `sessionId`

**`session_id` 정의 (telemetry용)**:
- CoconutLabs 클라이언트가 랜덤 생성 (crypto.getRandomValues 128-bit hex)
- 로그에서 파생 금지 (파일명, path, session metadata 기반 ID 금지)
- 교체 가능, 영구 user identity 아님
- regex: `/^[a-f0-9]{32}$/`

---

## Gate 상태 정의

| 상태 | 의미 | ON 전환 허용 |
|------|------|------------|
| PASS | 임계값 충족 | 예 (다른 모든 축도 PASS 시) |
| FAIL | 임계값 미달 | 아니오 |
| INSUFFICIENT_DATA | 샘플 부족 (데이터 수집 중) | 아니오 |
| WARN | 임계값 충족이나 주의 필요 | 예 (모니터링 의무) |

---

## 자동화 형태 (Phase 1 + Phase 2)

| 축 | Phase 1 구현 | Phase 2 CI |
|----|-------------|-----------|
| 1 | `web/lib/server/burn/metrics.ts` + `route.ts` 수정 | `/api/internal/rollout-gate-metrics` + workflow |
| 2 | `web/lib/client/burn/telemetry.ts` + `JoinBurnIndexForm.tsx` | metrics API |
| 3 | `PostUploadSurvey.tsx` + telemetry | metrics API |
| 4 | 기존 vitest 재사용 | `.github/workflows/parity-test.yml` |
| 5 | 기존 vitest 재사용 | `.github/workflows/security-test.yml` |
| 6 | `web/__tests__/burn-server-whitelist.test.ts` (신규) | security-test workflow에 포함 |
| 7 | `web/__tests__/burn-telemetry-privacy.test.ts` (신규) | security-test workflow에 포함 |

---

## Rollback 정책 (R3 결과)

**자동 rollback 불필요. 수동 kill switch 필수.**

Kill switch: `NEXT_PUBLIC_AUTO_DETECT_DEFAULT` 환경변수 → `false`로 변경 후 redeploy

즉시 OFF 복귀 조건:
1. Privacy leak 또는 unintended file selection **1건이라도 confirmed**
2. 24시간 내 3명 이상 독립 사용자 보고 (unexpected file picker/privacy)
3. 1시간 내 5건+ FSA-related uncaught client error (distinct sessions)

Monitoring: ON flip 후 24시간 active watch, 7일 passive watch → stable 선언 가능

---

## owner 4항목 확인 (gate confirmation 필수)

Phase 1 시작 전 owner가 다음 4항목을 명시적으로 확인해야 함:

1. **scope**: 본 7축이 다루는 범위 (privacy·UX·정확성·telemetry 안전성)
2. **non-scope**: 성능·비용·운영 대시보드·자동 rollback은 이 gate에서 다루지 않음
3. **invariant**: 측정 자체가 raw data 유출하지 않음 (9-field 위반 = commit blocker)
4. **성공조건**: 7축 모두 PASS + CI에서 ON 전환 PR 자동 차단 동작 확인
