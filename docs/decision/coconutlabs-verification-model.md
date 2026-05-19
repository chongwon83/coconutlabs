# CoconutLabs — 검증 모델 + projectHash 위협 모델

> 작성: 2026-05-19 | 상태: 확정 (사용자 승인)
> 관련: 핸드오프 §8(업로드 9필드), §20(Go/No-go), 계획 `2-schema-1-collector-swift-dawn.md`

이 문서는 summary JSON 스키마를 얼리기 **전에** 배지 의미론과 projectHash
프라이버시를 확정한다 (Codex 교차검토 권고 반영). Step 2 스키마는 이 문서의
결정을 그대로 코드화한다.

---

## 0-A. 검증 레벨 의미론

### 내부 2축 + 신뢰도

수집 파이프라인은 내부적으로 **2개 직교 축 + 1개 신뢰도**로 판정한다.
표시할 때만 단일 `VerifLevel`로 collapse한다.

| 축 | 값 | 의미 |
|----|----|----|
| `tokenSource` | `device` | 로컬 CLI 로그를 collector가 파싱 |
| | `self` | 사용자가 수동 입력한 값 |
| `costBasis` | `estimated` | `model-pricing.json` 단가 × 토큰 수 |
| | `native` | provider가 제공한 실제 청구액 (현재 도달 불가 — CLI 로그에 없음) |
| `priceConfidence` | `high` | `match_model`이 모델명 prefix 매칭 성공 |
| | `low` | `_default` fallback (모델명 unmatched) |

### 표시 레벨 collapse 규칙

`lib/data.ts`의 `VerifLevel` 순서: **Provider-synced > Device-synced > Estimated > Self-reported**

| tokenSource | costBasis | priceConfidence | → 표시 `level` |
|-------------|-----------|-----------------|----------------|
| device | estimated | high | **Device-synced** |
| device | estimated | low | **Estimated** (강등) |
| self | * | * | **Self-reported** |
| * | native | * | Provider-synced (현재 도달 불가) |

**강등 근거**: `priceConfidence`는 §8의 9필드 계약에 독립 필드 자리가 없다.
unmatched 모델은 비용 추정의 신뢰도가 낮으므로 `verification.priceConfidence`에
기록하되, 표시 레벨을 Device-synced → **Estimated로 강등**해 사용자에게
드러낸다. confidence 값 자체는 `verification` 객체 내부 필드로 흡수된다.

### 핵심 원칙 — UI는 level을 신뢰하지 않는다

summary 파일의 `verification.level`은 **참고값**이다. UI(`validateSummary.ts` /
`BurnIndexPreviewCard.tsx`)는 `verification`의 3개 입력 축으로부터 표시 레벨을
**항상 재계산**한다 (`deriveVerifLevel` 헬퍼). 파일이 위조되어 `level`만
"Provider-synced"로 적혀 있어도 입력 축 기준으로 재도출하므로 신뢰 등급을
사칭할 수 없다.

---

## 0-B. projectHash 위협 모델

`projectHash`는 §8의 9개 업로드 필드 중 하나다. 같은 사용자의 여러 프로젝트를
구분하되 프로젝트 정체는 드러내지 않는 것이 목적이다.

### 위협

경로 슬러그(예: `-Users-foo-Desktop-acme-billing`)를 그대로 `sha256`하면:

- 흔한 프로젝트명(`my-app`, `web`, `backend`)은 사전/레인보우 공격으로 즉시 복원.
- 회사명·고객명이 경로에 있으면 추측 가능 → §8의 "고객/회사/비밀 프로젝트명
  유출 금지"를 **사실상 위반**. 단순 해시는 익명화가 아니다.

### 결정 — 기기 로컬 솔트 키 해시

- **솔트**: 최초 collector 실행 시 1회 생성한 랜덤 32바이트.
  `~/.coconutlabs/salt`에 저장, 파일 권한 `0600`.
- **해시**: `projectHash = sha256(salt + ":" + project_slug).hexdigest()[:12]`
- **속성**:
  - 같은 기기 내에서는 동일 프로젝트가 항상 같은 해시 → 세션 집계 가능.
  - 솔트를 모르는 외부자는 후보 슬러그를 brute-force해도 검증 불가 → 원본 추측 차단.
  - 솔트는 기기 외부로 절대 나가지 않는다. **9개 업로드 필드에 포함되지 않으며
    summary JSON에도 기록하지 않는다.**
- **트레이드오프**: 기기 간에는 같은 프로젝트라도 해시가 다르다. CoconutLabs는
  cross-device 집계를 하지 않으므로(백엔드 없음) 문제되지 않는다. 솔트 파일이
  삭제되면 다음 실행에서 새 솔트가 생성되어 과거 해시와 불연속 — 허용 가능.

---

## Step 2 스키마에 미치는 영향

- `verification` 객체는 `{tokenSource, costBasis, priceConfidence, level}` 4키.
  → 핸드오프 §8의 단일 필드 "verification level"의 구조화된 표현.
- `projectHash`는 12-hex 문자열. 솔트는 스키마에 **없다**.
- raw content / 경로 원문 / repo명 계열 키는 스키마에 **존재하지 않는다**
  (`additionalProperties: false`로 강제).
