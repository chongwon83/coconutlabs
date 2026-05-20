# Handoff Packet — coconut-burn-import (10 elements)

> **Read this file ONLY** after `/clear`. Everything needed to resume is below. Standing instruction: work without stopping for clarifying questions; make the reasonable call and continue, the user will redirect if needed.

---

## SESSION UPDATE — 2026-05-20 (feat/burn-import-fsa branch)

### Completion status

| Step | Status | Notes |
|------|--------|-------|
| A — sanity-grep | ✅ DONE | Findings 1/2/3 all confirmed closed |
| B — codex 4th audit | ✅ DONE | F4 (new HIGH) surfaced, F5/F6/F7 deferred (Python PoC, out-of-scope §8.3) |
| **F4 fix — all sub-findings** | ✅ **FULLY CLOSED** | Three sub-findings closed across three sessions. See F4 technical summary below. |
| F5 — Python project_slug leak | ⏸ DEFERRED | Python PoC only, not browser path. See §F5/F6/F7 below. |
| F6 — Python unbounded int | ⏸ DEFERRED | Python PoC only. |
| F7 — Python AttributeError | ⏸ DEFERRED | Python PoC only. |
| C.1 — spec-verify prep files | ✅ DONE | `pricing.generated.ts` idempotent, `hashing.ts` byte-parity with Python confirmed |
| C.2 — `handles.ts` | ✅ DONE | IndexedDB FSA handle persistence |
| C.3 — `import.ts` | ✅ DONE | Orchestrator: stream → parse → collect → validate |
| C.4 — FSA UI (`JoinBurnIndexForm.tsx`) | ✅ DONE | `?auto-detect=1` feature flag + `"showDirectoryPicker" in window` guard |
| C.5 — vitest suites | ✅ DONE | 29/29 tests pass (after F4-DUP fixtures added): `burn-parity.test.ts` (21), `burn-security.test.ts` (8) |
| C.6 — E2E manual verify | ✅ DONE | FSA UI renders (two picker buttons, period selector, scan/preview, no upload-before-scan). Fallback (no flag) shows standard form. |
| C.7 — branch + push + PR | ✅ DONE | PR #1 open: https://github.com/chongwon83/coconutlabs/pull/1. F4-DUP commit `e604ad0` pushed. |

### F4 technical summary (path-aware tokenizer — all sub-findings CLOSED)

**F4-CROSS (closed, commit `12221b5`)**: Flat `out: Set<string>` shared across all path scanners allowed commit-loop deletions in one path to clear poison set by another. Fix: `poisonedTokenKeys` now returns `PoisonedKeys = { usage: Set; cc: Set; ttu: Set }` — three independent path-scoped sets. `scanLeaf(keys, target)` signature accepts the relevant set per call site.

**F4-DEPTH (closed, commit `12221b5`)**: `skipVal` returning `false` on depth > 64 without setting `bailed` allowed deeply-nested decoy subtrees to produce an empty poison set, bypassing float detection. Fix: `skipObj`/`skipArr` set `bailed = true` before returning false. `result()` checks `bailed` and returns full key sets for all 3 paths.

**F4-DUP (closed, commit `e604ad0`)**: Scan entry guards (`if (i >= n || line[i] !== "{") return;`) returned immediately without consuming the non-object value. This left `i` at the start of `null` (or other non-object); the parent scanner loop then failed to find `,`/`}` and exited, making any subsequent duplicate key (last-key-wins) unreachable. Fix: all 5 guards changed to `{ skipVal(0); return; }`.

Three disjoint path-specific poison sets prevent cross-clobber between `scanUsage()` and `scanLeaf()`:

```
POISON_USAGE_KEYS  — keys inspected at message.usage.*
POISON_CC_KEYS     — keys inspected at message.usage.cache_creation.*
POISON_TTU_KEYS    — keys inspected at payload.info.total_token_usage.*
```

Total vitest coverage: 21 parity fixtures + 8 security fixtures = 29 tests (all pass). `npx tsc --noEmit` exits 0.

### F5/F6/F7 deferral record

These are Python PoC defects. Browser shipping path (TS) unaffected. Address in a separate "PoC hardening" sprint after Phase 2 lands.

- **F5** (`parsers.py:92`): raw `project_slug` on `SessionParse` — hash before returning
- **F6** (`parsers.py:63`): Python `_as_int` has no upper bound (unlike TS `MAX_SAFE_INTEGER`)
- **F7** (`parsers.py:160`): `AttributeError` on malformed nested `payload.info` — add `isinstance` check

### Remaining for next session

- **7th codex re-audit** (rate-limit permitting): confirm F4-DUP CLOSED, 0 new HIGH on `parsers.ts` — run `codex exec --sandbox read-only` re-audit. Expected: F4-CROSS/F4-DEPTH/F4-DUP all CLOSED, F5/F6/F7 still deferred (Python PoC, expected).
- **Vercel preview verify**: check PR #1 Vercel preview (`chongwon5026@gmail.com`) builds clean with `?auto-detect=1` in Chrome.
- **Production rollout**: default OFF (Phase 1 quickstart visible to all until 5-axis Gate passes — separate PR).
- **F5/F6/F7**: address in a separate "PoC hardening" sprint after Phase 2 lands.

