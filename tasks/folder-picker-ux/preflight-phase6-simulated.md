# Pre-flight Phase 6 Dynamic Simulation — Folder Picker UX

**Date**: 2026-05-21
**Source**: `[auto]` — Claude-in-Chrome MCP dynamic simulation against `localhost:3000` dev server
**Status**: **NOT** owner-recorded. Does NOT substitute for Phase 6 (`smoke-golden-regression.md`).
**Purpose**: Pre-Phase 6 dynamic sanity check — exercise the 7 cells via monkey-patched `window.showDirectoryPicker` so owner real-incognito + production execution lands on a smaller surface of unknowns.

> ⚠️ Phase 6 owner Happy Path Gate (harness-loop.md "Owner Happy Path 1회 직접 실행 게이트") **remains in force**. Owner must execute Chrome incognito + production in real, with hand-written ✅/❌ in `smoke-golden-regression.md`. Auto results below are **input** for that gate, not a substitute.

---

## What dynamic simulation can and cannot prove

| Can prove (this file) | Cannot prove (owner cells remain mandatory) |
|----------------------|---------------------------------------------|
| React state machine works (handle/error/warning) | Real Chrome FSA picker user gesture flow |
| `pickFolder()` 4-step split branches correctly | OS-level system folder block dialog (`SecurityError`) |
| `fsaError` vs `fsaWarning` channel separation | Real IDB on disk persistence across browser sessions |
| Scan button `disabled` prop reads only handle state | Production Vercel SSR/Edge runtime differences |
| `autoDetect` env flag gates Path Preview Card | Safari true behavior (here only no-query path tested) |
| WCAG AA computed contrast (from preflight-localhost-verification.md) | Screen reader announcement of kbd glyphs |

