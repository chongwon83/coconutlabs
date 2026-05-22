# Diff Summary — onboarding-closure Phase 2+4

## 변경 파일 목록

### tools/usage-poc/pyproject.toml (기존 파일 확인 — 이미 올바른 상태)
- `[project.scripts]` console_scripts 추가
- `[tool.hatch.build.targets.wheel]` packages 명세

### tools/usage-poc/coconut_collector/__main__.py (+75줄 / 신규 구현)
- `argparse` positional `path` argument 추가
- `RawTextHelpFormatter` 추가 (한/영 multiline help)
- `scan_root` Path 변환 + OSError try-except fallback
- `load_or_create_salt()` PermissionError/OSError 처리
- `build_envelope()` ValueError (no sessions, 기타) 처리
- `build_envelope()` 예상 외 Exception catch-all
- `_err()` helper 함수
- no-session 에러에 path context 포함

### tools/usage-poc/coconut_collector/collect.py (+scan_root 파라미터)
- `collect()` 시그니처: `scan_root: "Path | None" = None` 추가
- `find_logs(tool, scan_root=scan_root)` 호출
- `build_envelope()` 시그니처: `scan_root: "Path | None" = None` 추가
- `collect(..., scan_root=scan_root)` 전파

### tools/usage-poc/coconut_collector/parsers.py (+find_logs scan_root + importlib.resources)
- `load_pricing()`: `open(PRICING_PATH)` → `importlib.resources.files("coconut_collector").joinpath("model-pricing.json").read_text()`
- `find_logs(tool, scan_root=None)`: scan_root None 시 기존 동작, Path 시 scan_root/.claude/.codex 탐색

### tools/usage-poc/coconut_collector/model-pricing.json (신규)
- tools/usage-poc/model-pricing.json 에서 패키지 내부로 복사 (importlib.resources 지원)

### tools/usage-poc/README.md (신규/보강)
- `pip install coconut-collector` 설치 명령
- `coconut-collector ~/` 실행 예시
- `--period`, `--json` 옵션 설명

### tools/usage-poc/tests/test_collector.py (+2 테스트)
- `test_cli_entry_point_help_exits_zero` (test 19)
- `test_friendly_error_no_sessions` (test 20)
- 기존 `fake_find_logs(tool)` 6개 → `fake_find_logs(tool, scan_root=None)` (backward compat)