---

## 0. Standing constraints (carry-over, MUST remain in effect)

### 0.1 Security invariants (verbatim, non-negotiable)

The CoconutLabs collector MUST NEVER upload, log, persist, or transmit ANY of the following:
- raw prompt, raw response, source code, original file paths, original repo names
- API keys, `.env` contents, environment variables, original shell commands
- customer / company / secret project names

ONLY these 9 fields are uploadable per row:
```
tool, model, tokenCount, estimatedCostUsd, timestampBucket,
sessionCount, activeDays, projectHash, verification
```

Additional invariants:
- `~/.coconutlabs/salt` (chmod 0600) NEVER leaves the device. Browser uses a separate IndexedDB-bound salt by default. The Python salt may be pasted into the browser as an advanced opt-in.
- `validateSummary` keeps `additionalProperties: false` on root AND on every row.
- Server `redisStore` does typed-only `JSON.stringify` — never spread arbitrary objects, never raw envelope/content/paths/secrets.
- `ImportedEntry` holds ONLY the 9 derived row fields + challenge records.
- `import-history.json` shape: `{handle, weekKey, totalTokens, importedAt}` only.
- DESIGN.md 6 invariants (color / typography / spacing / motion / aesthetic / layout) preserved.
- No raw `content` / `message.content` / payload-text field is read OR serialized by any parser. JSON.parse output is filtered to whitelisted keys; everything else discarded synchronously before any await.
- `project_slug` is HASH INPUT ONLY, never emitted.

### 0.2 Accounts (verbatim)

- **Vercel**: chongwon5026@gmail.com (display name `chongwon83`).
- **GitHub**: chongwon83.
- Do NOT use any other account for push / deploy / preview operations.

### 0.3 Browser-automation safety (verbatim intent)

- NEVER create accounts.
- NEVER enter passwords.
- SSO / OAuth login to existing accounts ONLY with explicit per-instance permission in chat.
- NEVER enter sensitive financial / ID data.
- Downloads / T&C acceptance / irreversible actions require explicit per-instance confirmation.
- Upstash REST token is secret — never log plaintext.
- The blanket "모든 권한 승인해줄게" given earlier does NOT override system-level safety rules. Re-confirm per action when in doubt.

### 0.4 Codex collaboration directive (verbatim)

Every phase ends with `codex exec --sandbox read-only --skip-git-repo-check` round before declaring done. Codex CLI v0.128.0 (model gpt-5.5) on PATH.

### 0.5 Next.js 16.2.6 constraint (from web/AGENTS.md, verbatim)

> "This is NOT the Next.js you know. This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices."

Before writing any Next.js code (route handlers, server actions, `useSearchParams`, etc.), `Read` the relevant doc in `node_modules/next/dist/docs/`. Default training-data assumptions WILL be wrong.

### 0.6 Working mode

"The user has asked you to work without stopping for clarifying questions. When you'd normally pause to check, make the reasonable call and continue; they'll redirect if needed."

---

## 1. `spec_path`

**Plan**: `/Users/dg-2412-pn-002/.claude/plans/modular-bubbling-ember.md`

The approved plan. Phase 1 (inline quickstart in `web/components/forms/JoinBurnIndexForm.tsx`) **shipped**. Phase 2 (File System Access API behind `?auto-detect=1` feature flag) is the current target — code complete + tested today, production rollout gated on the 5-axis Gate (see plan §"Production rollout Gate").

### Codex finding closure status (entering this session)

| # | Finding | Status | Evidence |
|---|---------|--------|----------|
| 1 | Per-field zeroing (parsers.ts) instead of line-skip | **CLOSED** | Grep markers at parsers.ts lines 139, 189, 206, 409, 474, 480, 508, 517, 518, 522, 524 verified prior turn. `npx tsc --noEmit` EXIT=0. |
| 2 | bankersRound parity with CPython | **CLOSED** | `Number(value.toFixed(decimals))` in `web/lib/client/burn/collect.ts` with `Number.isFinite` guard. 3015-case parity sweep passed. |
| 3 | Model-prefix allowlist parity Python↔TS | **CLOSED** | Both files gate on `{claude-opus, claude-sonnet, claude-haiku, gpt, o3, o4}`. `gemini-3-pro` etc. collapse to `"unknown"` by design. |

Next session order (verbatim from user): **Finding 3 → Finding 1 → codex 재감사 → Phase 2 이어갈게**.
Since Findings 1+2+3 are already CLOSED, that order maps to:
- **Step A** = sanity-grep verifying all three are still closed (covers "Finding 3 → Finding 1" re-verification).
- **Step B** = codex 4th audit (codex 재감사).
- **Step C** = Phase 2 implementation in 7 sub-steps.

---

## 2. `prev_artifacts`

### 2.1 Modified files (uncommitted, on disk now)

