# 평가기준 — Rollout Gate 무결성 완결 v2 (B+ 확장)
# 작성: 2026-05-21 | A4 Evaluator 산출물 | 캐시 금지 (매 작업 재스캔)

---

## Must-pass (단 1개라도 fail → owner "완료" 발화 금지)

1. **[security]** `/api/burnindex` 무토큰 POST → 401 응답 (curl 직접 시도)
2. **[security]** `/api/telemetry/auto-detect` 무토큰 POST → 401 응답
3. **[security]** 만료 토큰(ttl 경과) 사용 → 401 응답
4. **[security]** 토큰 nonce 재사용 시도 → 401 응답
5. **[security]** `COLLECTOR_HMAC_SECRET`이 클라이언트 bundle에 평문 미노출 — `npm run build && grep -r COLLECTOR_HMAC_SECRET .next/` → 0건
6. **[integrity]** Phase A 매트릭스 10셀 (6 base + 4 α셀) owner 직접 기록, 예상 결과 전부 일치
7. **[integrity]** `getMetricsSnapshot()`이 v2 namespace(`burn:metrics:v2:*`)만 읽음 — grep + 통합 테스트로 v1 키 미참조 확인
8. **[ci-integrity]** CI workflow secrets 미설정 → `gate_result=FAIL`, exit 1 (silent PASS 차단)
9. **[ci-integrity]** gate_result가 `PASS`|`FAIL` 외 값 → exit 1 (allowlist 적용)
10. **[ci-integrity]** CI workflow 스크립트에 `set -euo pipefail` 적용

---

## Should-pass (≥ 80% = 5/6 이상 통과)

11. 정상 토큰 발급 → `/api/burnindex` 또는 `/api/telemetry/auto-detect` POST → 200 그린 경로 회귀
12. Vercel deployment protection workaround 명시 (`status-2026-05-21.md`에 "CI에서 prod gate-metrics 호출 불가, owner local curl workaround 필요" 기록)
13. Axis 2 abandonment — `started - completed - failed = abandoned` 계산이 `getMetricsSnapshot` 반환값에 포함됨
14. vitest 전체 그린 (98 → 동등 또는 증가), `npx tsc --noEmit` EXIT 0, `npm run lint` 클린
15. `status-2026-05-21.md` — 5대 결함 closed 표시 반영
16. `docs/decision/decision-log.md` — 2026-05-21 엔트리 (5줄: 문제/버린 대안/트레이드오프/선택 이유/강한 증거) 추가

---

## 참조 출처

- [security.md] API 키·시크릿 하드코딩 0건, .env 사용
- [coding.md] 외부 의존성(Redis, HMAC) try-except 처리
- [golden-principles.md] Tier1 #3 Evidence-Based — 실행 로그 없이 "완료" 금지
- [golden-principles.md] Tier1 #4 — Destructive(배포) 명시 확인 후 발동
- [codex BLOCK 2026-05-21] HIGH #1~6 findings — HMAC 토큰, namespace bump, CI hardening
- [task-standards.md] 보안 민감 → codex 교차 리뷰 의무 + S8 /cso 병행 검토