Patches applied in simulation:
- `window.showDirectoryPicker` → returns `{ kind: 'directory', name }` literal (cloneable plain object)
- `window.indexedDB.open` (Cell #7 only) → fires `onerror` for `coconutlabs.handles` DB to simulate `QuotaExceededError`

---

## Cell-by-cell simulation results (5/7 dynamic + 2 inherited)

### Cell #1 — Path Preview Card rendered (inherited from `preflight-localhost-verification.md`)

**Status**: ✅ PASS (auto)
**Evidence**:
- `.path-preview-card` markup present in modal after Join click
- 2 `.path-preview-row` children: `~/.claude/projects` + `~/.codex/sessions`
- 2 `.path-segment--hidden` with outline `rgb(0, 140, 90)` (`--young-coconut-dark` #008C5A)
- Reveal hint kbd labels: `⌘⇧·` + `Ctrl+H`
- Computed contrast 7.52:1 (≥ WCAG AA 4.5:1)
**Code anchor**: `JoinBurnIndexForm.tsx:392-410`
**Owner residual**: production Vercel #1 visual check.

---

### Cell #2 — SecurityError actionable message (dynamic) — ⚠️ CODEX CONCERN

**Status**: ✅ PASS (auto-simulated for literal `SecurityError`) — ⚠️ **Codex static review flags semantic gap; real-Chrome behavior unverified**
**Patch**: `window.showDirectoryPicker = async () => { throw new DOMException('user picked system folder', 'SecurityError'); }`
**Result (synthetic literal SecurityError)**:
```json
{
  "errorText": "Chrome blocked that folder because it contains system files. Drill down to your .claude/projects (or .codex/sessions) directory specifically — not your home folder.",
  "errorContains_blocked": true,
  "errorContains_drillDown": true,
  "errorContains_systemFiles": true,
  "warningText": null,
  "scanDisabled": true
}
```
**Code anchor**: `JoinBurnIndexForm.tsx:121-126` (SecurityError branch) + `JoinBurnIndexForm.tsx:120` (AbortError silent return — **runs first**)

> ⚠️ **Codex Phase 6 finding (MEDIUM)**: The dynamic simulation only proves the code path **once execution reaches** `e.name === "SecurityError"`. Codex's static evidence (MDN `showDirectoryPicker()` lines 235-243, WICG File System Access lines 638-643, Chromium `file_system_access_manager_impl.cc` lines 1405-1409 mapping `FileSystemAccessStatus::kOperationAborted` → Blink `DOMExceptionCode::kAbortError`) indicates production Chrome may dispatch **home-folder rejection as `AbortError`, not `SecurityError`**. If true, the silent return at `JoinBurnIndexForm.tsx:120` fires first and the actionable message at lines 122-124 **never renders**. See `codex-phase6.md` Cell #2 verdict for full citations.

**Locale-independent**: dispatch on `e.name === "SecurityError"` (not `error.message`) — Invariant #4 satisfied for the **branch**, but branch reachability is the open question.
**Owner residual (ELEVATED PRIORITY)**: real Chrome incognito + selecting `~` (home folder).
- **First step**: temporarily log `e.name` in browser DevTools console (or inspect via `pickFolder` catch) to capture the actual DOMException name Chrome dispatches.
- If `e.name === "SecurityError"` → current code works as designed → mark cell #2 ✅.
- If `e.name === "AbortError"` → current code returns silent → cell #2 ❌ → blocks Phase 6 → owner must decide: (a) widen AbortError handling to detect sensitive-directory case (e.g. message inspection or fallback copy on second consecutive AbortError without prior name mismatch), or (b) update SecurityError copy to be the default for ambiguous catch-all.

---

### Cell #3 — Name mismatch dynamic interpolation (dynamic)

**Status**: ✅ PASS (auto-simulated)
**Patch**: `window.showDirectoryPicker = async () => ({ kind: 'directory', name: '.claude' })` (user picked `.claude/`, not `.claude/projects/`)
**Result**:
```
You picked ".claude". We need the directory literally named "projects" (inside ~/.claude/ or ~/.codex/). Try again.
```
- `h.name` interpolated correctly as `.claude`
- `expectedName` interpolated correctly as `projects`
**Code anchor**: `JoinBurnIndexForm.tsx:145-148`
**Owner residual**: real folder pick of `~/.claude` to confirm Chrome returns `h.name === ".claude"` (not e.g. `claude`).

---

### Cell #4 — Happy path (dynamic, with bonus Cell #7 evidence)

**Status**: ✅ PASS (auto-simulated)
**Patch**: `window.showDirectoryPicker = async () => ({ kind: 'directory', name: 'projects' })` (plain object, not cloneable as FSA handle by IDB serializer)
**Result**:
```json
{
  "claudeBtnBefore": "Select .claude/projects folder",
  "claudeBtnAfter": "✓ projects",
  "errorText": null,
  "warningText": "Folder selected for this session, but it could not be remembered. You'll need to pick it again next time.",
  "scanDisabled": false,
  "handleSet": true
}
```
**Code anchor**: `JoinBurnIndexForm.tsx:153-167`
**Bonus**: structured-clone non-cloneable handle → `saveHandle` rejected → fsaWarning surfaced **while React state and Scan button remained healthy** → Invariant #5 (handle ↔ IDB decoupling) verified.
**Owner residual**: real Chrome happy path with real `FileSystemDirectoryHandle` (which IS IDB-cloneable in real Chrome) to confirm warning does NOT surface and Scan enables.

---

### Cell #5 — AbortError silent (dynamic)

**Status**: ✅ PASS (auto-simulated)
**Patch**: `window.showDirectoryPicker = async () => { throw new DOMException('user canceled picker', 'AbortError'); }`
**Result**:
- `claudeBtnBefore === claudeBtnAfter === "Select .claude/projects folder"` (unchanged)
- `errorText: null`
- `warningText: null`
**Code anchor**: `JoinBurnIndexForm.tsx:120`
**Locale-independent**: dispatch on `e.name === "AbortError"` — Invariant #4 verified.
**Owner residual**: real Chrome picker cancel button to confirm Chrome actually throws `AbortError` (vs e.g. `NotAllowedError`).

---

### Cell #6 — Safari/no-FSA fallback (dynamic, navigation-based)

**Status**: ✅ PASS (auto-simulated via no-`?auto-detect=1` navigation)
**Method**: Navigated tab to `http://localhost:3000/` (no `?auto-detect=1`), opened Join modal.
**Result**:
```json
{
  "url": "http://localhost:3000/",
  "modalOpened": true,
  "pathPreviewCardPresent": false,
  "fsaPickerButtonsCount": 0,
  "textareaCount": 1,
  "fileInputCount": 1,
  "formStepDesc": "Python 3.11+ required · No dependencies · View collector source ↗",
  "modalFirstHeading": "Join Burn Index"
}
```
**Code anchor**: `JoinBurnIndexForm.tsx:67-73` (autoDetect = false when env flag off AND no query param)
**Notes**:
- Path Preview Card not rendered ✅
- FSA picker buttons not rendered ✅
- Manual form (textarea + file input) renders ✅
- Step description shows `Python 3.11+ required · No dependencies · View collector source ↗` (manual variant)
**Owner residual**: real Safari (not just `?auto-detect=1` absence in Chrome) to confirm `"showDirectoryPicker" in window` is false and same branch taken.

---

### Cell #7 — IDB throttle → fsaWarning surfaces, Scan stays enabled (dynamic, IDB patch)

**Status**: ✅ PASS (auto-simulated via `indexedDB.open` patch)
**Patch**:
1. `window.indexedDB.open('coconutlabs.handles', 1)` → returns fake request that fires `onerror` after 5ms with `DOMException('Simulated quota exceeded for Cell #7', 'QuotaExceededError')`
2. `window.showDirectoryPicker = async () => ({ kind: 'directory', name: 'projects' })`
**Result**:
```json
{
  "cell7Patched": true,
  "claudeBtnBefore": "Select .claude/projects folder",
  "claudeBtnAfter": "✓ projects",
  "handleSet": true,
  "errorText": null,
  "warningText": "Folder selected for this session, but it could not be remembered. You'll need to pick it again next time.",
  "scanBtnText": "Scan & preview",
  "scanDisabled": false,
  "verdict": {
    "errorEmpty": true,
    "warningSurfaced": true,
    "scanEnabled": true,
    "handleSet": true
  }
}
```
**Code anchor**: `JoinBurnIndexForm.tsx:161-167` (saveHandle in try/catch, fsaWarning channel) + `handles.ts:11-24` (openHandlesDb rejects on indexedDB.open onerror) + `JoinBurnIndexForm.tsx:453` (Scan disabled prop reads `fsaLoading || (!claudeHandle && !codexHandle)` — not gated on fsaError/fsaWarning)
**Verifies**:
- Invariant #5 (handle state ↔ IDB persistence decoupling)
- `pickFolder` Step 4 separation from Steps 1-3
- fsaWarning channel is non-fatal (Scan stays enabled)
- fsaError stays empty (this is not an error, just a session-only fallback)
**Owner residual**: real Chrome with DevTools "Clear site data → IndexedDB" + retry to confirm same warning surfaces on actual IDB failure.

---

## Cell results summary

| # | Dynamic status | Codex static verdict | Method | Owner real-incognito residual (priority) |
|---|----------------|----------------------|--------|------------------------------------------|
| 1 | ✅ PASS (auto, inherited) | ✅ PASS | Localhost render verified via `preflight-localhost-verification.md` | Production Vercel + incognito visual check |
| **2** | ✅ PASS for literal `SecurityError` | ⚠️ **CONCERN MEDIUM** | `showDirectoryPicker` throws `SecurityError` DOMException | **🔴 ELEVATED P1**: Real Chrome `~` (home) selection + log `e.name`. Verifies whether Chrome actually dispatches SecurityError or AbortError |
| 3 | ✅ PASS (auto-sim) | ✅ PASS | `showDirectoryPicker` returns handle with mismatched name | P3: Real folder pick with `~/.claude` selection |
| 4 | ✅ PASS (auto-sim) | ✅ PASS | `showDirectoryPicker` returns happy handle (plain object); bonus IDB warning | P3: Real Chrome happy path with `~/.claude/projects` |
| 5 | ✅ PASS (auto-sim) | ✅ PASS (LOW stale-error note) | `showDirectoryPicker` throws `AbortError` DOMException | P3: Real Chrome picker cancel button |
| 6 | ✅ PASS (auto-sim) | ✅ PASS | Navigate without `?auto-detect=1`; autoDetect branch off | P3: Real Safari, not just no-query Chrome |
| **7** | ✅ PASS (auto-sim) | ✅ PASS | `indexedDB.open` patched to fire onerror | **P2**: Real DevTools IDB clear + retry (Codex recommends this 2nd) |

**Net**: 7/7 dynamic ✅ + 6/7 Codex static ✅ + 1 Codex CONCERN on Cell #2 (real-Chrome AbortError dispatch).

**Owner real-incognito priority (per Codex recommendation)**:
- **P1 🔴 Cell #2** — single blocker for seven-cell Happy Path. Capture `e.name` from home-folder selection.
- **P2 🟡 Cell #7** — IDB failure path render-timing observation.
- **P3 🟢 Cells #1/#3/#4/#5/#6 + a11y** — confirm dynamic simulations match real-Chrome behavior + VoiceOver/NVDA announcement of `<kbd>⌘⇧·</kbd>`.

---

## Codex Phase 6 static review (separate adversarial pass)

**Status**: ✅ **completed** (background task `bw7tpu1k9`, child of agent `acd38dee42751bbd8`)
**Output**: `tasks/folder-picker-ux/codex-phase6.md` (13261 bytes)
**Verdict**: **needs-attention**

### Cell-by-cell static verdict

| Cell | Codex verdict | Severity |
|------|---------------|----------|
| #1 Path Preview Card rendered | ✅ PASS | — |
| #2 SecurityError actionable | ⚠️ **CONCERN** | MEDIUM (dispatch mismatch) |
| #3 Name mismatch dynamic | ✅ PASS | — |
| #4 Happy path | ✅ PASS | — |
| #5 AbortError silent | ✅ PASS (with LOW stale-error note) | LOW |
| #6 Safari fallback | ✅ PASS | — |
| #7 IDB throttle warning | ✅ PASS | — |

### Adversarial probes (Q1-Q6) summary

| Q | Topic | Severity | Outcome |
|---|-------|----------|---------|
| Q1 | Step 4 IDB persistence ↔ React state timing | LOW | State commits before/concurrent with warning — Invariant #5 holds |
| Q2 | `instanceof DOMException` cross-Chromium stability | MEDIUM | Likely OK in Chrome proper; Edge/Brave/Vivaldi requires runtime check. **Larger concern feeds Cell #2** (AbortError dispatch) |
| Q3 | Parent-path validation gap (privacy/false-import) | MEDIUM | `pickFolder` validates only `h.name === expectedName`, not whether parent is `~/.claude/` or `~/.codex/`. User can pick `~/random/projects` and walker iterates if shape matches. Out of Phase 6 scope, separate cycle needed |
| Q4 | NEXT_PUBLIC_AUTO_DETECT_DEFAULT kill-switch precedence | LOW | Build-time inlined per `node_modules/next/dist/docs/.../env.md:53-64`. Rollback procedure `env=false + redeploy` (decision-log:341) is correct framing |
| Q5 | English UI beside Korean Chrome dialog | INFO | Matches plan: criteria.md:6 (UI 영어 유지) + smoke-golden-regression.md:14 (Korean dialog OK, English UI message same) |
| Q6 | `<kbd>⌘⇧·</kbd>` screen reader announcement | MEDIUM | No `aria-label` or visually-hidden expansion. VoiceOver/NVDA may pronounce literal symbols. Requires runtime check |

### Codex recommendation (owner real-incognito priority order)

1. **Cell #2 FIRST** — capture/log `e.name` when selecting home directory. **This is the only cell-level issue that can block the seven-cell Happy Path**.
2. **Cell #7** — run IDB failure path; static state split is correct but visible render timing should be observed.
3. **Cell a11y (criteria.md:19)** — especially `<kbd>⌘⇧·</kbd>` VoiceOver/NVDA announcement.
4. **Kill-switch framing** — keep `env=false + redeploy` (NOT live runtime flip).

> Phase 6 owner sign-off pulls from BOTH this dynamic simulation AND the Codex static analysis. They cover different sides: dynamic exercises real React runtime; static exercises code semantics + edge browsers. **Cell #2 is the single open static concern that real-incognito must resolve before owner "완료" 발화.**

---

## What changes for `criteria-execution-log.md`

| Criterion | Before | After |
|-----------|--------|-------|
| #2 Path Preview Card visual | `✅ (localhost rendered) ⏳ (production cell #1)` | unchanged (cell #1 already auto-verified via render) |
| #3 AbortError silent | `✅ (code) ⏳ (Phase 6 cell #5)` | `✅ (code + auto-sim cell #5) ⏳ (owner real cancel)` |
| #4 SecurityError actionable | `✅ (code) ⏳ (Phase 6 cell #2)` | `✅ (code + auto-sim cell #2) ⏳ (owner real system folder)` |
| #5 Name mismatch dynamic | `✅ (code) ⏳ (Phase 6 cell #3)` | `✅ (code + auto-sim cell #3) ⏳ (owner real ~/.claude pick)` |
| #6 a11y contrast + tab | `✅ (contrast + tab) ⏳ (SR + Lighthouse)` | unchanged |
| #11 Owner Happy Path 6 cells | `⏳ pending` | `⏳ partial — 7/7 auto-simulated, owner real-incognito + production cell #1 + #4 still required` |

---

## Files NOT touched

- `smoke-golden-regression.md` — owner-direct invariant preserved per harness-loop.md "Owner Happy Path 1회 직접 실행 게이트". All entries there require owner real-incognito hand-written ✅/❌.
- Source code (`JoinBurnIndexForm.tsx`, `globals.css`, `handles.ts`) — read-only verification only.
- `criteria.md` — Phase 0 criteria locked.