| Path | Status | Notes |
|------|--------|-------|
| `web/tools/usage-poc/coconut_collector/parsers.py` | Modified | Finding 3: `_MODEL_RE` + `_KNOWN_MODEL_PREFIXES` frozenset (lines 33-40) + `_safe_model` two-stage gate (lines 43-60). `_as_int` per-field zeroing (lines 63-71). `parse_claude` per-message accumulation, `parse_codex` last `token_count` event semantics. |
| `web/tools/usage-poc/coconut_collector/collect.py` | Modified | Schema-version `"2"` envelope assembly. `_calendar_window` last-completed-ISO-week semantics. `_schema_token_count` maps PoC shape → schema `tokenCount`. `_verification`: confidence high→"Device-synced", low→"Estimated". |
| `web/tools/usage-poc/burn-summary.schema.json` | Modified | `schemaVersion const: "2"`, `additionalProperties: false`, 9 required row fields. |
| `web/components/forms/JoinBurnIndexForm.tsx` | Modified | Phase 1 inline quickstart shipped (247 lines). Phase 2 FSA UI section NOT yet added. |
| `web/lib/data.ts` | Modified | `COLLECTOR_REPO_URL` constant added in Phase 1. |
| `web/app/globals.css` | Modified | Phase 1 quickstart code-block styling. |

### 2.2 Untracked files (exist but not yet `git add`-ed)

| Path | Size | Notes |
|------|------|-------|
| `web/lib/client/burn/parsers.ts` | 28376 b | Finding 1 migration COMPLETE. `TOKEN_FLOAT_LEXEME_RE` with `/g` + capture group. `poisonedTokenKeys(line): ReadonlySet<string>` (line 189). `EMPTY_POISONED` (line 206). `matchModel` longest-prefix-at-hyphen-boundary with `-x` wildcard sugar (lines 212-229). `readInt(obj, key, poisoned?)` 3-arg signature (lines 374-382). parseClaudeFile threads `poisoned` through 5 readInt calls. parseCodexFile uses `finalPoisoned` snapshot pattern (lines 474, 480, 508, 517, 518, 522, 524). |
| `web/lib/client/burn/collect.ts` | 17674 b | Finding 2 RESOLVED. `bankersRound` uses `Number(value.toFixed(decimals))` with `Number.isFinite` guard. |
| `web/lib/client/burn/hashing.ts` | 5368 b | WebCrypto SHA-256. **Needs Step C.1 spec verification** to confirm it produces byte-equivalent output to Python `hashlib.sha256(f"{salt}:{slug}".encode("utf-8")).hexdigest()[:12]`. |
| `web/lib/client/burn/pricing.generated.ts` | 4322 b | Codegen output. **Needs Step C.1 spec verification** to confirm it was generated from `web/tools/usage-poc/model-pricing.json` and matches its contents. |
| `web/scripts/codegen-pricing.mjs` | 3721 b | Phase 2 codegen script. **Needs Step C.1 spec verification**. |
| `web/tasks/coconut-burn-import/` (this directory) | — | This handoff packet lives here. |

### 2.3 Missing files (Phase 2 must create)

| Path | Purpose |
|------|---------|
| `web/lib/client/burn/handles.ts` | IndexedDB store `coconutlabs.handles` for FSA directory handle persistence. `requestPermission({ mode: "read" })` on resume. |
| `web/lib/client/burn/import.ts` | Orchestrator: list files → `streamLines` → `parseClaudeFile`/`parseCodexFile` → `collect()` → `validateSummary` → preview. |
| `web/__tests__/burn-parity.test.ts` | TS↔Python envelope semantic equality (ignore `generatedAt`, row order, line endings). |
| `web/__tests__/burn-security.test.ts` | Monkey-patch `window.fetch`, assert forbidden keys + sentinel not present in payloads. |
| `web/__tests__/burn-schema.test.ts` | Every payload passes `validateSummary` with `additionalProperties: false`. |

### 2.4 Recent commits (do NOT revert)

```
2b86fbc fix(challenge): harden dedup-then-filter per codex cross-review
85ebab5 fix(challenge): dedup-then-filter so reject cancels prior verified (backlog #2)
59d6184 feat(scripts): owner CLI for production unverified-queue (backlog #1)
6f9f436 chore(deploy): trigger Vercel rebuild with corrected git author
f3c3d99 docs(decision): S10 주간 회고 — E+C+D 묶음 배포 엔트리 추가
```

---

## 3. `instruction`

Execute in order. Do NOT skip ahead. Make reasonable calls without pausing for confirmation.

### Step A — Sanity-grep (verifies Findings 1+2+3 still closed)

```bash
cd "/Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web"

# A.1 Finding 1 markers (per-field zeroing)
grep -nE "hasFloatTokenLexeme|poisonedTokenKeys|EMPTY_POISONED|poisonForFinal|finalPoisoned" lib/client/burn/parsers.ts

# A.2 Finding 2 marker (bankersRound)
grep -n "toFixed" lib/client/burn/collect.ts

# A.3 Finding 3 markers (model-prefix allowlist)
grep -n "_KNOWN_MODEL_PREFIXES\|_safe_model" tools/usage-poc/coconut_collector/parsers.py
grep -nE "KNOWN_MODEL_PREFIXES|matchModel" lib/client/burn/parsers.ts

# A.4 TypeScript compile check
npx tsc --noEmit
```

