# Codex Phase 1 — Adversarial Review Input Doc

**Date**: 2026-05-21
**Target**: Folder Picker UX Improvement (Approach B: inline preview + smart error recovery)
**Owner action**: 별 세션에서 `/codex` 실행 후 본 문서 전체 + 아래 §변경 surface 명세 + §JoinBurnIndexForm.tsx 발췌를 입력으로 전달. Codex 응답 전문을 본 파일 하단 §Response 섹션에 추가.

**Pass condition**: Codex HIGH/MEDIUM 결함 0건 (nit-only). HIGH/MEDIUM 발견 시 Plan v2 작성 후 재실행 (Phase 2 차단).

---

## §1. Plan 요지 (3 surfaces)

이번 사이클은 ON-flip 직후 chongwon83 owner가 production에서 직접 발견한 Chrome FSA picker first-impression 결함을 수정. 3 surface 변경:

### S1. Path Preview Card (신규)

picker 버튼 위에 인라인 시각 breadcrumb 카드. 두 row 노출:

```
~ / .claude / projects
~ / .codex / sessions
Hidden folders need: ⌘⇧· (macOS) or Ctrl+H (Linux) in your file manager
```

경로 segment 각각 `<span>` 분리해 hidden-folder prefix(`.`)를 시각적으로 강조 (예: `--young-coconut-dark` outline 또는 background tint). picker 버튼보다 visual weight 작게.

### S2. Smart Error Differentiation (pickFolder 재작성)

현재 `pickFolder()`는 `AbortError`만 silent, 나머지 모두 catch-all "Could not open the folder picker. Check browser permissions."로 묶임. 4분기로 확장:

- `e instanceof DOMException && e.name === "AbortError"` → `return` (silent, form-error 미노출)
- `e instanceof DOMException && e.name === "SecurityError"` → "Chrome blocked that folder because it contains system files. Drill down to your **~/.claude/projects** (or **~/.codex/sessions**) directory specifically — not your home folder."
- `e instanceof DOMException && e.name === "NotAllowedError"` → "Read access wasn't granted. Try again and approve the picker when Chrome prompts."
- 그 외 → "Couldn't open the folder picker. Try a different browser or check site permissions."

또한 name mismatch 메시지에 사용자가 실제 선택한 폴더명 동적 삽입:

```
You picked **${h.name}**. We need the directory literally named **${expectedName}** (inside ~/.claude/ or ~/.codex/). Try again.
```

**중요 invariant**: `error.message` 파싱 절대 금지 — Chrome dialog locale 의존 (한국어 환경에서 "이 폴더에는 시스템 파일이…" 등). 반드시 `error.name`만 사용.

### S3. Step 1 Helper Text Refinement

현 문구 (line 348-350): "Select only the exact directory shown below — not your home folder."
신규: "Pick the exact folder previewed below. Drill into hidden directories with the OS shortcut shown."

Path Preview Card와 microcopy 중복 없도록 단순화.

---

## §2. 위험 3축 평가

| 축 | 충족 | 근거 |
|----|------|------|
| ① 실패비용 ≥ 2h | ✅ | UX 회귀 시 cosmetic 수정 + 재배포 합산 2h+ |
| ② 영향범위 | ✅ | `JoinBurnIndexForm.tsx` + `globals.css` (production landing main CTA) — 모든 Chrome/Edge auto-detect 진입 사용자 |
| ③ 관찰가능성 | ✅ | UX 마찰은 axis2 telemetry로 부분 가시. 폴더 mismatch/cancel ratio는 client-side counter 없으면 silent fail |

3/3 → Codex 교차 리뷰 **강력 권장 + Design review 의무** (본 plan에 포함).

---

## §3. Pre-flagged Concerns (owner self-audit)

본 작업 입안 중 owner 본인이 발견한 사전 우려. Codex가 이 항목을 다시 검증하거나 추가 결함 식별 요청.

### P-1. WCAG AA contrast (HIGH 후보 — owner 직접 확인)

기존 token contrast 측정:
- `--fg2 (#525252)` on `--bg (#FFFFFF)` → ~7.5:1 ✅
- `--fg3 (#8E8E8E)` on `--bg (#FFFFFF)` → **~3.5:1 ❌ FAILS WCAG AA 4.5:1**
- `--young-coconut (#00D084)` on `--bg (#FFFFFF)` → **~1.8:1 ❌ FAILS** (텍스트 사용 금지)
- `--young-coconut-dark (#008C5A)` on `--bg (#FFFFFF)` → ~3.7:1 ⚠️ borderline (large text 가능, body text 부적합)

**S1 구현 시 강제 규칙**:
- 본문 텍스트: `--fg2` 사용 (`--fg3` 금지)
- accent / hidden-folder emphasis: `--young-coconut-dark`는 텍스트가 아닌 **outline / 1px border**로만. 또는 background tint(`--young-coconut-soft`)
- 에러 메시지: 기존 `.form-error` class 재사용 (검증 완료된 색상)

### P-2. macOS glyph fallback (Codex Q2)

