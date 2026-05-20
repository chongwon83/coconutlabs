# Codex R1 — Privacy Invariant Coverage

**날짜**: 2026-05-20  
**질문**: 5축이 privacy invariant(9-field whitelist) 위반을 막기에 충분한가? 빠진 축은? 특히 측정 telemetry 자체가 raw data 유출 경로가 될 수 있는지 (meta-privacy)

---

## Codex 답변

### 1. 5축이 12개 privacy invariant를 모두 커버하는가?

**아니오. 5축은 12개 invariant를 모두 커버하지 못한다.**

부분 커버:
1. **#1 schema whitelist**: axis 5에서 network 상에 9개 row field만 있다고 assert할 때만 부분적으로 커버됨. schema validation 자체를 테스트하지 않으면 불충분.
2. **#3 per-field zeroing**: axis 4 fixture parity가 poisoned-field fixture를 포함할 때만 커버됨.
3. **#4 model collapse**: axis 4가 TS/Python 양쪽에서 invalid model regex/family-prefix 동작을 명시적으로 테스트할 때만 커버됨.
4. **#10 raw content 없음**: axis 5 network interception으로 부분 커버. static/read-path 검사는 없음.
5. **#12 production default OFF**: axis 5 또는 CI가 `?auto-detect=1` gating/default-off 동작을 assert하지 않으면 커버 안 됨.

**어떤 축도 커버하지 않는 invariant:**
1. **#2 salt never in network payload** — axis 5가 salt-like 값을 심어놓고 absence를 assert하지 않는 이상 커버 불가.
2. **#5 redisStore typed-only stringify / no spread** — axis 5로는 증명 불가.
3. **#6 import-history.json whitelist** — 로컬 history write를 체크하는 축 없음.
4. **#7 DESIGN.md invariants** — 각 invariant가 테스트에 매핑되지 않으면 커버 불가.
5. **#8 folder-name rejection** — picker rejection을 명시적으로 테스트하는 축 없음.
6. **#9 salt import validation / API key prefix rejection** — fixture/security test에 포함되지 않으면 커버 안 됨.
7. **#11 no live pricing fetch** — network intercept가 runtime fetch를 잡을 수 있지만 build-time regression은 다룰 수 없음.

---

### 2. Telemetry가 raw data 유출 경로가 될 수 있는가? (meta-privacy)

**예. axes 2+3의 클라이언트 telemetry 이벤트는 real meta-privacy 위험이다.**

Invariant #10을 위반할 수 있는 telemetry 필드:
1. `path`, `folderPath`, `rootPath`, `selectedDirectory`, `fileName`, `projectName`
2. `rawLine`, `jsonlLine`, `message`, `message.content`, `prompt`, `response`, `completion`
3. `payload`, `payloadText`, `requestBody`, `errorContext`
4. `stack` — file path, parsed content, 또는 serialized object 포함 가능
5. `exception.message` — 파서 에러에 raw JSON 조각 포함 가능
6. `sample`, `preview`, `snippet`, `firstLine`, `lastLine`
7. `modelRaw` — normalized whitelist output 대신 검증 전 source value 보존 시
8. `sessionId` — 로컬 파일명 또는 raw session metadata에서 파생 시
9. `projectHashInput`, salt, 또는 `projectHash` 계산에 사용된 pre-hash identifier

**필수 조치**: Telemetry는 별도 strict schema (additionalProperties: false)를 사용해야 한다. arbitrary error object를 보내지 말 것. 이 flow의 stack trace를 보내지 말 것.

---

### 3. Axis 5가 server-side redisStore violations를 잡기에 충분한가?

**아니오.**

Fetch/XHR intercept는 브라우저가 보내는 것을 관찰한다. 서버가 whitelisted field만 저장한다는 것을 증명하지 못한다. 서버는 다음을 할 수 있다:
1. 유효한 9-field input을 받아 extra field로 enrich/store
2. 임의의 request object를 Redis에 spread
3. header, IP-derived data, user agent, raw body, telemetry blob 저장
4. raw payload 조각이 포함된 validation failure 직렬화
5. 클라이언트 요청 경로 외에 import metadata 저장

**Invariant #5는 server-side tests가 필요하다** — `validateSummary`와 `redisStore`에 대해, 정확한 persisted JSON key를 assert하는 테스트.

---

### 4. 추가해야 할 축 (최대 2개, critical만)

**Axis 6: Server persistence whitelist test (CRITICAL)**
- 모든 Redis/import-history write에 정확히 허용된 key만 있는지 assert
- 악의적인 extra field, nested extra, raw prompt-like string, salt-like string, API-key-like string, file path, parser-error-shaped payload 포함한 테스트
- persisted unknown key 또는 raw-looking value가 있으면 FAIL

**Axis 7: Telemetry privacy schema test (CRITICAL)**
- Strict telemetry schema (additionalProperties: false)
- 허용 필드: event name, phase, coarse duration bucket, coarse failure code, browser capability flags, week/version
- 명시적 금지: path, filename, raw error, stack trace, snippet, JSONL line, prompt/response/code fields, salt, hash preimage, arbitrary metadata

---

### 5. 현재 Gate 평가

**Primary failure mode** ("user gets FSA UI and raw content leaks to server")에 대한 현재 gate 평가: **4/10 (weak-to-moderate)**

Axis 5가 유일하게 직접 관련된 gate지만, 다음을 커버하지 못한다:
- telemetry expansion
- server persistence
- local history writes
- future event logging
- CI enforcement
- untested error paths

CI-enforced axis 4+5 + server persistence whitelist + telemetry privacy schema gate 추가 시: **8/10**

---

## 핵심 결론 (five-axis-v2.md 반영 필요)

1. **Axis 6 추가 필요**: server-side persistence whitelist test
2. **Axis 7 추가 필요**: telemetry privacy schema test (axes 2+3 telemetry 구현 전 정의 필수)
3. **Axis 5 강화**: salt-like value planting + redisStore server-side test 포함
4. **Axis 4 강화**: poisoned-field fixtures + model collapse TS/Python 양방향 포함 확인
5. **Telemetry 설계 원칙**: `additionalProperties: false`, stack trace 금지, path/filename 금지