**Expected outcomes** (see §8 "touched_files → expected grep state" for line numbers):
- A.1 shows ZERO `hasFloatTokenLexeme` hits; `poisonedTokenKeys` defined at line 189; `EMPTY_POISONED` at line 206; `finalPoisoned`/`poisonForFinal` referenced at lines 474, 508, 517.
- A.2 shows `toFixed` referenced inside `bankersRound`.
- A.3 shows `_KNOWN_MODEL_PREFIXES` frozenset (~line 33-40) + `_safe_model` definition (~line 43) in Python; `KNOWN_MODEL_PREFIXES`/`matchModel` defined in TS.
- A.4 EXIT=0.

If ANY check diverges from expected, **STOP**. Read the divergence carefully — someone (or context drift) may have partially reverted. Do NOT blindly re-apply patches; investigate first.

### Step B — codex 4th audit

```bash
cd "/Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web" && codex exec --sandbox read-only --skip-git-repo-check <<'EOF'
Re-audit the CoconutLabs Burn Summary collector for HIGH-severity correctness, security, and Python↔TS parity issues.

Scope:
- web/lib/client/burn/parsers.ts
- web/lib/client/burn/collect.ts
- web/lib/client/burn/hashing.ts
- web/lib/client/burn/pricing.generated.ts
- web/lib/client/burn/burn-summary.schema.json (if present)
- web/tools/usage-poc/coconut_collector/parsers.py
- web/tools/usage-poc/coconut_collector/collect.py
- web/tools/usage-poc/coconut_collector/hashing.py
- web/tools/usage-poc/burn-summary.schema.json

Three findings from prior audits should now read CLOSED:
  Finding 1: per-field zeroing (NOT line-skip) of poisoned float-shaped token fields, both implementations.
  Finding 2: bankersRound parity with CPython _Py_dg_dtoa via Number(value.toFixed(decimals)).
  Finding 3: model-prefix allowlist parity Python↔TS on {claude-opus, claude-sonnet, claude-haiku, gpt, o3, o4}.

Confirm closure for each.

Then report ONLY NEW HIGH findings (correctness divergence between Python and TS, security violations against the 9-field whitelist, salt-leakage paths, additionalProperties:false bypasses, raw content-field reads, project_slug emission). Ignore MEDIUM/LOW unless they cross-reference one of the listed invariants.

Output format: a short table of (severity, file:line, summary, recommended fix).
EOF
```

**Target**: 0 HIGH findings. Findings 1/2/3 all read CLOSED. If Codex flags new HIGH issues, address them BEFORE proceeding to Step C.

### Step C — Phase 2 implementation (7 sub-steps)

Only after Steps A+B pass. Each sub-step ends with a verify command. Commit per logical chunk (do NOT batch the whole phase into one commit).

**C.1 — Spec-verify the 3 prep files already on disk** (hashing.ts, pricing.generated.ts, codegen-pricing.mjs)

```bash
cd "/Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web"

# Verify codegen-pricing.mjs reads model-pricing.json and emits pricing.generated.ts
node scripts/codegen-pricing.mjs   # should be idempotent — re-generates pricing.generated.ts byte-identical
git diff --exit-code lib/client/burn/pricing.generated.ts   # MUST exit 0 (no drift)

# Verify hashing.ts byte-parity with Python hashing.py (SHA-256, slice(0,12), TextEncoder utf-8)
# Add a one-shot Node parity check: read salt+slug pairs, hash via TS function, compare to Python hashlib output
# Run python -c "import hashlib; print(hashlib.sha256(b'<salt>:<slug>').hexdigest()[:12])" and Node equivalent
```

If `pricing.generated.ts` regenerates with diff → fix `codegen-pricing.mjs` to be deterministic, then commit BOTH together. If `hashing.ts` produces different output → fix to match Python byte-for-byte (`TextEncoder().encode(\`${salt}:${slug}\`)`, lowercase hex, `.slice(0, 12)`).

**C.2 — Create `web/lib/client/burn/handles.ts`** (IndexedDB handle persistence)

Read first: `node_modules/next/dist/docs/` for any client-component / `"use client"` guidance you need.

Module exports:
- `saveHandle(kind: "claude" | "codex", handle: FileSystemDirectoryHandle): Promise<void>`
- `loadHandle(kind: "claude" | "codex"): Promise<FileSystemDirectoryHandle | null>`
- `ensurePermission(handle: FileSystemDirectoryHandle): Promise<"granted" | "denied">` — calls `handle.queryPermission({ mode: "read" })` then `requestPermission({ mode: "read" })` if needed.

IndexedDB: database `coconutlabs.handles`, store `handles`, keys `"claude"` / `"codex"`. Origin-bound (browser native).

**C.3 — Create `web/lib/client/burn/import.ts`** (orchestrator)

Signature:
```ts
export async function runImport(args: {
  claudeHandle: FileSystemDirectoryHandle | null;
  codexHandle:  FileSystemDirectoryHandle | null;
  salt: string;
  period: "day" | "week" | "month" | "year" | "all";
}): Promise<BurnSummaryEnvelope>;
```

