# Design Review Phase 3 — Input Doc

**Date**: 2026-05-21
**Target**: Folder Picker UX Improvement (Approach B)
**Owner action**: 별 세션에서 `/plan-design-review` 실행 후 본 문서 + **Plan v2 delta** (`tasks/folder-picker-ux/plan-v2-delta.md`) + DESIGN.md + `app/globals.css` 토큰 정의 + 아래 §S1 markup 스케치 입력. 응답 전문을 본 파일 하단 §Response 섹션에 추가.

**선행조건**: Phase 1 Codex PARTIAL 판정 (2026-05-21) → Plan v2 delta §B (IDB persistence split) 반영 완료 후 실행. nit-only일 경우 v2 그대로 사용.

**Pass condition**: HIGH/MEDIUM 결함 0건 (nit-only). 발견 시 Plan v3 작성 후 재실행 (Phase 4 차단).

---

## §1. 검수 범위 (5축)

### A. 시각 hierarchy

Path Preview Card가 primary CTA (picker 버튼, `.form-fsa-picker`)를 압도하지 않는가? plan은 다음으로 차등화:

| 요소 | 시각 weight | 폰트 | 색상 |
|------|------------|------|------|
| Picker button (primary CTA) | 가장 강함 | Inter UI default | `--young-coconut` outline + hover `#F6FDF6` |
| Path Preview Card 본문 | 중간 | JetBrains Mono 13px (경로) / Inter 14px (설명) | `--fg2` (#525252) |
| Hidden segment emphasis | 약함 | inherit | `--young-coconut-dark` 1px border outline (NOT text color) |
| Reveal hint | 가장 약함 | Inter 12px | `--fg2` (`--fg3`는 contrast 3.5:1로 WCAG AA 미달) |
| **`.form-warning` (v2 신규, IDB non-fatal)** | **중간 (error보다 약함)** | **Inter 13px** | **`--fg2` text + `--young-coconut-dark` 1px border or `--young-coconut-soft` bg tint** |

attention drift 방지가 충분한가? Path Preview Card에 background tint(`--young-coconut-soft`) 적용 여부 결정.

**v2 추가 검토**: `.form-warning`은 `.form-error`(red `--danger`)와 시각적으로 명확히 구분되어야 함. warning은 "선택은 성공, 영구 저장만 실패" 의미 — 시각적 강도는 error보다 낮고 success보다 높음. red 톤은 금지 (`--danger` 재사용 X).

### B. JetBrains Mono / Inter 경계

- JetBrains Mono 사용처: 경로 문자열 `~ / .claude / projects` (한 segment 한 letter씩 monospace 정렬)
- Inter 사용처: 모든 prose (helper text, reveal hint, error message)
- 경계 명확성: 한 카드 안에 두 폰트 혼합 시 시각 혼란 없는가? DESIGN.md `## Typography` 섹션 정의 (`tier-label`은 mono uppercase, `row-body`는 Inter 14px)와 정합인가?

### C. 토큰 정합 (DESIGN.md sync)

신규 **6개 클래스** (v1 5개 + v2 `.form-warning` 1개)가 다음 token만 reuse하는지 확인 (raw hex 직접 사용 0건):

```
.path-preview-card     → background: var(--bg) (또는 var(--young-coconut-soft)?)
                       → border: 1px solid var(--fg3)
                       → border-radius: var(--r-card)
                       → padding: 12px
.path-preview-row      → font-family: var(--font-mono)
                       → font-size: 13px
                       → color: var(--fg2)
.path-segment          → display: inline
                       → color: var(--fg2)
.path-segment--hidden  → outline: 1px solid var(--young-coconut-dark)
                       → border-radius: 2px
                       → padding: 0 4px
.path-preview-hint     → font-family: var(--font-ui)
                       → font-size: 12px
                       → color: var(--fg2)
.form-warning (v2)     → font-family: var(--font-ui)
                       → font-size: 13px
                       → color: var(--fg2)
                       → border: 1px solid var(--young-coconut-dark) (또는 bg: var(--young-coconut-soft))
                       → padding: 8px 12px
                       → border-radius: var(--r-card)
                       → NOT var(--danger) (error와 구분)
```

DESIGN.md `## Components` 섹션에 `path-preview-card` + `form-warning` entries 2개 추가가 의무인가? (component spec sync — gstack/google-labs 표준)

### D. WCAG AA 4.5:1 contrast

`app/globals.css` 토큰 측정:

| 조합 | 비율 | 판정 |
|------|------|------|
| `--fg2` (#525252) on `--bg` (#FFFFFF) | ~7.5:1 | ✅ AA 통과 (large + body) |
| `--fg3` (#8E8E8E) on `--bg` (#FFFFFF) | ~3.5:1 | ❌ AA 미달 (body text 금지) |
| `--young-coconut` (#00D084) on `--bg` (#FFFFFF) | ~1.8:1 | ❌ AA 미달 (텍스트 사용 금지, decorative only) |
| `--young-coconut-dark` (#008C5A) on `--bg` (#FFFFFF) | ~3.7:1 | ⚠️ AA 미달 (body text 부적합, large text 가능) |
| `--danger` (#DC2626) on `--bg` (#FFFFFF) | ~5.4:1 | ✅ AA 통과 |

**S1 강제 규칙**:
- 본문 텍스트 = `--fg2`
- hidden-folder emphasis = `--young-coconut-dark` outline/border only (text color 금지)
- 에러 메시지 = `.form-error` 재사용 (검증 완료된 `--danger` 사용)

### E. Microcopy 중복

Step 1 helper text + Path Preview Card 동시 노출 시 중복 검수:

- Step 1 helper (S3 변경 후): "Pick the exact folder previewed below. Drill into hidden directories with the OS shortcut shown."
- Path Preview Card 본문: 두 row breadcrumb + "Hidden folders need: ⌘⇧· (macOS) or Ctrl+H (Linux) in your file manager"

"OS shortcut shown" vs "Hidden folders need: ⌘⇧·…" — 두 문구가 같은 정보를 두 번 말하는가? 어느 쪽을 삭제하는 게 cognitive load 최소?

**v2 추가 — fsaError ↔ fsaWarning 동시 노출 microcopy 검수**:

두 채널이 동시 노출되는 시나리오 (예: name mismatch 후 새 폴더 선택, 이전 warning 잔존)에서 두 메시지가 충돌·중복하지 않는가? plan v2 logic은 picker 성공 시 `setFsaError("")` + `setFsaWarning("")` 두 채널 모두 clear. IDB save 실패 시에만 `fsaWarning` set — 그러므로 동시 노출 가능 케이스는 거의 없음. JSX 배치 순서(`fsaError` 위 vs `fsaWarning` 아래)는 Phase 5에서 결정.

---

## §2. S1 Path Preview Card markup 스케치

```tsx
<div className="path-preview-card">
  <div className="path-preview-row">
    <span className="path-segment">~</span>
    <span className="path-segment-sep">/</span>
    <span className="path-segment path-segment--hidden">.claude</span>
    <span className="path-segment-sep">/</span>
    <span className="path-segment">projects</span>
  </div>
  <div className="path-preview-row">
    <span className="path-segment">~</span>
    <span className="path-segment-sep">/</span>
    <span className="path-segment path-segment--hidden">.codex</span>
    <span className="path-segment-sep">/</span>
    <span className="path-segment">sessions</span>
  </div>
  <p className="path-preview-hint">
    Hidden folders need: <kbd>⌘⇧·</kbd> (macOS) or <kbd>Ctrl+H</kbd> (Linux) in your file manager
  </p>
</div>
```

배치 위치: `<div className="form-step">` 안의 `<div className="form-step-desc">` 직후, `<div className="form-fsa-pickers">` 직전 (= line 350~351 사이).

---

## §3. 기존 DESIGN.md 컨텍스트 (참고)

DESIGN.md `## Components`는 현재 `tier-header`, `tier-caption`, `tier-count` 3개. 본 작업이 `path-preview-card` 추가 시 다음 entry가 적절한가:

```markdown
- **path-preview-card** — inline breadcrumb card showing the literal directory
  paths the picker expects. Hidden segments (e.g., `.claude`) are emphasized
  with a `secondary` outline. Renders above the picker buttons in the
  auto-detect flow.
```

YAML front matter `components:` 섹션에도 추가가 의무인가? (현재 3개 entry)

---

## §4. 검수 항목 체크리스트

owner가 `/plan-design-review` 응답에서 다음을 확인:

- [ ] Path Preview Card visual hierarchy가 primary CTA를 압도하지 않음 (HIGH/MEDIUM 결함 0)
- [ ] JetBrains Mono ↔ Inter 폰트 경계 명확 (한 카드 내 혼합 OK)
- [ ] 신규 **6개 클래스**가 token reuse만 (raw hex 0건) — v1 5개 + v2 `.form-warning` 1개
- [ ] WCAG AA 4.5:1: 본문 텍스트 `--fg2`만, accent는 border/outline only
- [ ] Step 1 helper text + Path Preview Card 중복 0
- [ ] **`.form-warning` ↔ `.form-error` 시각 구분 명확** (red 톤 금지, IDB non-fatal scoped warning 의미 전달)
- [ ] DESIGN.md `## Components` 섹션에 `path-preview-card` + `form-warning` entries 2개 추가 권장 (필수 여부 Phase 3에서 확인)

---

## §Response (Design review output — self-audit by Claude, owner 권한 위임 모드)

**Date**: 2026-05-21
**Mode**: Owner가 모든 권한 위임 ("모든 권한 줄게, 네가 알아서 진행해줘") → Claude 직접 5축 자가검증 수행. 별 세션 `/plan-design-review` 호출 대체. 결과 정직 보고.
**Inputs**:
- Plan v2 delta (`tasks/folder-picker-ux/plan-v2-delta.md`)
- DESIGN.md (112 lines, tier-focused YAML+prose)
- `app/globals.css` (1998 lines, tokens lines 7-55 + forms 1366-1506 + remainder 1507-1998 verified)
- `JoinBurnIndexForm.tsx` (627 lines, pickFolder 104-127 + render 334-486 + state 75-86)
- S1 markup sketch (§2)

---

### 판정: **PASS — HIGH/MEDIUM 결함 0건**

5축 + v2 추가 1축 (fsaError ↔ fsaWarning) 모두 통과. NIT 3건 발견 (블로킹 아님, Phase 5 구현 시 적용 권장).

---

### 5축 audit 표

| 축 | 항목 | 판정 | 근거 |
|----|------|------|------|
| A | Path Preview Card가 primary CTA 압도 안 함 | ✅ PASS | Picker = Inter UI default + `--young-coconut` outline + hover `#F6FDF6` (가장 강함, globals.css L1425-1437 정합). Card body = Inter 14px / Mono 13px `--fg2` (중간). Reveal hint = Inter 12px `--fg2` (가장 약함). 의도된 시각 hierarchy 보존 |
| B | JetBrains Mono ↔ Inter 폰트 경계 | ✅ PASS | Mono: 경로 문자열 `~ / .claude / projects` 한정 (segment·separator). Inter: helper / hint / warning 모든 prose. DESIGN.md `tier-label` Mono uppercase 패턴과 정합. 카드 내 혼합 OK |
| C | 신규 **6개 클래스** token reuse (raw hex 0건) | ✅ PASS | 모두 기존 token 사용: `--bg`, `--border`, `--fg2`, `--young-coconut-dark` (border/outline only), `--young-coconut-soft` (bg tint), `--danger` (재사용 안 함 — warning은 별도), `--r-card`, `--font-ui`, `--font-mono`. raw hex 0건 |
| D | WCAG AA 4.5:1 contrast | ✅ PASS | 본문 text 모두 `--fg2` (#525252 = 7.5:1, AA ✅). `--young-coconut-dark` (#008C5A = 3.7:1)는 border/outline only — text 사용 금지 룰 준수. `--fg3` (#8E8E8E = 3.5:1)는 text 미사용. `.form-error` 재검증 = `--danger` (#DC2626 = 5.4:1, AA ✅) 유지 |
| E | Step 1 helper ↔ Card microcopy 중복 | ✅ PASS (NIT 1건) | Step 1 helper(변경 후) "Pick the exact folder previewed below. Drill into hidden directories with **the OS shortcut shown**." → Card hint "Hidden folders need: ⌘⇧· (macOS) or Ctrl+H (Linux) in your file manager". "shown" 지시어가 Card hint를 가리켜 **synergy**. 중복 아님. NIT: "hidden" 개념 2회 언급 (action vs mechanism 분리, 수용 가능) |
| F (v2) | `fsaError` ↔ `fsaWarning` 동시 노출 | ✅ PASS | Plan v2 logic: picker 성공 시 두 channel 모두 clear (`setFsaError("")` + `setFsaWarning("")`). saveHandle 실패 시에만 warning set, error는 빈 채 유지. 동시 노출 케이스 거의 없음. JSX 배치는 Phase 5에서 (`fsaError` 위 / `fsaWarning` 아래 권장) |

---

### NIT 3건 (블로킹 아님, Phase 5 구현 시 반영)

1. **`.path-preview-card` border token**: design-review-phase3.md §1.C 초안은 `border: 1px solid var(--fg3)`로 제안. globals.css 전체 패턴 (L1511, L1606, L1633, L1660, L1671 등)은 `var(--border)` 사용이 일관. **권장: `border: 1px solid var(--border)`로 변경**. 이유: ① 디자인 시스템 일관성 ② `--fg3` (#8E8E8E)는 text-contrast 부적합 토큰이라 border 용도 명확 분리

2. **DESIGN.md `## Components` 섹션 추가 여부**: 현재 entries 3개 (`tier-header`, `tier-caption`, `tier-count`) 모두 Burn Index leaderboard tier 영역. `path-preview-card` + `form-warning`은 forms 영역으로 **scope 확장**에 해당. 결정: **DESIGN.md 추가 보류** (Phase 8 retro에서 재평가). 이유: ① 현 DESIGN.md scope는 leaderboard tier hierarchy 한정 ② forms 영역 component spec sync는 형식 lint 부담만 늘림 ③ design.md lint는 forms 클래스 미정의 상태에서도 통과 (현 DESIGN.md error 0건 유지). diff.md `DESIGN.md ~+10/-0 (조건부)` → **skip**으로 확정

3. **`.form-warning` border vs bg tint 선택**: §1.A 표는 "`--young-coconut-dark` 1px border or `--young-coconut-soft` bg tint" 둘 다 옵션. **권장: bg tint (`--young-coconut-soft`) 단독 사용**. 이유: ① border 사용 시 `.form-error`와 시각 weight 너무 유사 (둘 다 border) ② bg tint는 "선택 성공, 영구 저장만 실패" non-fatal 의미를 더 부드럽게 전달 ③ 추가 padding/border-radius 부담 감소

---

### Phase 4 (Plan v3) 액션

NIT 3건은 Plan v2 §F (diff.md 행)와 §B.4 (form-warning 토큰 정의)에 직접 반영. Plan v3 별도 문서 작성 불필요. `unverified.md`에 "Design Phase 3: PASS — NIT 3건 Phase 5 구현 시 반영" 1줄 기록.

---

### Phase 5 진입 가능 여부

✅ **진입 가능**. HIGH/MEDIUM 결함 0건. NIT 3건은 구현 단계에서 직접 코드에 반영.