reveal hint `⌘⇧·` (U+2318 PLACE OF INTEREST SIGN + U+21E7 UPWARDS WHITE ARROW + U+00B7 MIDDLE DOT)이 Windows 기본 폰트(Segoe UI)에서 정상 렌더 여부 미확인. tofu(`□`) 노출 시 cosmetic 결함. ASCII fallback "Cmd+Shift+." 추가 권장 여부.

### P-3. Visual hierarchy drift

Path Preview Card가 primary CTA(picker 버튼)보다 시각적으로 강조되면 attention drift. picker 버튼은 line 352 `.form-fsa-picker` class — current style: 큰 padding + outline. Path Preview Card는 작은 padding + 낮은 contrast로 designed.

---

## §4. Codex Challenge Questions (7개)

본 plan과 변경 surface 명세에 대해 다음 질문에 적대적으로 답해 결함을 식별:

1. **`error.name === "SecurityError"` 분기의 cross-browser 안정성**: Chrome 86+, Edge 86+에서 모두 동일하게 `SecurityError` 반환하는가? Brave/Vivaldi/Arc 등 Chromium 파생에서 다른 DOMException name 또는 다른 분기를 반환할 가능성? 만일 그렇다면 fallback 메시지 ("Couldn't open the folder picker. Try a different browser…")로 흡수 충분한가?

2. **macOS hint `⌘⇧·` glyph fallback**: U+2318(⌘), U+21E7(⇧)이 Windows 기본 폰트(Segoe UI)·Linux 기본 폰트(DejaVu)에서 정상 렌더되는가? 두 hint 동시 노출 모델(macOS+Linux)에서 Windows 사용자에게 tofu(`□`) 노출 시 cosmetic 결함. ASCII 표기 "Cmd+Shift+." 추가하면 microcopy 중복 발생 — 어느 쪽이 더 큰 cost?

3. **Step 1 helper text + Path Preview Card 중복 점검**: 현재 plan은 S3에서 helper text를 "Pick the exact folder previewed below. Drill into hidden directories with the OS shortcut shown."로 변경. Path Preview Card가 이미 두 row + reveal hint 표시 → S3 helper text 자체를 삭제하는 게 더 깔끔한가? cognitive load 최소화 관점에서 둘 중 어느 쪽이 우월?

4. **Path Preview Card visual hierarchy drift**: Card가 picker 버튼보다 시각 강조되면 primary CTA(picker click) attention drift. plan은 JetBrains Mono 13px (경로) + Inter 14px (설명) + outline border로 visual weight 최소화 의도. 이게 충분한가? hidden-folder(`.`-prefix) emphasis를 어떻게 표현해야 picker click conversion 회귀 0인가?

5. **AbortError silent의 UX cost**: 사용자가 picker 버튼 클릭 → dialog cancel → "버튼 눌렀는데 아무 반응 없음"으로 인지할 가능성. silent의 대안:
   (a) subtle toast 1.5s "Cancelled — try again when ready"
   (b) picker 버튼 자체에 1.5s "Cancelled" inline label
   (c) 완전 silent (현 plan)
   세 옵션 중 plan의 (c)가 옳은가? 별 대안의 cost 분석.

6. **두 hint(macOS+Linux) 동시 노출의 Linux 사용자 혼란**: Linux 사용자가 macOS hint `⌘⇧·`를 보고 "이건 내 OS 아닌데?" 혼란. plan은 OS detection 코드 분기 cost > 가치로 판단. 진짜 OS detection 없이 가는 게 옳은가? `navigator.userAgentData.platform` 사용 가능한가 (Chrome 90+)?

7. **`globals.css` 신규 클래스 + 기존 token 충돌**: `.path-preview-card`, `.path-preview-row`, `.path-segment`, `.path-segment--hidden`, `.path-preview-hint` 5개 신규 클래스 추가. 명명 규칙이 기존 `.form-*`, `.statusbar`, `.btn-*` 패턴과 어울리는가? `.form-path-preview-card`로 prefix 통일이 옳은가? DESIGN.md spec sync 의무는 어디까지 (신규 component 추가 시 DESIGN.md `## Components` 섹션 entry 1개 필수인가)?

---

## §5. JoinBurnIndexForm.tsx 발췌 (S2 재작성 대상)

### 현재 `pickFolder` (line 104-127)

```typescript
async function pickFolder(kind: "claude" | "codex") {
  try {
    // showDirectoryPicker is a browser API — not available in SSR/node
    const picker = (window as Window & typeof globalThis & {
      showDirectoryPicker(opts?: { mode?: string }): Promise<FileSystemDirectoryHandle>;
    }).showDirectoryPicker;
    const h = await picker({ mode: "read" });
    const expectedName = kind === "claude" ? "projects" : "sessions";
    if (h.name !== expectedName) {
      setFsaError(
        `Selected folder must be the .claude/projects (or .codex/sessions) directory itself, not your home directory. You selected "${h.name}".`,
      );
      return;
    }
    setFsaError("");
    await saveHandle(kind, h);
    if (kind === "claude") setClaudeHandle(h);
    else setCodexHandle(h);
  } catch (e) {
    // User cancelled the picker — not an error
    if (e instanceof DOMException && e.name === "AbortError") return;
    setFsaError("Could not open the folder picker. Check browser permissions.");
  }
}
```

