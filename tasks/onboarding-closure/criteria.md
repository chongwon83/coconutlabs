# 평가기준 — onboarding-closure (2026-05-21)

1. [security.md 공급망] `pyproject.toml` `dependencies = []` 또는 stdlib-only — 외부 의존성 없음
2. [security.md 공급망] PyPI 패키지명 `coconut-collector` typosquatting 후보(`coconut_collector`, `coconut-collect` 등) PyPI 페이지에서 owner가 직접 1회 확인
3. [coding.md] `__main__.py` 모든 `sys.exit` 경로에 `[CoconutLabs]` 접두어 + 한국어 + 영어 + `→ 다음 액션:` 친절 메시지 포함
4. [coding.md] 모든 에러 메시지가 `copy-paste 가능한 명령` 또는 "알려주세요" 링크를 포함
5. [packaging] `pip install -e tools/usage-poc/` 성공 → `coconut-collector --help` 0 exit
6. [packaging] `coconut-collector ~/` 실행 시 envelope JSON 또는 사람용 표가 출력 (0 exit)
7. [packaging] 패키지 설치 후 `model-pricing.json`이 `importlib.resources`로 정상 로드 (`PRICING_PATH` 하드코딩 제거)
8. [PRD §8 Burn Summary] envelope schema 9-field 불변식 — `projectHash`, `tool`, `model`, `tokenCount`, `estimatedCostUsd`, `timestampBucket`, `sessionCount`, `activeDays`, `verification` 모두 존재, 경로/content 0건
9. [testing] `pytest tools/usage-poc/tests/ -q` — 기존 19+ 테스트 전부 통과 (회귀 0)
10. [testing] 신규 TDD 테스트 2건 이상 추가: `test_cli_entry_point_help_exits_zero`, `test_friendly_error_no_sessions`
