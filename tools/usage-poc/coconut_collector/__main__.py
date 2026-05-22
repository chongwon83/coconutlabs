"""CLI entrypoint: coconut-collector [path] [--json] [--period P]

Builds a Burn Summary envelope from local Claude Code / Codex CLI logs.
Default output is a human table; --json prints the envelope JSON.
"""

import argparse
import json
import sys
from argparse import RawTextHelpFormatter
from pathlib import Path

from .collect import build_envelope, print_table
from .hashing import load_or_create_salt
from .parsers import load_pricing

_ISSUES_URL = "https://github.com/chongwon83/coconutlabs/issues"


def _err(lines: list[str]) -> None:
    print("\n".join(lines), file=sys.stderr)


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="coconut-collector",
        formatter_class=RawTextHelpFormatter,
        description="로컬 CLI 세션 로그에서 CoconutLabs Burn Summary 생성\n"
                    "Generates a CoconutLabs Burn Summary from local CLI session logs.")
    parser.add_argument(
        "path", nargs="?", default=None,
        metavar="PATH",
        help="로그 탐색 루트 디렉토리 (기본: 표준 설치 경로 자동 탐색)\n"
             "Root directory to scan for logs (default: standard install paths)")
    parser.add_argument("--json", action="store_true",
                        help="사람용 표 대신 envelope JSON 출력")
    parser.add_argument("--period", choices=["day", "week", "month", "year", "all"],
                        default="week",
                        help="집계할 캘린더 윈도우 (기본: week)")
    args = parser.parse_args()

    scan_root: Path | None = None
    if args.path is not None:
        try:
            scan_root = Path(args.path).expanduser().resolve()
        except (OSError, ValueError):
            scan_root = Path(args.path).expanduser()
        if not scan_root.is_dir():
            _err([
                f"[CoconutLabs] 경로를 찾을 수 없습니다: {args.path}",
                f"              Path not found: {args.path}",
                f"              → 다음 액션: coconut-collector ~/"
            ])
            sys.exit(1)

    try:
        pricing = load_pricing()
    except RuntimeError:
        _err([
            "[CoconutLabs] 모델 단가 파일을 로드할 수 없습니다.",
            "              Could not load the model pricing table.",
            f"              → 다음 액션: pip install --upgrade coconut-collector",
            f"              → 문제 지속 시: {_ISSUES_URL}"
        ])
        sys.exit(1)

    try:
        salt = load_or_create_salt()
    except (PermissionError, OSError) as e:
        _err([
            f"[CoconutLabs] 디바이스 솔트 파일 접근 실패: {e}",
            f"              Cannot read/create device salt (~/.coconutlabs/salt): {e}",
            f"              → 다음 액션: chmod 700 ~/.coconutlabs",
            f"              → 문제 지속 시: {_ISSUES_URL}"
        ])
        sys.exit(1)

    try:
        envelope = build_envelope(pricing, salt, period=args.period,
                                  scan_root=scan_root)
    except ValueError as e:
        msg = str(e)
        if "no sessions" in msg:
            path_hint = f" {args.path}" if args.path else ""
            _err([
                f"[CoconutLabs] '{args.period}' 기간에 세션 로그가 없습니다 (탐색 경로:{path_hint or ' 기본 경로'}).",
                f"              No session logs found in the '{args.period}' window (root:{path_hint or ' default paths'}).",
                f"              → 다음 액션: coconut-collector --period all",
            ])
        else:
            _err([
                f"[CoconutLabs] 입력 오류 — {msg}",
                f"              Input error — {msg}",
                f"              → 다음 액션: coconut-collector --help",
                f"              → 문제 지속 시: {_ISSUES_URL}"
            ])
        sys.exit(1)
    except Exception as e:
        _err([
            f"[CoconutLabs] 예상치 못한 오류 — {e}",
            f"              Unexpected error — {e}",
            f"              → 문제 지속 시: {_ISSUES_URL}"
        ])
        sys.exit(1)

    if args.json:
        print(json.dumps(envelope, indent=2, ensure_ascii=False))
    else:
        print_table(envelope)


if __name__ == "__main__":
    main()
