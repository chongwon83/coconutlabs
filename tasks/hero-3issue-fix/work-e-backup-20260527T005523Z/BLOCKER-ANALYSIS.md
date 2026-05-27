# Work E Session A — BLOCKER Analysis

**Generated**: 2026-05-27 (UTC 20260527T005523Z)
**Severity**: HIGH (fail-closed, Session B must NOT proceed with --apply)
**Author**: Session A (Claude)

---

## TL;DR

The 4 target handles are stored in `burn:leaderboard` **without** the `@` prefix
(form: `contract-1779201784594-{month,dedup,trend,single}`). The reusable
cleanup script `scripts/cleanup-test-handle.mjs` enforces `HANDLE_RE = /^@[a-zA-Z0-9_-]+$/`
in `parseArgs()` (line 46) **before any Redis call**, so it rejects all 4
detected handles with `exit=1`. cleanup-test-handle.mjs cannot perform Work E
as-is, and the plan invariants forbid modifying it.

## Evidence

### 1. Leaderboard field names (from backup `leaderboard.json`)

```
"@chongwon83"                              ← owner row, must preserve
"contract-1779201784594-dedup"             ← target, NO @ prefix
"contract-1779201784594-month"             ← target, NO @ prefix
"contract-1779201784594-single"            ← target, NO @ prefix
"contract-1779201784594-trend"             ← target, NO @ prefix
```

5 fields total. Only `@chongwon83` has the `@` prefix.

### 2. cleanup-test-handle.mjs HANDLE_RE rejection

Per-target dry-run logs (in this same dir):
- `dryrun-contract-1779201784594-month.log`
- `dryrun-contract-1779201784594-dedup.log`
- `dryrun-contract-1779201784594-trend.log`
- `dryrun-contract-1779201784594-single.log`

Each log captures (exit=1 in every case):

```
Error: --handle must match /^@[a-zA-Z0-9_-]+$/ (got "contract-1779201784594-month"). Wildcards forbidden.
```

The rejection is in `parseArgs()` (cleanup-test-handle.mjs:76-80) **before**
`requireEnv()` (line 163) and **before** any Redis client construction (line 175).
No production data is touched by these dry-run attempts.

### 3. Why @-prefix variant also fails

If the operator instead invokes the script with `--handle @contract-1779201784594-month`:
- HANDLE_RE passes ✓
- requireEnv passes ✓
- `readState()` calls `redis.hget(LEADERBOARD_KEY, "@contract-...")` → `null` (no such field)
- `redis.hlen("burn:hist:@contract-...")` → 0
- `challenges.filter(r => r?.handle === "@contract-...")` → 0
- All zero ⇒ script prints `[noop] handle "@contract-..." has no traces in any of the 3 keys. Exiting.` (cleanup-test-handle.mjs:186-191) and exits 0 without performing any HDEL/DEL/LREM.

So neither the detected form (no-prefix, rejected by regex) nor the @-prefix
form (regex passes but lookup misses) lets cleanup-test-handle.mjs reach the
data.

## Root Cause Hypothesis

The handles were written through a code path that bypassed the server's
leaderboard-entry validator. Per SESSION_HANDOFF.md §1 row 5, these came from
the owner's own collector test (`@chongwon83` later acknowledged). The
collector likely posts the raw repo/account name (no `@`) and the write path
that landed them did not enforce `@` prefix on insert — only on read-side
validation. The production hot path (`route.ts` → `buildImportedEntry`)
normalises to `@`-prefix, but the collector branch evidently does not.

This is consistent with redisStore.ts being append-only with strict typed
shapes (it accepts whatever `handle: string` the caller hands it); the
prefix invariant is enforced at the *write call site*, not at the store layer.

## Options for Owner Decision

Listed in increasing impact order. Session B must remain blocked until owner
selects one explicitly.

### Option A — Modify cleanup-test-handle.mjs (smallest, plan-violating)

