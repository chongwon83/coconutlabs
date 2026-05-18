#!/usr/bin/env bash
# search-marker.sh — Search for the PoC marker in candidate log directories
# Outputs MATCHING FILE NAMES AND PATHS only.
# Does NOT output any log file contents, lines, or surrounding context.

MARKER="COCONUTLABS_USAGE_POC_2026_05_18"

CANDIDATE_DIRS=(
  "$HOME/.claude"
  "$HOME/.config/claude"
  "$HOME/Library/Application Support/claude"
  "$HOME/Library/Caches/claude"
  "$HOME/.codex"
  "$HOME/.config/codex"
  "$HOME/Library/Application Support/codex"
  "$HOME/Library/Logs/claude"
  "$HOME/Library/Logs/codex"
)

echo "=== CoconutLabs PoC — Marker Search ==="
echo "Marker: $MARKER"
echo "Date: $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo ""
echo "Searching for files that CONTAIN the marker string..."
echo "(Only file names and paths are shown — no file contents)"
echo ""

found_any=0

for dir in "${CANDIDATE_DIRS[@]}"; do
  if [[ -d "$dir" ]]; then
    # -l flag: print file names only, not matching lines
    matches=$(grep -rl "$MARKER" "$dir" 2>/dev/null)
    if [[ -n "$matches" ]]; then
      echo "--- Found in: $dir ---"
      echo "$matches" | while read -r f; do
        ext="${f##*.}"
        size=$(wc -c < "$f" 2>/dev/null || echo "?")
        echo "  $f  [.$ext, ${size}b]"
      done
      echo ""
      found_any=1
    fi
  fi
done

if [[ "$found_any" -eq 0 ]]; then
  echo "Marker not found in any candidate directory."
  echo ""
  echo "Possible reasons:"
  echo "  1. Claude/Codex was not run with this marker yet"
  echo "  2. Logs are stored in a different location"
  echo "  3. Logs are not retained between sessions"
  echo "  4. Log format does not preserve full prompt text"
fi

echo ""
echo "=== Search complete ==="
echo "Next: run inspect-fields.sh <path> on a matching file to see field names."