Flow:
1. For each handle, recursively iterate matching files (`*.jsonl` under `.claude/projects/*/` or `.codex/sessions/*/*/*/rollout-*.jsonl`).
2. For each file: `parseClaudeFile` or `parseCodexFile` from `parsers.ts`, streaming via `File.stream()` + `TextDecoder("utf-8", { fatal: true, ignoreBOM: true })` + manual newline scan.
3. Filter sessions by period using `_calendar_window` semantics (port from `collect.py`, UTC-only `Date.UTC` + `getUTCDay`).
4. Group by `(tool, model, projectHash)` where `projectHash = sha256(\`${salt}:${slug}\`).slice(0, 12)`.
5. Call `collect()` / envelope assembly (port `build_envelope` from `collect.py`).
6. **Pre-upload guard**: `validateSummary(envelope)` — `additionalProperties: false` enforced. Throw on failure.
7. Return envelope. **DO NOT POST** here — UI shows preview and lets user click "Upload to leaderboard" separately.

**C.4 — Extend `web/components/forms/JoinBurnIndexForm.tsx`** with FSA UI

Feature-flag gate:
```ts
const params = useSearchParams();
const autoDetect =
  params.get("auto-detect") === "1" &&
  typeof window !== "undefined" &&
  "showDirectoryPicker" in window;
```

If `autoDetect === false` → render existing Phase 1 quickstart (unchanged).

If `autoDetect === true` → render new section:
- Two narrow picker buttons: "Select `.claude/projects` folder" and "Select `.codex/sessions` folder".
- After each picker, **reject** if `handle.name` does not end in `projects` or `sessions` respectively. Show explanatory error: `"Selected folder must be the .claude/projects (or .codex/sessions) directory itself, not your home directory."`
- Preview UI: session count, total tokens (envelope `grandTotal.totalTokens`), estimated cost ($), per-row breakdown table.
- Separate "Upload to leaderboard" button — no auto-POST. Confirmation required.
- Advanced collapsible: "Import Python salt from `~/.coconutlabs/salt`" — paste-in box, validate base64/hex shape + length, store in IndexedDB. If empty → browser uses its own IndexedDB-bound salt (separate identity from Python collector).
- UI copy must explicitly state: "Using a separate browser salt means projects imported here will appear under different projectHash values than your Python collector unless you import the Python salt above."

**C.5 — Install vitest + playwright, write 3 test suites**

```bash
cd "/Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web"
npm install --save-dev vitest @vitest/ui playwright @playwright/test
npx playwright install chromium
```

Tests:
- `web/__tests__/burn-parity.test.ts` — share fixture log dir between Python collector and TS import. Run both, normalize (drop `generatedAt`, sort rows, normalize line endings), assert `JSON.stringify(tsOut) === JSON.stringify(pyOut)`.
- `web/__tests__/burn-security.test.ts` — fixture files contain sentinel `SECRET_SENTINEL_XYZ_2026` inside a `content` field. Run full import flow with `window.fetch` monkey-patched to capture payloads. Assert:
  - No payload contains regex `prompt|response|content|source|path|repo|secret|apiKey|env|password|token` (as a JSON key).
  - No payload string contains `SECRET_SENTINEL_XYZ_2026`.
  - No payload contains the salt value itself.
- `web/__tests__/burn-schema.test.ts` — every captured payload passes `validateSummary` (`additionalProperties: false` enforced on root + every row).

CI integration: add `npm test` to package.json scripts, ensure `next build` still passes.

**C.6 — E2E manual verify**

```bash
cd "/Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web"
npm run dev
# Then open http://localhost:3001/?auto-detect=1 in Chrome 138+
```

Test plan:
1. Chrome 138+: feature flag ON. Pick both folders. Confirm preview renders. Confirm "Upload to leaderboard" button is separate.
2. Safari/Firefox: feature flag ON via URL. Phase 1 quickstart should still render (no `showDirectoryPicker` available).
3. No URL flag: Phase 1 quickstart renders regardless of browser.
4. Home-directory selection attempt: error message renders, no upload occurs.
5. Compare TS envelope output to local `python -m coconut_collector --json` output (allowing for salt-identity divergence on `projectHash`).

**C.7 — Commit + push + Vercel verify**

Commits MUST be on branch `feat/burn-import-fsa` (create new) and signed by chongwon83 git author. Push to chongwon83/coconutlabs.

```bash
cd "/Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web"
git checkout -b feat/burn-import-fsa
git add lib/client/burn/ scripts/codegen-pricing.mjs tools/usage-poc/ components/forms/JoinBurnIndexForm.tsx lib/data.ts app/globals.css __tests__/ tasks/coconut-burn-import/
git status   # confirm only intended files staged
# Commit in logical chunks: prep files first, then UI, then tests
```

Push to GitHub (chongwon83), open PR, verify Vercel preview deploy (chongwon5026@gmail.com account) builds clean. Test the preview URL with `?auto-detect=1` query param in Chrome 138+.

**Production rollout stays default OFF** (Phase 1 quickstart visible to all users). Production flag flip is a SEPARATE PR after the 5-axis Gate from `modular-bubbling-ember.md` passes.

---

## 4. `verification`

Create `tasks/coconut-burn-import/criteria.md` (Evaluator output) before declaring Step C done. The 12 criteria below are pass/fail.

