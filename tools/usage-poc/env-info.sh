#!/usr/bin/env bash
# env-info.sh — Collect environment metadata for CoconutLabs usage PoC
# Outputs versions only. Does NOT read or output any log file contents.

echo "=== CoconutLabs PoC — Environment Info ==="
echo "Date: $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo ""

echo "--- OS ---"
uname -srm
if [[ "$(uname)" == "Darwin" ]]; then
  sw_vers -productVersion 2>/dev/null && true
fi
echo ""

echo "--- Claude Code ---"
if command -v claude &>/dev/null; then
  claude --version 2>/dev/null || echo "(version flag not supported)"
  echo "Location: $(command -v claude)"
else
  echo "Not found in PATH"
fi
echo ""

echo "--- Codex ---"
if command -v codex &>/dev/null; then
  codex --version 2>/dev/null || echo "(version flag not supported)"
  echo "Location: $(command -v codex)"
else
  echo "Not found in PATH"
fi
echo ""

echo "--- Python ---"
if command -v python3 &>/dev/null; then
  python3 --version
  echo "Location: $(command -v python3)"
else
  echo "Not found in PATH"
fi
echo ""

echo "--- Git ---"
if command -v git &>/dev/null; then
  git --version
else
  echo "Not found in PATH"
fi
echo ""

echo "=== Done ==="
