# Codex R2 — Threshold Validity

**날짜**: 2026-05-20  
**질문**: Axes 1/2/3 임계값(6명/미확정/50%+)이 임의적인가? 통계적/운영적 근거 + "외부 사용자" 정의

---

## Codex 답변

### 1. "6 external users" 임의적인가?

**예. 임의적이다.**

통계적 근거 없음. n=6은 "6개 레코드 제출됨"만 증명할 뿐, 6명의 실제 외부 사용자를 증명하지 않는다.

더 정확한 표현:
> "최소 6개의 distinct submitted project"

"6 external users"라고 부르면 안 됨.

---

### 2. "distinct real user" 신뢰도 순위

**가장 신뢰할 수 있는 순서: session_id > project_hash > handle**

| 식별자 | 신뢰도 | Attack surface |
|--------|--------|----------------|
| `session_id` | 중 (최선) | spoofable, 여러 browser/device 사용 시 중복 |
| `project_hash` | 낮-중 | user가 여러 folder 생성 가능, 다른 hash ≠ 다른 사람 |
| `handle` | 최하 | 순수 텍스트, 쉽게 위조/중복/변경 가능 |

**현실적 권장 정의**:
> distinct `session_id` + distinct `project_hash` 쌍, 알려진 developer/test hash 제외

단, "외부 사용자"가 아닌 **"distinct submitting environments/projects"**로 명칭 변경 필요.

---

### 3. Axis 2 (setup time) PASS/FAIL 기준

"미확정"은 허용 불가. 제안:

| 상태 | 기준 |
|------|------|
| **PASS** | median setup time ≤ 10분 AND fail rate ≤ 20% |
| **WARN** | median 10-20분 OR fail rate 20-35% |
| **FAIL** | median > 20분 OR fail rate > 35% |

최소 샘플: **10회 이상의 attempted setup** (실패 포함, 포기도 실패로 카운트).

측정 기준: 온보딩 시작 → 첫 valid upload accepted까지.

---

### 4. Axis 3 (50%+) n=6에서 유효한가?

**아니오. n=6에서 50%는 무의미하다.**

n=6에서 1명 변화 = 16.7% 포인트 변동. 너무 불안정.

신뢰할 수 있는 50% 판단을 위한 최소 샘플:
- n ≥ 20: rough directional signal
- n ≥ 30: minimally credible claim
- n ≥ 50+: actual confidence

n=6에서 50%를 보고 싶다면 훨씬 강한 기준 필요:
- n=6이면 5/6 또는 6/6이어야 early signal

**권장 Axis 3 규칙**:
> PASS: distinct 20+ 환경이 존재하고 ≥50% 기준 충족  
> EARLY SIGNAL: n<20 AND ≥80% 기준 충족  
> INSUFFICIENT DATA: n<10

---

### 5. Axis 1 임계값 상향 필요한가?

**예. 식별자 모호성 때문에 상향 필요.**

| 단계 | 권장 임계값 |
|------|-------------|
| 프로토타입 signal | ≥6 distinct session/project 쌍 |
| Public leaderboard | ≥15 distinct 쌍 |
| 신뢰할 수 있는 외부 adoption | ≥30 distinct 쌍 (developer/test 제외) |
| 강한 주장 | ≥50 distinct 쌍 + anti-Sybil 증거 |

---

## 핵심 결론 (five-axis-v2.md 반영 필요)

1. **Axis 1 threshold**: ≥6 → **≥15 distinct session/project 쌍**으로 상향
2. **Axis 1 정의**: "external users" → "distinct submitting environments/projects"
3. **식별자**: session_id primary + project_hash secondary. handle은 display-only.
4. **Axis 2**: 명시적 기준 추가 — median ≤ 10분 AND fail rate ≤ 20%, n ≥ 10
5. **Axis 3**: n ≥ 20이 되기 전까지 PASS 불가, INSUFFICIENT_DATA state 추가
6. **상태 추가**: PASS / FAIL 외에 **INSUFFICIENT_DATA** state 필수
