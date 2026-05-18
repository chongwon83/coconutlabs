# Decision Log

이 문서는 프로젝트의 설계 결정과 맥락을 기록한다.
S0에서 작성, S10에서 회고 2줄 추가.

## 엔트리 포맷

### YYYY-MM-DD [기능/결정 이름]
- 문제:
- 버린 대안:
- 핵심 트레이드오프:
- 선택 이유:
- 강한 증거(직접 겪음/유사 사례):

[S10 완료 후 추가]
- 무엇이 잘 됐나:
- 다음엔 무엇을 바꿀까:

---

### 2026-05-18 usage PoC — 단가표 확장 + estimate_cost.py

- 문제: `estimate_cost.py`가 cost를 추정하려면 전 모델 단가표가 필요한데, 초기
  `model-pricing.json`은 claude 3행·codex 1행 + PoC 추정치라 대부분 `_default`
  fallback(`price_confidence: low`)으로 떨어지고 Opus 단가가 3배 과대였다.
- 버린 대안: 와일드카드 키(`claude-opus-4-x`) — minor 버전별 단가가 갈려
  (Opus 4.7~4.5=$5 vs 4.1~4.0=$15) 잘못된 단가를 적용하게 됨.
- 핵심 트레이드오프: minor 버전 단위 명시 키 30행 = 유지보수 부담 ↑ vs 정확도.
- 선택 이유: 정확도 우선. `match_model` longest-prefix가 minor 키를 정확 분기.
- 강한 증거: `/codex` 교차 리뷰가 pro 모델 cached_input 오류를 실제로 검출.
  공식 페이지 + 제3자 2사이트 교차검증으로 30행 전수 확인.

- 무엇이 잘 됐나: "정말 확실하냐" 압박에 거짓 확신 대신 live WebFetch 재검증.
  `/codex` 교차 리뷰가 실 결함 1건(pro cached 할인 오적용) 검출.
- 다음엔 무엇을 바꿀까: 신규 트랙 시작 시 S0(decision-log)·Pre-S0(vault) 게이트를
  거를 것. 단가표는 `_pricing_as_of` 기준 분기별 재검증 필요 — 일정화.

---

### 2026-05-19 usage PoC — 전 세션 누적 집계 (`--all`)

- 문제: `estimate_cost.py`가 단일 세션만 추정. 사용자 전체 토큰/비용을 보려면
  세션 로그를 수동으로 일일이 합산해야 했다.
- 버린 대안: 외부 합산 스크립트 별도 작성 — `parse_claude`/`parse_codex` 파싱
  로직이 중복되고 단가 매칭도 재구현해야 함.
- 핵심 트레이드오프: `estimate_cost.py` 비대화(+117줄) vs 단일 진입점 일관성.
- 선택 이유: 기존 파서·`match_model`·`cost_breakdown` 전부 재사용 → 코드 중복 0.
  `find_logs` + `aggregate_sessions`만 신규.
- 강한 증거: `--all` 실행 중 `<synthetic>` 그룹이 318M 토큰/$287를 `_default`
  단가로 오분류한 것을 직접 발견. 단일 세션 테스트로는 안 보이던
  last-seen-model 미스어트리뷰션 버그를 누적 집계가 노출시킴.

- 무엇이 잘 됐나: 누적 집계가 미스어트리뷰션 버그를 표면화. 구조 점검
  (`<synthetic>` 28라인 = 0토큰 확인)으로 추측 아닌 증거 기반 수정.
- 다음엔 무엇을 바꿀까: `parse_claude`는 세션당 단일 모델을 가정(파일 전체를
  마지막 비-synthetic 모델로 합산). 한 세션이 모델을 바꾸면 여전히 한 모델로
  몰림 — 알려진 한계. 정확도 필요 시 라인 단위 모델 귀속으로 전환.
