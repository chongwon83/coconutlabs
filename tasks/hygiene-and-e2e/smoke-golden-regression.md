# Smoke / Golden Regression — Hygiene + e2e Phase #1 (2026-05-22)

Owner Happy Path 1회 직접 실행 결과 + golden snapshot 비교.

**⚠️ owner 직접 손기록 의무** — 자동 append 금지 (`[auto]` prefix 사용 금지).
형식: `YYYY-MM-DD HH:MM | owner-recorded | <command> | <one-line result>`

| 2026-05-22 18:13 | owner-recorded | npm run test:e2e | 3 passed (4.5s), onboarding-30s median 126ms, retries 0 |

---

## Placeholder (Step 7에서 owner가 직접 채움)

```
[Step 7 절차]
$ cd web
$ npm run test:e2e
# 결과를 아래 표 형식으로 owner가 직접 1줄 기록
```

---

## Owner Records

| 시각 (KST) | 기록자 | 실행 명령 | 결과 |
|-----------|--------|----------|------|
| _(미작성)_ | owner-recorded | `npm run test:e2e` | _(Step 7에서 owner 직접 기록)_ |

---

## Golden Snapshot 비교 기준

| 항목 | Golden | 허용 차이 |
|------|--------|----------|
| 통과 spec 수 | 3 / 3 | ❌ 1건이라도 fail 시 차단 |
| Wall-clock | 4.5s | ≤ 10s (CI workers=1 변동 허용) |
| onboarding-30s median | 120ms | ≤ 30,000ms (threshold) |
| retries 발생 | 0 | CI는 retries=1 허용 (단 retry로 통과한 경우는 unverified.md #2 점검 대상) |

---

## 차이 검출 시 owner 액션

- spec fail → 본 사이클 commit 보류, 원인 조사 (component drift 의심)
- wall-clock > 10s → 환경 노이즈 가능 (재실행 1회), 그래도 초과 시 dev server 콜드 스타트 점검
- median > 30s → onboarding-30s 회귀, 본 commit 보류
- retry로 통과 → unverified.md #2 follow-up 우선순위 P1로 승격
