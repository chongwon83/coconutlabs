# CoconutLabs Usage PoC — Track B Guide

This document guides you through the technical hypothesis validation for
CoconutLabs: **Can personal CLI usage data be reliably collected device-side
with verifiable trust levels?**

This is a manual, local-only exercise. No data leaves your machine.

---

## Security Rules (read first)

- **Never copy/share log file contents.** Only filenames, paths, field names, and file formats.
- **Never run scripts in your real work repos.** Use the test repo below only.
- The marker is a session identifier for PoC isolation — do not use in real work.

---

## B-1. Create the test repo

```bash
mkdir ~/coconutlabs-usage-poc
cd ~/coconutlabs-usage-poc
git init

cat > calculator.py << 'EOF'
def add(a, b):
    return a + b

def subtract(a, b):
    return a - b

def multiply(a, b):
    return a * b

def divide(a, b):
    return a / b  # Bug: no zero-division guard
EOF

cat > test_calculator.py << 'EOF'
import pytest
from calculator import add, subtract, multiply, divide

def test_add():
    assert add(2, 3) == 5

def test_subtract():
    assert subtract(5, 3) == 2

def test_multiply():
    assert multiply(3, 4) == 12

def test_divide():
    assert divide(10, 2) == 5.0

def test_divide_by_zero():
    # divide() should guard against zero and return None — WILL fail initially
    assert divide(5, 0) is None
EOF

git add .
git commit -m "chore: init calculator poc repo"
```

Expected: `test_divide_by_zero` fails (raises `ZeroDivisionError`) because
`divide()` has no zero-division guard. The agent's task is to add the guard.

---

## B-2. Claude Code CLI test

From `~/coconutlabs-usage-poc`, run Claude Code CLI, then enter this prompt
**exactly** (marker must be included):

```
COCONUTLABS_USAGE_POC_2026_05_18
이 repo에서 파이썬 유닛테스트를 실행하고, 실패 테스트를 찾아 calculator.py만 수정해줘.
test_calculator.py는 바꾸지 마. 수정 후 테스트 재실행하고 변경점을 요약해줘.
```

Record:
- Session start/end time
- Whether all tests passed after the fix
- Whether CLI showed usage/cost summary at end of session

---

## B-3. Codex CLI test

Isolate cleanly before running Codex:

```bash
cd ~/coconutlabs-usage-poc
git checkout -b codex-test-001
git reset --hard HEAD

# Preview what would be cleaned (dry run first!)
git clean -n

# Only run if output shows ONLY poc files (no real work files)
git clean -fd
```

Then run Codex CLI with the **same marker prompt** from B-2. Record same items.

> ⚠️ `git clean -fd` deletes untracked files permanently. Always run `git clean -n`
> first and confirm only PoC files appear before running `-fd`.

---

## B-4. Environment and log discovery

Use the scripts in `tools/usage-poc/` in order:

```bash
# From the web/ directory:
cd tools/usage-poc
chmod +x *.sh

# 1. Environment info
./env-info.sh

# 2. Discover candidate log directories (last 2 days)
./discover-logs.sh

# 3. Search for the marker in file NAMES only (no content)
./search-marker.sh

# 4. Inspect field names in a candidate file (supply path as argument)
#    Example: ./inspect-fields.sh ~/.claude/logs/session-abc123.jsonl
./inspect-fields.sh <path-to-candidate-file>
```

**What to record from each script:**
- `env-info.sh` → OS, claude/codex versions, python/git versions
- `discover-logs.sh` → candidate directories, file extensions, count of recent files
- `search-marker.sh` → whether marker was found, in which directory/format
- `inspect-fields.sh` → field names detected (token/cost/model/session/etc.), file format

---

## B-5. Results template

Fill in and share. **File paths and field names only — no file contents.**

```
=== CoconutLabs Usage PoC Results ===
Date: 2026-05-18
Marker: COCONUTLABS_USAGE_POC_2026_05_18

--- Environment ---
OS:
Claude Code version:
Codex version (if available):
Python:
Git:

--- Claude Code ---
Usable: yes / no / not installed
Marker found in logs: yes / no / unsure
Candidate log path format: (e.g. ~/.claude/logs/*.jsonl)
File format: (e.g. JSONL, JSON, SQLite, binary)
Detected fields: (e.g. tokens, cost, model, session_id, timestamp)
CLI showed usage/cost at session end: yes / no
Notes:

--- Codex ---
Usable: yes / no / not installed
Marker found in logs: yes / no / unsure
Candidate log path format:
File format:
Detected fields:
CLI showed usage/cost at session end: yes / no
Notes:

--- Assessment ---
Easier to track: Claude Code / Codex / neither
Summary-without-raw-content feasible: yes / probably / no
Recommendation: Go / Hold / No-go
```

---

## Verdict criteria (from handoff §20)

| Result | Verdict |
|--------|---------|
| Marker found, fields include token+cost, no raw prompt in extracted data | **Go** — device collection is viable |
| Marker found but field extraction is ambiguous or format is binary | **Hold** — investigate format before building collector |
| Marker not found, or log format exposes raw content in extraction | **No-go** — rethink collection approach |

---

*This PoC validates hypothesis #2: "Personal CLI usage can be device-synced with
verifiable trust." Results feed the Go/Hold/No-go decision for the real collector.*
