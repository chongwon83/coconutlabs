# Phase 1 Audit — coconut-collector 온보딩 체크리스트

작성일: 2026-05-21

## 체크리스트 4항목 상태

| # | 항목 | 상태 | 근거 |
|---|------|------|------|
| 1 | `pip install coconut-collector && coconut-collector ~/` 동작 | ✅ 완료 | pyproject.toml + console_scripts + scan_root 구현 + 21 테스트 통과 |
| 2 | README GIF/screenshot 존재 | ⚠️ 부분 | README.md에 텍스트 설치 안내 추가됨. CLI demo GIF 없음 (Phase 5 미완) |
| 3 | 30초 업로드 흐름 | ✅ 완료 | Playwright e2e 5-run median 163ms (<<30s). `e2e/onboarding-30s.spec.ts` |
| 4 | 친절한 에러 메시지 (KR/EN) | ✅ 완료 | [CoconutLabs] prefix + 한국어 + English + → 다음 액션: 전 경로 커버 |

## 항목 #1 audit detail

- `pyproject.toml` 신규 생성: hatchling build, `requires-python>=3.9`, `dependencies=[]`
- `console_scripts`: `coconut-collector = "coconut_collector.__main__:main"`
- `coconut_collector/model-pricing.json` 패키지 내부 복사 → `importlib.resources.files()` 로드
- `find_logs(tool, scan_root=None)` — None 시 기존 동작, Path 시 scan_root/.claude/.codex 탐색
- `build_envelope(..., scan_root=None)` → `collect(..., scan_root=None)` 전파
- hatchling wheel build dry-run 확인: `model-pricing.json` 포함됨 ✅

## 항목 #4 audit detail (에러 경로 전수)

| 경로 | 메시지 품질 | 처리 |
|------|------------|------|
| 경로 인수 `is_dir()` 실패 | ✅ [CoconutLabs] + KR + EN + 다음 액션 | __main__.py:44-49 |
| `resolve()` OSError | ✅ try-except → expanduser() fallback | __main__.py:42-44 |
| `load_pricing()` RuntimeError | ✅ [CoconutLabs] + KR + EN + 다음 액션 | __main__.py:51-60 |
| `load_or_create_salt()` PermissionError/OSError | ✅ [CoconutLabs] + KR + EN + chmod hint | __main__.py:62-70 |
| `build_envelope()` ValueError (no sessions) | ✅ [CoconutLabs] + path context + 다음 액션 | __main__.py:72-82 |
| `build_envelope()` ValueError (기타) | ✅ [CoconutLabs] + msg + help hint | __main__.py:83-89 |
| `build_envelope()` 예상 외 Exception | ✅ [CoconutLabs] + issues URL | __main__.py:90-95 |

## /codex 교차 리뷰 결과 (2026-05-21)

**CRITICAL (false positive 1건)**:
- `model-pricing.json` 미포함 우려 → hatchling dry-run으로 반증. `packages=["coconut_collector"]`는 비Python 파일 포함 ✅

**CRITICAL (실 수정 2건)**:
- `load_or_create_salt()` PermissionError/OSError 미처리 → 수정 완료
- `Path.resolve()` OSError 미처리 → try-except fallback 추가

**HIGH (수정 2건)**:
- `load_or_create_salt()` 예외 처리 추가 완료
- `build_envelope()` 예상 외 Exception catch-all 추가

**MEDIUM (수정 1건)**:
- argparse `RawTextHelpFormatter` 추가 → 한/영 multiline help 정상 렌더링

**검토 후 수정 안 한 항목**:
- `find_logs()` invalid tool name silent fallback: 내부 함수, 호출자는 hardcoded "claude"/"codex"만 사용 → 위험도 낮음
- `scan_root` str coercion: collect.py 호출 경로는 Path로 전달 보장됨
- `quoted type hint` in collect.py: Python 3.11+ union 문법 호환성 이슈 없음