1. `npx tsc --noEmit` exits 0 in `web/`.
2. Codex 4th audit (Step B) reports 0 HIGH findings; Findings 1/2/3 all read CLOSED.
3. `pricing.generated.ts` regenerates byte-identical from `model-pricing.json` (Step C.1 `git diff --exit-code` passes).
4. `hashing.ts` produces byte-identical SHA-256 hex slice as Python `hashlib.sha256(f"{salt}:{slug}".encode("utf-8")).hexdigest()[:12]` for at least 50 random salt/slug pairs.
5. Per-field zeroing semantics: on the fixture line below, TS output = Python output exactly.
   ```json
   {"type":"assistant","message":{"model":"claude-opus-4-7","usage":{"input_tokens":1.5,"output_tokens":2000,"cache_read_input_tokens":500}}}
   ```
   Expected: `{input: 0, output: 2000, cache_read: 500, ...}`, model `"claude-opus-4-7"` preserved, timestamp preserved. NOT a full line skip.
6. 9-field allowlist enforced — `validateSummary` rejects any extra row key.
7. Sentinel `SECRET_SENTINEL_XYZ_2026` planted in fixture content field NEVER appears in any captured upload payload (parity test fixture for security suite).
8. Forbidden-key regex (`prompt|response|content|source|path|repo|secret|apiKey|env|password|token`) hits 0 in all captured payloads.
9. Salt value (the IndexedDB-stored salt or any pasted Python salt) NEVER appears in any captured upload payload.
10. FSA picker rejects any folder whose `.name` does not end in `projects` or `sessions`. Tested with `~`, `~/Desktop`, and a random folder.
11. Safari/Firefox / no-`showDirectoryPicker` browsers fall back to Phase 1 quickstart even with `?auto-detect=1` set.
12. Browser fetch interception test: 0 forbidden keys + 0 sentinel hits + 0 salt-leaks across the entire Phase 2 import flow including the upload POST.

---

## 5. `diff_summary` (cumulative since plan approval)

```
web/tools/usage-poc/coconut_collector/parsers.py    Finding 3: _KNOWN_MODEL_PREFIXES + _safe_model two-stage gate + _as_int per-field zeroing
web/tools/usage-poc/coconut_collector/collect.py    Schema-v2 envelope, last-completed-ISO-week, _schema_token_count, _verification
web/tools/usage-poc/burn-summary.schema.json        schemaVersion const:"2", additionalProperties:false, 9 required row fields
web/lib/client/burn/parsers.ts                      Finding 1 COMPLETE: TOKEN_FLOAT_LEXEME_RE /g+capture, poisonedTokenKeys, EMPTY_POISONED, readInt 3-arg, parseClaudeFile + parseCodexFile finalPoisoned snapshot pattern threading. tsc EXIT=0.
web/lib/client/burn/collect.ts                      Finding 2 COMPLETE: bankersRound = Number(value.toFixed(decimals)) with Number.isFinite guard. 3015-case parity sweep passed.
web/lib/client/burn/hashing.ts                      NEW (Phase 2 prep). WebCrypto SHA-256. Needs C.1 verification.
web/lib/client/burn/pricing.generated.ts            NEW (codegen output). Needs C.1 verification.
web/scripts/codegen-pricing.mjs                     NEW (Phase 2 codegen script). Needs C.1 verification.
web/components/forms/JoinBurnIndexForm.tsx          Phase 1 quickstart shipped. Phase 2 FSA UI section pending (C.4).
web/lib/data.ts                                     COLLECTOR_REPO_URL constant added (Phase 1).
web/app/globals.css                                 Phase 1 quickstart code-block styling.
```

Phase 2 (Step C) will add:
```
web/lib/client/burn/handles.ts                      NEW (IndexedDB handle persistence)
web/lib/client/burn/import.ts                       NEW (orchestrator)
web/components/forms/JoinBurnIndexForm.tsx          ~+250 lines (FSA UI section behind ?auto-detect=1)
web/__tests__/burn-parity.test.ts                   NEW (vitest)
web/__tests__/burn-security.test.ts                 NEW (vitest, monkey-patch fetch)
web/__tests__/burn-schema.test.ts                   NEW (vitest, validateSummary)
web/package.json                                    +vitest +playwright +npm test script
```

---

## 6. `decision_delta` (hardened decisions, do NOT relitigate)

