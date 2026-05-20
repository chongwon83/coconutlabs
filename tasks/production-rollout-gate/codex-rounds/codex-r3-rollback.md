# Codex R3 — Rollback Trigger Design

**날짜**: 2026-05-20  
**질문**: ON 전환 후 axes 1/2/3 하락 시 자동 rollback 트리거가 필요한가? rollback 조건 설계 가이드

---

## Codex 답변

### 1. 자동 rollback 필요한가?

**아니오. 현재 규모에서는 human-triggered rollback으로 충분하다.**

소규모 트래픽, no auth, solo 운영에서 automated rollback은 false positive만 만든다. 단 **빠른 수동 kill switch**는 필수 — privacy blast radius 때문에 "prod에서 디버깅"은 허용 불가.

---

### 2. Rollback 메커니즘 (git revert 금지)

**runtime flag 사용. git revert를 primary rollback으로 쓰지 말 것.**

```
NEXT_PUBLIC_AUTO_DETECT_DEFAULT=true
```

Rollback = 이 환경변수를 `false`로 변경 후 redeploy.

긴급 fallback: **Vercel Instant Rollback** (이전 production deployment로 즉시 복원).

---

### 3. Hard Rollback Signals (즉시 OFF 복귀)

Privacy 또는 UX 파손 시에만. "metrics down"으로는 rollback 금지.

Privacy 관련 (즉시 rollback):
- FSA picker가 명확한 user action 없이 자동으로 열림
- 선택된 file path/name/content가 analytics/logging으로 전송됨
- Upload/import가 명시적 확인 전에 시작됨
- 3명 이상의 독립 사용자 보고: "file picker", "local files", "permissions", "privacy" 언급

UX 파손 관련 (즉시 rollback):
- Raw file picker가 첫 페이지 로드 시 표시됨
- Browser unsupported case에서 graceful fallback 대신 broken FSA UI 표시됨
- 의도된 log-detection flow 외의 arbitrary file 선택 허용

---

### 4. Watch Signals (조사하되 즉시 rollback 아님)

유용한 degradation signals:
- `NotAllowedError`, `AbortError`, `SecurityError`, `NotFoundError` spike — `showDirectoryPicker` 또는 FSA detection 코드 관련
- Failed auto-detect session 증가: picker 열렸지만 valid log 미검출
- `JoinBurnIndexForm.tsx` 또는 FSA helper 코드에서 client-side exception 증가

**주의**: user가 picker를 닫을 때 발생하는 `AbortError`는 정상 동작 — complaint 또는 broken UI와 correlate하지 않는 한 noise 처리.

---

### 5. Small Sample 규칙 (절대값 임계 사용)

퍼센트만으로는 소규모에서 의미 없음 (1 → 3 실패 = "catastrophic"처럼 보임).

| 조건 | 조치 |
|------|------|
| Privacy leak 또는 unintended file selection 1건이라도 confirmed | 즉시 rollback |
| 24시간 내 3명 독립 사용자 보고 (unexpected picker/privacy confusion) | 즉시 rollback |
| 1시간 내 5건+ FSA-related uncaught client error (distinct sessions) | 즉시 rollback |
| FSA flow completion < 50% (최소 20 attempts, dogfood baseline 의미 있게 높을 때) | rollback 검토 |
| 단일 세션 고립 에러 | 조사, rollback 아님 |

---

### 6. Monitoring Period

ON flip 후 안정 선언 기준:

| 기간 | 조치 |
|------|------|
| 처음 2시간 | 수동 watch: Chrome/Safari/Firefox/모바일 직접 테스트 |
| 처음 24시간 | Active rollout window — 에러 및 사용자 피드백 능동 모니터링 |
| 7일 후 | Privacy 이슈, 반복 complaint, error spike 없으면 stable 선언 |
| 단 몇 세션 clean | stable 선언 불가 |

---

### 7. 실제 Rollback 절차 (Vercel)

1. `NEXT_PUBLIC_AUTO_DETECT_DEFAULT=false` 환경변수 변경
2. Production redeploy
3. Deploy 블락 또는 bad version 심각할 경우: Vercel Instant Rollback
4. 이후 코드 fix/revert commit으로 repo가 production intent와 일치하도록

---

## 핵심 결론 (five-axis-v2.md 반영 필요)

1. **자동 rollback 불필요** — 수동 kill switch + 명확한 rollback 기준으로 충분
2. **환경변수 kill switch 추가**: `NEXT_PUBLIC_AUTO_DETECT_DEFAULT` (기본값 `false`)
3. **Privacy 파손 = 즉시 OFF** (비협상)
4. **Rollback 기준 문서화**: branch-protection-setup.md에 포함
5. **Monitoring period**: ON flip 후 24시간 active watch, 7일 passive watch