### 현재 Auto-detect card markup (line 334-367 발췌)

```tsx
if (autoDetect) {
  return (
    <div className="form-card">
      <h3 className="form-title">Auto-detect Burn Summary</h3>
      <p className="form-desc">
        Point this page at your{" "}
        <code className="form-code-inline">.claude/projects</code> and{" "}
        <code className="form-code-inline">.codex/sessions</code> folders.
        Token counts are aggregated locally — only the 9 anonymised fields
        join the Burn Index.
      </p>

      <div className="form-step">
        <div className="form-step-label">Step 1 · Select folders</div>
        <div className="form-step-desc">
          Select only the exact directory shown below — not your home folder.
        </div>
        <div className="form-fsa-pickers">
          <button
            type="button"
            className={`form-fsa-picker${claudeHandle ? " form-fsa-picker--selected" : ""}`}
            onClick={() => pickFolder("claude")}
          >
            {claudeHandle ? `✓ ${claudeHandle.name}` : "Select .claude/projects folder"}
          </button>
          <button
            type="button"
            className={`form-fsa-picker${codexHandle ? " form-fsa-picker--selected" : ""}`}
            onClick={() => pickFolder("codex")}
          >
            {codexHandle ? `✓ ${codexHandle.name}` : "Select .codex/sessions folder"}
          </button>
        </div>
      </div>
      ...
      {fsaError && <p className="form-error">{fsaError}</p>}
```

---

## §6. 기존 token / class anchor

`app/globals.css`에서 확인된 사용 가능 토큰:

- 색상: `--bg` `#FFFFFF`, `--fg2` `#525252` (7.5:1), `--fg3` `#8E8E8E` (3.5:1 ⚠️), `--young-coconut` `#00D084`, `--young-coconut-dark` `#008C5A`, `--young-coconut-soft` `rgba(0,208,132,0.10)`, `--danger` `#DC2626`
- 폰트: `--font-ui` (Inter), `--font-mono` (JetBrains Mono)
- 모양: `--r-card` `8px`
- 기존 form 클래스: `.form-card`, `.form-title`, `.form-desc`, `.form-step`, `.form-step-label`, `.form-step-desc`, `.form-fsa-pickers`, `.form-fsa-picker`, `.form-fsa-picker--selected`, `.form-error`, `.form-code-inline`

---

## §Response (Codex output — owner 입력)

Codex Adversarial Review

  Target: working tree diff
  Verdict: needs-attention

  No-ship: the working tree contains live recovery credentials, the new e2e flow can contaminate real backend state, and the folder picker still treats optional IDB
  persistence as a hard blocker.

  Findings:
  - [critical] PyPI recovery codes are present in the working tree (credentials/PyPI-Recovery-Codes-chongwon5026-2026-05-21T07_35_20.758710.txt:1-8)
  The untracked credentials file contains eight PyPI recovery codes in plaintext. If this directory is committed, zipped, uploaded, or included in review artifacts,
  account recovery access is exposed. Because recovery codes are effectively backup auth material, deletion alone is not enough after exposure.
  Recommendation: Remove the file from the repo, rotate/regenerate PyPI recovery codes, add credentials/ to .gitignore, and verify the codes never entered git history
  or published artifacts.
  - [high] New e2e test sends real uploads and can pollute backend metrics (e2e/onboarding-30s.spec.ts:93-97)
  The 30s onboarding test drives the real UI through Add to Burn Index and waits for the success toast, but it does not mock /api/internal/issue-collector-token or
  /api/burnindex. Inference from the existing flow: handleConfirm() fetches a collector token, posts to /api/burnindex, and the server records submission metrics when
  Upstash env is present. BURN_STORE=memory only isolates the leaderboard store when Playwright launches the server; it does not isolate token Redis or rollout metrics,
   and reuseExistingServer can bypass that env entirely. A local run with .env.local/Upstash configured can inject the synthetic abc123def456 project hash and five
  @e2e-30s-* handles into real state. 
  Recommendation: Make this test hermetic: route/mock token issuance and /api/burnindex, or provide a dedicated test Redis namespace plus cleanup; force a freshly
  launched server with test env for e2e runs, and explicitly disable or namespace metrics writes under e2e.
  - [medium] Valid folder selection fails if IndexedDB persistence fails (components/forms/JoinBurnIndexForm.tsx:118-121)
  pickFolder() awaits saveHandle() before setting claudeHandle/codexHandle. If IndexedDB is blocked, quota-limited, unavailable in a managed/private browser, or
  otherwise rejects the handle write, the selected in-memory handle is discarded and the scan button remains disabled. The catch path then reports a generic
  picker/permissions failure even though the user already picked a valid folder. This makes optional persistence a hard dependency for the primary auto-detect flow.
  Recommendation: Set the React handle state independently of persistence, treat saveHandle() failure as non-fatal, and surface a scoped warning such as "Folder
  selected for this session, but it could not be remembered." Keep picker DOMException handling separate from IDB/storage errors.

 
