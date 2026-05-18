#!/usr/bin/env bash
# discover-logs.sh — Find candidate Claude/Codex log directories
# Outputs PATHS, FILE NAMES, and FILE COUNTS only.
# Does NOT output any log file contents.

echo "=== CoconutLabs PoC — Log Discovery ==="
echo "Date: $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "Searching for files modified in the last 2 days."
echo ""

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

for dir in "${CANDIDATE_DIRS[@]}"; do
  if [[ -d "$dir" ]]; then
    echo "--- $dir ---"
    # List subdirectories
    find "$dir" -maxdepth 2 -type d 2>/dev/null | head -20
    echo ""
    # Recent files (name + size only, no content)
    echo "  Recent files (last 2 days):"
    find "$dir" -type f -newer "$(date -v-2d '+%Y%m%d' 2>/dev/null || date -d '2 days ago' '+%Y%m%d' 2>/dev/null || echo '20260516')" \
      2>/dev/null | head -20 | while read -r f; do
      size=$(wc -c < "$f" 2>/dev/null || echo "?")
      ext="${f##*.}"
      echo "    $(basename "$f")  [.$ext, ${size}b]"
    done
    echo ""
  fi
done

echo "=== Discovery complete ==="
echo "Next: run search-marker.sh to check if the PoC marker appears in any file name."
