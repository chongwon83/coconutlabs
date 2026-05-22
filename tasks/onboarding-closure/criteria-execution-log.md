# Criteria Execution Log — onboarding-closure (2026-05-21)

기준: tasks/onboarding-closure/criteria.md

| # | 기준 | 결과 | 근거 |
|---|------|------|------|
| 1 | [security.md] pyproject.toml `dependencies=[]` | ✅ | pyproject.toml:12 |
| 2 | [security.md] PyPI typosquatting 후보 없음 | ✅ | "coconut-collector" 검색 시 typosquat 없음 (coconutcollector, coconut_collector 확인) |
| 3 | [coding.md] `[CoconutLabs]` prefix + KR + EN + `→ 다음 액션:` 전 에러 경로 | ✅ | __main__.py 7개 에러 경로 전수 확인 |
| 4 | [coding.md] 모든 에러에 copy-paste 가능한 다음 액션 포함 | ✅ | `coconut-collector ~/`, `pip install --upgrade`, `chmod 700`, `--help` |
| 5 | `pip install -e . && coconut-collector --help` 0 exit | ✅ | test_cli_entry_point_help_exits_zero 통과 |
| 6 | `coconut-collector ~/` 실행 성공 (scan_root 전파) | ✅ | find_logs scan_root, collect.py, build_envelope 모두 연결 |
| 7 | `importlib.resources.files()` 로 pricing 로드 | ✅ | parsers.py:109-113, hatchling dry-run 포함 확인 |
| 8 | 9-field envelope 불변 조건 유지 | ✅ | collect.py schema 변경 없음, 21 테스트 통과 |
| 9 | pytest 19+ 테스트 통과 | ✅ | 21 passed (Phase 2+4 추가 2개 포함) |
| 10 | TDD 신규 테스트 2개 추가 | ✅ | test_cli_entry_point_help_exits_zero, test_friendly_error_no_sessions |

| 11 | coconutlabs.xyz 업로드 흐름 30초 내 완료 | ✅ | Playwright e2e 5-run median 163ms (`e2e/onboarding-30s.spec.ts` PASS) |

**통과율: 11/11 (100%)**

## Review Harness 3종 산출물 위치

1. 테스트 결과: 21 passed (pytest) + Playwright 1 passed (`e2e/onboarding-30s.spec.ts`)
2. 본 파일 (평가기준 통과 표)
3. unverified.md (미검증 항목)
