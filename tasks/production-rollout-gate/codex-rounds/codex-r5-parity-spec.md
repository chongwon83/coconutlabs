# Codex R5 — Parity Semantic Equality Specification

**날짜**: 2026-05-20  
**질문**: 4축 "semantic equality" 정의 — 무시할 필드, weekKey/activeDays 알고리즘, float 정밀도

---

## Codex 답변

### 1. weekKey — 공식 정의

**ISO 8601 week key, UTC 기준**, 형식: `YYYY-Www`

- `YYYY`는 **ISO week-year** (calendar year 아님)
- 반드시 UTC 타임스탬프 사용

**Year-boundary 엣지 케이스**:
```
2020-12-28 UTC -> 2020-W53
2020-12-31 UTC -> 2020-W53
2021-01-01 UTC -> 2020-W53   ← calendar year는 2021이지만 ISO week-year는 2020
2021-01-03 UTC -> 2020-W53
2021-01-04 UTC -> 2021-W01

2022-01-01 UTC -> 2021-W52
2022-01-02 UTC -> 2021-W52
2022-01-03 UTC -> 2022-W01
```

**결론**: calendar-week 로직 사용 금지. TS와 Python 양쪽 모두 ISO week-year + UTC 필수.

---

### 2. activeDays — 공식 알고리즘

```
activeDays = count(distinct UTC calendar dates containing at least one session start timestamp)
```

- session의 **start timestamp만** 사용 (elapsed duration으로 날짜 확장 금지)
- session이 자정을 걸쳐도 **start date만 카운트**

**예시**:
```
2026-05-20T23:59:00Z -> active date: 2026-05-20
2026-05-21T00:01:00Z -> active date: 2026-05-21
→ 위 두 session = 2 active days

start: 2026-05-20T23:55:00Z, end: 2026-05-21T00:10:00Z
→ active date: 2026-05-20 only (1 day)
```

**결론**: UTC only. 로컬 타임존은 fixture output에 영향 금지.

---

### 3. estimatedCostUsd — Float 정밀도

**`Number(value.toFixed(4)) == round(value, 4)`는 모든 IEEE 754 double에서 보장되지 않는다.**

JS `toFixed(4)`와 Python `round(x, 4)`는 decimal half case에서 binary representation과 rounding semantics 차이로 diverge 가능.

**권장 방식 (canonical quantization)**:
```
integer representation = round(usd * 10000)
→ 정수로 비교
```

JSON number 유지 시 semantic equality tolerance:
```
abs(tsValue - pyValue) <= 0.00005
```

**단, 이 tolerance는 비교 목적으로만 사용** — 알려진 rounding 차이를 숨기는 용도 금지.

**결론**: canonical rounding = **4자리 반올림** (round half even). 이미 JS `toFixed(4)` 동작에 commit했다면, **Python이 JS를 모방**해야 함 (Python 기본 `round()` 사용 금지).

---

### 4. 비교에서 제외할 필드

제외 허용:
- `generatedAt` (이미 제외됨)
- raw session 순서 (이미 제외됨)
- raw input file 순서
- non-semantic diagnostic/debug 필드
- runtime/environment metadata

**9-field envelope은 절대 제외 불가** — 이것이 계약 자체:
```
tool, model, tokenCount, estimatedCostUsd, sessionCount, activeDays, projectHash, verification, weekKey
```

**각 필드별 비교 방식**:
| 필드 | 비교 방식 |
|------|-----------|
| `model` | canonical collapse 후 비교 (invalid → "unknown" 포함) |
| `verification` | 정확한 canonical value |
| `tokenCount` | 정확한 정수 |
| `sessionCount` | 정확한 정수 |
| `activeDays` | 정확한 정수 |
| `weekKey` | 정확한 문자열 |
| `projectHash` | 정확한 lowercase hex 문자열 |
| `estimatedCostUsd` | canonical 4자리 값 비교 |

**null-vs-missing 차이도 무시하지 말 것** — 하나의 canonical shape 결정 후 강제.

---

### 5. projectHash — 공식 인코딩

```
projectHash = hex(HMAC-SHA256(key = saltBytes, message = slugBytes))
```

**인코딩 결정**:
| 항목 | 결정 |
|------|------|
| salt encoding | UTF-8 bytes, 설정된 그대로 |
| slug normalization | trim ASCII whitespace + lowercase + NFC Unicode normalization |
| slug encoding | UTF-8 bytes |
| output format | lowercase hex, 64자, prefix 없음 |

**예시 형식**:
```
9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
```

base64 금지, uppercase hex 금지, implicit locale casing 금지, platform-default encoding 금지.
UTF-8 everywhere.

---

## 핵심 결론 (five-axis-v2.md 반영 필요)

1. **weekKey**: ISO week-year (not calendar year) + UTC. 기존 구현 검증 필요 — Dec/Jan boundary에서 발산 가능.
2. **activeDays**: start timestamp만, UTC calendar date, session span 확장 금지
3. **estimatedCostUsd**: Python이 JS toFixed(4) 동작 모방 필수. 순수 Python round() 사용 금지.
4. **비교 tolerance**: `abs(ts - py) <= 0.00005` (비교용만)
5. **projectHash**: lowercase hex 64자, UTF-8, NFC normalization
6. **null-vs-missing**: canonical shape 결정 후 강제 — 무시하면 안 됨
