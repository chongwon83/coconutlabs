# S3.5 Design — coconut-collector PyPI 패키징 + path arg + 에러 메시지 (2026-05-21)

## 1. 인터페이스 명세

### console_scripts entry point
```
coconut-collector [path] [--period {day,week,month,year,all}] [--json]
```
- `path` (optional positional): 로그 탐색 루트 디렉토리. 미지정 시 표준 경로(`~/.claude`, `~/.codex`) 사용.
- `--period`: 기존 동일
- `--json`: 기존 동일

### find_logs(tool, scan_root=None) — parsers.py
```python
def find_logs(tool: str, scan_root: Path | None = None) -> list[Path]:
```
- `scan_root=None` → 기존 동작 (CLAUDE_LOG_GLOB / CODEX_LOG_GLOB 절대 base)
- `scan_root=Path("/Users/foo")` → `scan_root / ".claude/projects" / "*/*.jsonl"` glob

### collect(pricing, salt, period="all", now=None, scan_root=None) — collect.py
```python
def collect(pricing: dict, salt: str, period: str = "all",
            now: datetime | None = None, scan_root: Path | None = None) -> dict:
```
- `scan_root`를 `find_logs(tool, scan_root)` 에 전달
- 기존 호출자(build_envelope, tests) 호환 — default None

### build_envelope(pricing, salt, generated_at=None, period="week", scan_root=None) — collect.py
```python
def build_envelope(pricing: dict, salt: str, generated_at: str | None = None,
                   period: str = "week", scan_root: Path | None = None) -> dict:
```
- `scan_root`를 `collect()` 에 전달

### load_pricing() — parsers.py
```python
# Before (하드코딩):
PRICING_PATH = Path(__file__).parent.parent / "model-pricing.json"

# After (importlib.resources, Python 3.9+):
from importlib.resources import files
def load_pricing() -> dict:
    data = files("coconut_collector").joinpath("model-pricing.json").read_text("utf-8")
    return json.loads(data)
```
→ `model-pricing.json`을 `coconut_collector/` 패키지 디렉토리로 이동 (또는 심볼릭 링크)

## 2. 데이터 흐름

```
CLI args
  └─ path (optional) → scan_root: Path | None
       ↓
__main__.main()
  ├─ load_pricing()  ← coconut_collector/model-pricing.json (importlib.resources)
  ├─ load_or_create_salt()
  └─ build_envelope(pricing, salt, period=period, scan_root=scan_root)
       └─ collect(pricing, salt, period, now, scan_root)
            └─ find_logs("claude", scan_root) + find_logs("codex", scan_root)
                 claude: scan_root/.claude/projects/*/*.jsonl
                 codex:  scan_root/.codex/sessions/*/*/*/rollout-*.jsonl
```

## 3. 파일 경계

| 모듈 | 변경 범위 |
|------|-----------|
| `pyproject.toml` | 신규: hatchling build, console_scripts, package_data |
| `coconut_collector/__main__.py` | positional `path` arg + scan_root 전달 + 친절 에러 메시지 |
| `coconut_collector/collect.py` | `scan_root` 인자 추가 (collect + build_envelope) |
| `coconut_collector/parsers.py` | `find_logs(scan_root)` + `load_pricing` → importlib.resources |
| `coconut_collector/model-pricing.json` | `tools/usage-poc/model-pricing.json`을 복사/이동 |
| `tests/test_collector.py` | TDD 2건 추가 |
| `tools/usage-poc/README.md` | 신규: 설치/실행 1줄 |

## 4. 불변 조건 (invariants)

- `scan_root=None` 시 동작은 현행과 **완전 동일** — 기존 19+ 테스트 회귀 0건
- `model-pricing.json`은 `coconut_collector/` 내부에 존재, `PRICING_PATH` 하드코딩 제거
- `pyproject.toml`의 `dependencies = []` — 외부 의존성 없음
- envelope의 9-field 불변식 불변 (경로/content 노출 없음)
- `coconut-collector --help` 0 exit, `coconut-collector ~/` 0 exit (세션 있을 때)
