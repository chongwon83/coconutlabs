# Upload Stack — A11y Review (B.4 MAJOR #2, review only)

Date: 2026-05-26
Scope: FSA path + PostUploadSurvey + UploadSuccessCard (in-modal) + UploadSuccessBanner (page-level, NEW in B.4)
Verdict: PASS with one caveat (see §4 Risk 1)

This is a **review-only** doc. No code changes proposed here; everything below
either documents existing behavior or describes the additive layer added by
B.4. The five-surface stack continues to work because the new banner is
gated on `modal === null`, so it is **never** simultaneously mounted with
the in-modal `.upload-success-card`.

---

## 1. Surface Inventory (after B.4)

| # | Surface | Component | Mount condition | Role / aria-live | Receives focus? |
|---|---------|-----------|-----------------|------------------|-----------------|
| 1 | Modal overlay | `LandingApp` | `modal !== null` | none | container only |
| 2 | Modal content | `LandingApp` | `modal !== null` | none | container only |
| 3 | In-modal success card | `JoinBurnIndexForm` | `modal === "join"` AND `showSuccess === true` | role implicit / `aria-live="polite"` + `tabIndex={-1}` | Yes (on mount) |
| 4 | PostUploadSurvey | `JoinBurnIndexForm` | FSA path AND `showSurvey === true` | role implicit / form region | Yes (first input, default) |
| 5 | Page-level banner (NEW) | `LandingApp` → `UploadSuccessBanner` | `modal === null` AND `lastSuccess !== null` | `role="status"` + `aria-live="polite"` + `tabIndex={-1}` | Yes (on mount) |

Mutual-exclusion guarantee: surfaces 3 and 5 cannot coexist because (3)
requires `modal === "join"` and (5) requires `modal === null`. The page-level
state `lastSuccess` is set inside `handleImport`, which runs before the
modal closes, so the banner is **pre-armed** but only renders after the
user closes the modal.

---

## 2. Focus Order (TAB sequence)

### 2a. Inside the modal (surfaces 1–4 active)

1. Modal close button (`.modal-close`, top-right `×`)
2. `JoinBurnIndexForm` step-1 / step-2 / step-3 fields (form-internal)
3. On success: in-modal `.upload-success-card` body (focused programmatically by `successCardRef.current.focus()` at `JoinBurnIndexForm.tsx:121`)
4. `.upload-success-card__cta` ("리더보드 보기")
5. PostUploadSurvey first radio / textarea (FSA path only)

Existing behavior — unchanged by B.4.

### 2b. After modal closes (surfaces 1–4 unmounted, surface 5 mounts)

1. Page-level banner container (`<UploadSuccessBanner>` — focused programmatically by `ref.current.focus()` at `UploadSuccessBanner.tsx:27`)
2. Banner CTA (`.upload-success-banner__cta` "리더보드 보기")
3. Banner close (`.upload-success-banner__close` "배너 닫기")
4. Subsequent page elements continue in normal DOM order (Nav, Hero, …)

Because the banner is rendered between `<Nav>` and `<main>`, it inserts
itself at a natural TAB position immediately after Nav. Users who Shift+TAB
back into Nav will not skip it.

---

## 3. Screen Reader Announcement Priority

