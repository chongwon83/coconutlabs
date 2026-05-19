"""CLI entrypoint: python -m coconut_collector [--json]

Builds a Burn Summary envelope from local Claude Code / Codex CLI logs.
Default output is a human table; --json prints the envelope JSON.
"""

import json
import sys

from .collect import build_envelope, print_table
from .hashing import load_or_create_salt
from .parsers import load_pricing


def main() -> None:
    args = sys.argv[1:]
    as_json = "--json" in args
    try:
        pricing = load_pricing()
    except RuntimeError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
    salt = load_or_create_salt()
    envelope = build_envelope(pricing, salt)
    if as_json:
        print(json.dumps(envelope, indent=2, ensure_ascii=False))
    else:
        print_table(envelope)


if __name__ == "__main__":
    main()