Relax HANDLE_RE to `/^@?[a-zA-Z0-9_-]+$/` OR `/^[a-zA-Z0-9_@_-]+$/`. Touches
exactly one line (cleanup-test-handle.mjs:46). Re-run dry-runs.

- **Pro**: minimal code change, preserves all other guard rails (`--force`,
  KNOWN_TEST_HANDLES, dry-run default, post-apply readback).
- **Con**: WORK_E_SESSION_PLAN.md §3 invariant explicitly forbids modifying
  cleanup-test-handle.mjs (line 49: "수정 금지"). Owner must override the
  invariant.
- **Risk**: relaxing the regex permanently broadens the script's reach. Could
  be reverted post-Work E (`git revert`), but the relaxation period is a
  blast-radius increase.

### Option B — Add new dedicated script (clean, separate)

Write `tasks/hero-3issue-fix/scripts/work-e-purge.mjs` that:
- Hard-codes the 4 target handles (no `--handle` arg).
- Hard-codes `@chongwon83` to a deny-list (refuse to touch).
- Mirrors cleanup-test-handle.mjs structure (BEFORE readback, plan, dry-run,
  --apply, AFTER readback) but accepts no-prefix handles by design.

- **Pro**: no shared-script regression, blast-radius narrower (4 handles
  fixed). Survives audit ("script that did this op is committed alongside the
  packet").
- **Con**: net-new ~250 LoC. Larger code review surface than Option A.
- **Risk**: any new script has its own bugs. Mitigated by mirroring the proven
  cleanup-test-handle.mjs structure.

### Option C — Owner uses Upstash console directly

Per the original SESSION_HANDOFF.md §3 (pre-2-session-split):
1. Backup hash (this Session A already produced it)
2. HDEL 4 handles in `burn:leaderboard`
3. DEL `burn:hist:contract-...` × 4

- **Pro**: zero code change, plan invariant intact. Backup already preserves
  exactness.
- **Con**: bypasses the dry-run/post-apply readback discipline. Owner has to
  manually transcribe handle names (4 chances for typo). No machine-readable
  audit log.
- **Risk**: typo could HDEL the wrong field (e.g. `@chongwon83`). Plan
  invariant #1 ("@chongwon83 row 보존") is at risk under manual entry.

### Option D — Defer / abandon

Leave the 4 rows in place. Hero stats remain `builders=5` instead of `1`.

- **Pro**: zero new risk.
- **Con**: SESSION_HANDOFF.md §3 Work E is the entire reason this 2-session
  plan exists. Abandoning leaves a known-bad data state visible in
  production.

## Recommendation (for codex consultation, not binding)

Option B (new dedicated script) is the cleanest path because:
- preserves WORK_E_SESSION_PLAN §3 invariant ("don't modify cleanup-test-handle.mjs")
- preserves machine-readable audit log (dry-run + apply logs)
- naturally encodes the "4 handles only, @chongwon83 protected" constraint
  via hard-coded lists rather than runtime args

But the final decision belongs to owner. /codex pre-apply gate (Session A
step A-4) is the next checkpoint and should weigh in.

## Handoff Packet Impact (Slot 11 judgment)

Per WORK_E_SESSION_PLAN.md §5 Slot 11 rule:
> APPLY_AUTHORIZED=true iff CODEX_VERDICT == "GO" AND CHONGWON83_IN_BACKUP == "yes"
> AND CHONGWON83_IN_DRYRUN == "no" AND DRYRUN_LOGS 4개 모두 "will remove 1 field" 표시.

The 4 dry-run logs do **not** show "will remove 1 field" — they show
`Error: --handle must match ...`. Therefore **APPLY_AUTHORIZED MUST be false**
in the packet, regardless of codex verdict.

Session B (apply step) is fail-closed blocked. Owner must select Option A/B/C/D
and re-enter Session A from the appropriate step.