1. **Finding 2 algorithm (2026-05-20)**: `Number(value.toFixed(decimals))` with `Number.isFinite` guard. Reason: CPython `round()` uses `_Py_dg_dtoa` on raw IEEE-754 bits; `toPrecision` perturbs bits before formatting and breaks parity on edge values; V8 `toFixed` operates on raw double and matches byte-for-byte across 3015 tested edge cases.
2. **Finding 3 parity-set scope (2026-05-20)**: 6 prefixes only: `claude-opus, claude-sonnet, claude-haiku, gpt, o3, o4`. `gemini-3-pro`, `mistral-*`, etc. collapse to `"unknown"` in both implementations. Pricing table doesn't carry those families, so "unknown" correctly downgrades to `_default + low confidence` (Device-synced → Estimated). Future provider additions: update BOTH files in lockstep + add parity test before merging.
3. **Finding 1 policy (2026-05-20)**: per-field zeroing, NOT line-skip. Reason: line-skip over-rejected — a single stray float would lose the entire line's `model`/`timestamp`/other valid token fields. Per-field matches Python `_as_int` (returns 0 for non-int input, leaves siblings untouched, rejects bool despite subclassing int).
4. **Salt strategy default (2026-05-20)**: browser uses IndexedDB-bound salt as a separate identity from the Python collector. Advanced opt-in to paste Python salt is the only path to unified `projectHash` values across both collectors. UI must make this explicit. byte-level parity for `generatedAt` is impossible (timestamp varies), so we test semantic equality only.
5. **FSA picker scope (2026-05-20)**: TWO narrow pickers (`.claude/projects`, `.codex/sessions`). Home-directory selection blocked at code level by checking `handle.name` suffix. No single "scan home dir" picker, ever.
6. **Pricing source (2026-05-20)**: build-time codegen from `web/tools/usage-poc/model-pricing.json` into `pricing.generated.ts`. Single source of truth: the JSON file. Live network fetch for pricing is FORBIDDEN (drift + privacy attack surface).

---

## 7. `unresolved_risks`

