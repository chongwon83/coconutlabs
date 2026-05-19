"""CLI entrypoint: python -m coconut_collector [--json] [--period P]

Builds a Burn Summary envelope from local Claude Code / Codex CLI logs.
Default output is a human table; --json prints the envelope JSON.
"""

import argparse
import json
import sys

from .collect import build_envelope, print_table
from .hashing import load_or_create_salt
from .parsers import load_pricing


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="python -m coconut_collector",
        description="로컬 CLI 세션 로그에서 CoconutLabs Burn Summary 생성")
    parser.add_argument("--json", action="store_true",
                        help="사람용 표 대신 envelope JSON 출력")
    parser.add_argument("--period", choices=["day", "week", "month", "year", "all"],
                        default="week",
                        help="집계할 캘린더 윈도우 (기본: week)")
    args = parser.parse_args()

    try:
        pricing = load_pricing()
    except RuntimeError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
    salt = load_or_create_salt()
    try:
        envelope = build_envelope(pricing, salt, period=args.period)
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
    if args.json:
        print(json.dumps(envelope, indent=2, ensure_ascii=False))
    else:
        print_table(envelope)


if __name__ == "__main__":
    main()
