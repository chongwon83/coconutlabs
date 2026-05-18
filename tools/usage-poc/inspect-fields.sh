#!/usr/bin/env bash
# inspect-fields.sh — Extract field names from a candidate log file
# Usage: ./inspect-fields.sh <path-to-log-file>
#
# Outputs FIELD NAMES and COUNTS only.
# Does NOT output any log file contents, values, prompts, or source code.

if [[ -z "$1" ]]; then
  echo "Usage: $0 <path-to-log-file>"
  echo ""
  echo "Example: $0 ~/.claude/logs/session-abc123.jsonl"
  exit 1
fi

FILE="$1"

if [[ ! -f "$FILE" ]]; then
  echo "Error: File not found: $FILE"
  exit 1
fi

echo "=== CoconutLabs PoC — Field Inspection ==="
echo "File: $(basename "$FILE")"
echo "Extension: ${FILE##*.}"
echo "Size: $(wc -c < "$FILE") bytes"
echo "Date: $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo ""

echo "--- Detected field names (names only, no values) ---"

# Extract JSON key names using grep on key pattern "key": — count occurrences
# -o: print only the match, -i: case insensitive
grep -oEi '"[a-zA-Z_][a-zA-Z0-9_]*"\s*:' "$FILE" 2>/dev/null \
  | sed 's/"\s*://' \
  | sed 's/"//g' \
  | tr -d ' ' \
  | sort | uniq -c | sort -rn \
  | head -40 \
  | while read -r count field; do
      echo "  $field  (appears $count times)"
    done

echo ""
echo "--- Checking for common efficiency fields ---"

FIELDS_OF_INTEREST=(
  "tokens"
  "input_tokens"
  "output_tokens"
  "total_tokens"
  "cost"
  "cost_usd"
  "price"
  "model"
  "model_id"
  "session"
  "session_id"
  "timestamp"
  "duration"
  "tool"
  "tool_name"
)

for field in "${FIELDS_OF_INTEREST[@]}"; do
  count=$(grep -oi "\"${field}\"" "$FILE" 2>/dev/null | wc -l | tr -d ' ')
  if [[ "$count" -gt 0 ]]; then
    echo "  ✓ $field  ($count occurrences)"
  fi
done

echo ""
echo "=== Inspection complete ==="
echo "Record the field names above in the B-5 results template."
echo "Do NOT copy or share the file contents — field names only."