1. **3 Phase 2 prep files on disk are UNVERIFIED against spec.** `hashing.ts`, `pricing.generated.ts`, `codegen-pricing.mjs` exist but were created in a prior turn without explicit owner sign-off. Step C.1 must verify byte-parity / determinism before relying on them.
2. **Codex 4th audit not yet run.** Findings 1/2/3 closure is verified only by grep + tsc. Independent audit (Step B) may surface NEW HIGH findings.
3. **No automated security test exists yet.** Server-side `validateSummary` is currently the ONLY enforced trust boundary. Treat that as the actual security gate; the browser test suite (Step C.5) is defense-in-depth, not primary control.
4. **Phase 2 UI not started.** No FSA pickers, no IndexedDB persistence, no preview, no upload gating.
5. **Browser-only salt identity divergence** means a user who imports via Python AND via browser will see the same projects under two different `projectHash` values on the leaderboard. Documented as expected (decision_delta #4); UI copy must make this explicit.
6. **DNS / Vercel SSL** propagation for coconutlabs.xyz — unrelated longstanding work (#37). Does not block Phase 2 commit/preview cycle.

---

## 8. `touched_files`

### 8.1 Step A scope (read-only)

- `web/lib/client/burn/parsers.ts`
- `web/lib/client/burn/collect.ts`
- `web/tools/usage-poc/coconut_collector/parsers.py`

### 8.2 Step C scope (in-scope — Phase 2 may edit)

- `web/components/forms/JoinBurnIndexForm.tsx`
- `web/lib/client/burn/handles.ts` (create)
- `web/lib/client/burn/import.ts` (create)
- `web/lib/client/burn/pricing.generated.ts` (verify regen)
- `web/scripts/codegen-pricing.mjs` (verify determinism)
- `web/lib/client/burn/hashing.ts` (verify byte-parity)
- `web/__tests__/burn-parity.test.ts` (create)
- `web/__tests__/burn-security.test.ts` (create)
- `web/__tests__/burn-schema.test.ts` (create)
- `web/package.json` (add vitest + playwright + npm test script)
- `tasks/coconut-burn-import/criteria.md` (create — Evaluator output for Review Harness)

### 8.3 Out-of-scope (do NOT edit in this session)

- Any file under `web/app/api/` (server boundary — server `validateSummary` + redisStore typed-only invariants).
- Anything under `web/lib/server/` unless adding a sibling validator that already exists.
- `web/tools/usage-poc/coconut_collector/*.py` (Findings 3 + parser semantics are CLOSED; reopening risks parity regression).
- DESIGN.md and design tokens (Phase 2 UI uses existing tokens; no new design system work).

### 8.4 Expected grep state BEFORE Step A (2026-05-20 verified)

```bash
grep -nE "hasFloatTokenLexeme|poisonedTokenKeys|EMPTY_POISONED|poisonForFinal|finalPoisoned" lib/client/burn/parsers.ts
```
- ZERO hits for `hasFloatTokenLexeme`.
- `poisonedTokenKeys` defined ~line 189.
- `EMPTY_POISONED` defined ~line 206.
- `finalPoisoned` / `poisonForFinal` referenced at lines 474, 480, 508, 517, 518, 522, 524.
- Comment at line 139 references `poisonedTokenKeys` (no stale `hasFloatTokenLexeme` mention).

```bash
grep -n "toFixed" lib/client/burn/collect.ts
```
- ≥1 hit inside `bankersRound`.

```bash
grep -n "_KNOWN_MODEL_PREFIXES\|_safe_model" tools/usage-poc/coconut_collector/parsers.py
```
- `_KNOWN_MODEL_PREFIXES = frozenset({...})` at ~line 33-40.
- `def _safe_model(raw):` at ~line 43.

If ANY of the above diverges, treat as a Step A blocker and investigate before editing.

---

## 9. `validation_log`

- **2026-05-20 (Finding 2 closure)**: 3015-case `toFixed` parity sweep passed against CPython `round()`. Zero mismatches. Logged in `collect.ts` block comment.
- **2026-05-20 (Finding 3 closure)**: Python `_safe_model` two-stage gate added; `gemini-3-pro` test → returns `None` (collapsed to "unknown" downstream); matches TS `KNOWN_MODEL_PREFIXES.has(...)` behavior. Parity table in `parsers.py` lines 26-40 documents the cross-implementation contract.
- **2026-05-20 (Finding 1 closure)**: parsers.ts call-site migration complete. parseClaudeFile threads `poisoned` through 5 `readInt` calls; parseCodexFile uses `finalPoisoned` snapshot pattern atomic with `final = ttu`. `npx tsc --noEmit` EXIT=0 verified.
- **2026-05-20 (handoff write)**: This file rewritten to reflect post-Finding-1 reality (prior version was stale).
- **Pending — 2026-05-20+**: Step A sanity-grep, Step B codex 4th audit, Step C Phase 2 implementation.

---

## 10. `next_invariant` (Phase 2 MUST NOT violate any)

Treat any violation as a commit blocker.

1. `web/tools/usage-poc/burn-summary.schema.json` keeps `additionalProperties: false` on root AND on every row. 9 required row fields unchanged. Schema-version stays `"2"`.
2. `~/.coconutlabs/salt` (and its browser IndexedDB equivalent) NEVER appears in any network payload. Step C.5 security test enforces with grep on captured payloads.
3. Per-field zeroing semantics: a single poisoned key on a line zeroes ONLY that field. `model`, `timestamp`, and other valid token fields on the same line must survive. Equivalent to Python `_as_int` per-field reject.
4. `model` field that fails either `_MODEL_RE.fullmatch` OR the family-prefix gate collapses to `"unknown"` in BOTH implementations. Downstream pricing falls back to `_default + "low"` confidence.
5. Server `redisStore` typed-only `JSON.stringify` — no spread of arbitrary objects; all keys whitelisted explicitly.
6. `import-history.json` server record shape unchanged: `{handle, weekKey, totalTokens, importedAt}` only.
7. DESIGN.md 6 invariants (color/typography/spacing/motion/aesthetic/layout) preserved. Phase 2 UI route through `npx @google/design.md lint DESIGN.md` (error 0) before S8 if any new tokens emerge.
8. Phase 2 FSA pickers reject any folder whose `.name` does not end in `projects` or `sessions`. Home-directory selection blocked at code level. No combined "scan home dir" picker exists.
9. Salt import path (advanced) validates hex/base64 shape + length before storing in IndexedDB. Reject anything that looks like an API key prefix (`sk-`, `xoxb-`, `ghp_`, `eyJ`, etc.) defensively.
10. NO raw `content`/`message.content`/payload-text field is read OR serialized by any parser. JSON.parse output filtered to whitelisted keys synchronously before any await.
11. NO live pricing fetch. Pricing source = build-time codegen from `model-pricing.json` only.
12. Production default stays Phase 1 quickstart visible to all. `?auto-detect=1` is INTERNAL/DOGFOOD only until the 5-axis Gate passes (see plan §"Production rollout Gate"). Flag flip is a SEPARATE PR.
13. NO account creation, NO password entry, NO financial data entry during browser-automation actions. SSO/OAuth requires explicit per-instance permission. Vercel/GitHub stays on chongwon5026@gmail.com / chongwon83.

---

## Recovery checklist (use if anything looks off in next session)

```bash
cd "/Users/dg-2412-pn-002/Desktop/Project/Coconut Labs/web"

# 1. Finding 1 markers
grep -nE "hasFloatTokenLexeme|poisonedTokenKeys|EMPTY_POISONED|poisonForFinal|finalPoisoned" lib/client/burn/parsers.ts
# Expected: 0 hasFloatTokenLexeme, poisonedTokenKeys@189, EMPTY_POISONED@206, finalPoisoned@474/508/517

# 2. Finding 2 marker
grep -n "toFixed" lib/client/burn/collect.ts
# Expected: ≥1 hit inside bankersRound

# 3. Finding 3 markers
grep -n "_KNOWN_MODEL_PREFIXES\|_safe_model" tools/usage-poc/coconut_collector/parsers.py
# Expected: frozenset definition ~line 33-40, def ~line 43

# 4. TS compile
npx tsc --noEmit
# Expected: EXIT=0

# 5. git state
git status --short
# Expected: 6 modified + lib/client/ + scripts/codegen-pricing.mjs + tasks/ untracked

# 6. Phase 2 prep files exist
ls -la lib/client/burn/ scripts/
# Expected: hashing.ts (~5.4k), pricing.generated.ts (~4.3k), codegen-pricing.mjs (~3.7k) — handles.ts and import.ts MISSING

# 7. Tooling
node --version    # v20+ expected
npx tsc --version # 5.x expected
codex --version   # 0.128.0 expected
```

If outputs DIVERGE from expected, **investigate before editing**. Do not blindly apply patches — the divergence may indicate someone (or context drift) has partially reverted or moved code.

---

**End of handoff packet.** Resume order: Step A → Step B → Step C (7 sub-steps). Codex collaboration on every phase. Make reasonable calls without pausing for confirmation; the user will redirect if needed.