| Time | Surface | Announces | Politeness |
|------|---------|-----------|------------|
| t0 (upload succeeds, modal still open) | In-modal card (#3) | "리더보드에 추가되었어요. @handle" | polite |
| t0.x (FSA only) | PostUploadSurvey (#4) | survey heading | polite (label) |
| t1 (user closes modal) | Banner (#5) | "리더보드에 추가되었어요. @handle" | polite |

**Why two announcements is acceptable:**

- They are not simultaneous — t1 only fires after the modal unmounts, so
  there is no overlap.
- Both use `aria-live="polite"` (NOT `assertive`) so neither interrupts
  in-progress speech.
- The content is identical, so the redundancy is reinforcement, not
  contradiction.

**Why not `aria-live="assertive"` on the banner:**

- The banner is informational, not a critical error.
- Assertive would interrupt PostUploadSurvey if the user is mid-input,
  which would be hostile.
- WAI-ARIA APG guidance: "polite" is the default for status updates.

---

## 4. Risks & Caveats

### Risk 1 — Double announcement on fast modal close

**Scenario:** User uploads → success card mounts → SR begins announcing
("리더보드에 …") → user immediately clicks the modal-close `×` before
SR finishes → banner mounts → SR re-announces.

**Severity:** Low. Polite queue means the second utterance just appends;
it does not interrupt.

**Mitigation considered, rejected:** Suppress banner if announcement
fired within 2s. Rejected because (a) we cannot detect SR activity from
JS reliably, (b) the redundancy is a feature for users who missed the
first pass.

### Risk 2 — Banner persists across navigation

**Scenario:** User uploads, closes modal, banner shows, navigates to
`#burn`. Does the banner persist?

**Behavior:** Yes — banner stays mounted until the user clicks the close
`×` or the CTA. The CTA `onClick` calls `onDismiss()` so the banner
unmounts after hash navigation. Visiting `#burn` directly via the CTA
clears the success state.

**Severity:** None — this is intended. The point of B.4 MAJOR #1 is
exactly that the banner survives modal close.

### Risk 2b — Stale `lastSuccess` on modal re-open-then-close (Codex 2026-05-26)

**Scenario:** User uploads → banner mounts → user re-opens the modal
(banner unmounts because the gate flips back to `modal !== null`) → user
closes the modal **without** uploading again. The banner re-mounts because
`lastSuccess` was never cleared.

**Severity:** Low (and arguably intentional — surfaces the user's most
recent confirmed success). The banner reappearance carries the same
"리더보드에 추가되었어요" content the user just saw, so the redundancy is
reinforcement, not contradiction (same rationale as Risk 1).

**Decision:** Accept current behavior. Rejected mitigation: clearing
`lastSuccess` on modal close would surprise users who close the modal by
accident, suppressing the only persistent confirmation they had.

### Risk 3 — Focus trap from `tabIndex={-1}` + `.focus()`

**Scenario:** Banner programmatically takes focus on mount. Does this
trap the user inside the banner?

**Behavior:** No. `tabIndex={-1}` only makes the element programmatically
focusable (so `.focus()` works); it does NOT remove the element from the
natural TAB order. TAB from the banner moves to its CTA → close → next
DOM element (per §2b).

---

## 5. WCAG Mapping

| Criterion | Status | Notes |
|-----------|--------|-------|
| 1.3.1 Info and Relationships | PASS | `<h3>` title, `<p>` handle, `role="status"` |
| 2.1.1 Keyboard | PASS | All interactive elements reachable by TAB |
| 2.4.3 Focus Order | PASS | Programmatic focus + natural DOM order (see §2) |
| 2.4.7 Focus Visible | PASS | `:focus-visible` 3px solid `--young-coconut` outline (globals.css) |
| 3.3.1 Error Identification | N/A | Success surface, not error |
| 4.1.3 Status Messages | PASS | `role="status"` + `aria-live="polite"` |

---

## 6. Out of Scope

- Re-architecting the existing in-modal `.upload-success-card` (A.12 invariants locked).
- Replacing the survey with a different telemetry surface.
- Changing politeness levels on any existing surface.
- Mobile-specific gestures (existing CSS at `globals.css` `@media (max-width: 640px)` covers banner; in-modal card already covered).

---

## 7. Verification

Manual checks performed during this review (no code changes):

- [x] Confirmed `aria-live="polite"` on banner (`UploadSuccessBanner.tsx:35`)
- [x] Confirmed `role="status"` on banner (`UploadSuccessBanner.tsx:34`)
- [x] Confirmed `tabIndex={-1}` on banner (`UploadSuccessBanner.tsx:33`)
- [x] Confirmed `.focus()` + `scrollIntoView({block:"nearest"})` (`UploadSuccessBanner.tsx:23-27`)
- [x] Confirmed reduced-motion path uses `behavior:"instant"` (`UploadSuccessBanner.tsx:25`)
- [x] Confirmed mutual exclusion via `modal === null` gate (`LandingApp.tsx`)
- [x] Confirmed CTA scope is `#burn` only (no extra side effects)
- [x] Existing in-modal card behavior unchanged (A.12 invariants preserved)

E2E coverage planned in `e2e/upload-success-card-banner.spec.ts` (Task #18).
