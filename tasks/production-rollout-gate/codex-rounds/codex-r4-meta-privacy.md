# Codex R4 — Telemetry Meta-Privacy

**날짜**: 2026-05-20  
**질문**: 측정 telemetry 이벤트 페이로드가 9-field invariant를 위반할 수 있는가? 금지/허용 필드 명문화

---

## Codex 답변

**예. Telemetry는 burn summary upload가 clean해도 9-field/privacy invariant를 위반할 수 있다.** 별도 network payload이므로 별도 strict whitelist 필수.

---

### 1. 금지 필드 (모든 telemetry 이벤트에 적용)

| 카테고리 | 금지 필드 |
|----------|-----------|
| Raw content | `content`, `message`, `message.content`, `prompt`, `response`, `completion`, `input`, `output`, `code` |
| Payload text | `payload`, `payloadText`, `requestBody`, `rawBody`, `json`, `jsonl`, `rawLine`, `jsonlLine`, `line`, `firstLine`, `lastLine` |
| 로컬 경로/이름 | `path`, `folderPath`, `rootPath`, `cwd`, `projectName`, `repoName`, `fileName`, `directory`, `selectedDirectory` |
| Parser context | `sample`, `preview`, `snippet`, `errorContext`, `offendingRecord`, `record`, `entry` |
| Raw errors | `error`, `exception`, `exception.message`, `stack`, `cause` |
| 비밀/식별자 | `salt`, `deviceSalt`, `projectHashInput`, `projectSlug`, `hashPreimage`, API keys, tokens |
| Raw session metadata | 로그에서 파생된 `sessionId`, 로컬 파일명 기반 ID, transcript ID |
| 임의 메타데이터 | `metadata`, `properties`, `context`, `extra`, `debug`, spread objects |
| Browser fingerprinting | full `userAgent`, IP, headers, screen size, locale, timezone, 설치된 extensions |
| Burn summary internals | 불필요한 `tool`, `model`, `tokenCount`, `estimatedCostUsd`, `activeDays`, `verification` |

---

### 2. 허용 필드 (이벤트별 minimal schema)

**`auto_detect_started`**:
```ts
{
  event: "auto_detect_started",
  schemaVersion: 1,
  weekKey: "YYYY-MM-DD",    // "2026-05-20" 형식
  session_id: string,        // telemetry-only, 랜덤 생성 hex
  fsaSupported: boolean
}
```

**`auto_detect_completed`**:
```ts
{
  event: "auto_detect_completed",
  schemaVersion: 1,
  weekKey: "YYYY-MM-DD",
  session_id: string,
  durationBucket: "0-1m" | "1-3m" | "3-5m" | "5-10m" | "10-20m" | "20m+",
  result: "summary_generated" | "upload_accepted"
}
```

**`auto_detect_failed`**:
```ts
{
  event: "auto_detect_failed",
  schemaVersion: 1,
  weekKey: "YYYY-MM-DD",
  session_id: string,
  durationBucket: "0-1m" | "1-3m" | "3-5m" | "5-10m" | "10-20m" | "20m+",
  failureCode: "fsa_unavailable" | "folder_rejected" | "permission_denied" 
             | "no_supported_logs" | "parse_failed" | "summary_validation_failed" 
             | "upload_failed" | "unknown",
  failureStage: "capability_check" | "folder_picker" | "scan" | "parse" 
              | "validate" | "upload"
}
```

**`survey_responded`**:
```ts
{
  event: "survey_responded",
  schemaVersion: 1,
  weekKey: "YYYY-MM-DD",
  session_id: string,
  hardestStep: "terminal_setup" | "folder_selection" | "browser_permission" 
             | "upload" | "understanding_results" | "other_predefined",
  setupTimeBucket: "0-1m" | "1-3m" | "3-5m" | "5-10m" | "10-20m" | "20m+"
}
```

**주의**: free-text survey 답변 금지. 자유 텍스트는 raw user data.

---

### 3. Schema 제약 조건

- `additionalProperties: false` on root (필수)
- nested arbitrary object 금지
- 모든 string은 enum 또는 strict regex
- unbounded string 금지 (ID 제외, max length 명시)
- raw timestamp 대신 bucket 사용
- stack trace 금지
- serialized `Error` 금지
- analytics payload에 object spread 금지
- analytics provider auto-capture 비활성화 (URL, referrer, user agent, headers, DOM metadata 포함 가능)

Schema 예시:
```ts
session_id: /^[a-f0-9]{16,32}$/
weekKey: /^\d{4}-\d{2}-\d{2}$/
schemaVersion: const 1
event: enum only
durationBucket: enum only
failureCode: enum only
failureStage: enum only
```

---

### 4. 강제 메커니즘

1. 이벤트별 JSON Schema 또는 Zod schema 정의
2. Typed constructor만 사용: `makeAutoDetectFailedEvent(...)`
3. analytics 전송 직전 validation
4. validation 실패 시 이벤트 drop (전송 금지)
5. 독성 필드 포함 테스트: `path`, `message.content`, `stack`, `salt`, `projectSlug`, `rawLine`, `snippet`
6. Network interception 테스트: telemetry request에 whitelisted key만 있음을 증명
7. analytics SDK auto-capture/session replay 비활성화 (별도 payload audit 전까지)

**절대 금지 패턴**:
```ts
// 이 패턴은 catastrophic failure
analytics.track("auto_detect_failed", { ...err, ...context });
```

---

### 5. Parser 에러 발생 시 "failed" 이벤트에 포함 가능한 필드

**안전한 필드** (coarse classification만):
```ts
failureCode: "parse_failed"
failureStage: "parse"
durationBucket: "3-5m"
// 선택적으로 안전 (count only):
fileCountBucket: "1-10" | "11-100" | "101-1000" | "1000+"
```

**절대 포함 불가**:
- `err.message`
- `err.stack`
- malformed JSON text
- user file과 correlate될 수 있는 line number
- filename, path
- 파싱 실패 원인이 된 JSON key/value
- model raw value

---

### 6. `session_id` 포함 가능 조건

**가능. 단, telemetry-only ID여야 한다.**

허용 조건:
- CoconutLabs 클라이언트가 **랜덤으로 생성**
- 로컬 저장 (localStorage 또는 IndexedDB)
- Claude/Codex log에서 파생하지 않음
- 파일명, path, project name, prompt, log content에서 파생하지 않음
- Source-log의 session_id와 다른 값
- 교체 가능, rollout 측정 기간 범위로 스코프
- 고정 regex/length (예: 128-bit random hex)
- salt 또는 hash preimage와 함께 전송 금지
- 사용자 identity claim으로 사용 금지 → "distinct submitting environment"라고 불러야 함

**절대 금지**: parsed log에서 가져온 source-tool session_id 포함

---

## 핵심 결론 (five-axis-v2.md 반영 필요)

1. **Telemetry는 별도 strict schema 필수** — burn summary와 독립적으로 검증
2. **4개 이벤트 타입 정의 확정**: started / completed / failed / survey_responded
3. **telemetry-only session_id 생성**: CoconutLabs 클라이언트 랜덤 생성, log에서 파생 금지
4. **typed constructor + validation + drop**: analytics.track({ ...err }) 패턴 절대 금지
5. **Axis 7 (telemetry privacy schema test) 추가 확인**: R1에서 제안된 axis, 이 사양을 기준으로 테스트
