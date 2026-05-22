# Codex Phase 7 — Findings 2/3 적대적 검토 인풋

**Date**: 2026-05-22
**Cycle**: Phase 7.5 (UX Findings 2+3 patch, Finding 1 별 사이클)
**Verdict 요청**: PASS / needs-attention(HIGH·MEDIUM) / nit-only
**기존 산출물**:
- `codex-phase1.md` — Phase 1 adversarial review (UX surface 1·2·3)
- `codex-phase6.md` — Phase 6 verdict: needs-attention (Cell #2 AbortError CONCERN → Contingency Patch v2 PASS)
- `phase7-auxiliary-verification.md` — Claude-in-Chrome 보조 검증 PASS (production main chunks 8개 × 0 secret hits)

---

## 1. Phase 7 deploy 컨텍스트

- **Vercel commit**: `6cda4c5` deployment `9zFwEtq2UE3436K9m6ZrnNQX7Zyw` (success)
- **Invariant 5/5 PASS** — 머지 차단 사유 없음
  1. Build secret leak 0 (production main chunks 8개 × 707,406 B × 0 hits)
  2. a11y 회귀 0 (Path Preview Card contrast 7.52:1)
  3. Auto-detect 카드 렌더 정상 (모달 오픈 후 카드 노출 정상)
  4. error.message 파싱 0 (count-based heuristic, e.name only)
  5. Handle ↔ IDB 분리 PASS (코드 검사)

- **Owner self-test (2026-05-22 production incognito) verbatim**:
  1. "Auto-detect Burn Summary 모달이 자동으로 뜨지는 않음"
  2. "Hidden folders 보는 ctrl+shift+. 의 글자가 작아서 잘 안 보임. `.`이 마침표로 보임"
  3. "홈 폴더에서 접근해야 한다는 내용이 있으면 좋을 것 같음"

- **Finding 분류**:
  - Finding 1 → Phase 8 별 사이클 (LandingApp.tsx useEffect 추가 — modal auto-open from `?auto-detect=1`)
  - Finding 2 → **본 사이클** (kbd 시인성)
  - Finding 3 → **본 사이클** (home folder 안내)

---

## 2. Finding 2 진단 — kbd 시인성

### 현재 코드

`app/globals.css:2038-2046`:
```css
.path-preview-hint kbd {
  font-family: var(--font-mono);
  font-size: 11px;
  padding: 1px 5px;
  background: var(--surface-muted);
  border: 1px solid var(--border);
  border-radius: 3px;
  color: var(--fg);
}
```

`components/forms/JoinBurnIndexForm.tsx:422-424`:
```tsx
<p className="path-preview-hint">
  Hidden folders need: <kbd>⌘⇧.</kbd> (macOS) or <kbd>Ctrl+H</kbd> (Linux) in your file manager
</p>
```

### Claude-in-Chrome 실측 (2026-05-22)

- kbd 박스: 32×19 px (`<kbd>⌘⇧.</kbd>`)
- font-size: 11px JetBrains Mono
- 마침표(`.`) 폭: 1-2 px → 시각적으로 키 라벨이 아닌 문장 종결자로 인지
- 키 3개 결합(⌘⇧.) 시 좌우 여백 부족 → `.` 글리프 손실

### 패치 후보 A (Finding 2)

`app/globals.css:2038-2046` 교체:

```css
.path-preview-hint kbd {
  font-family: var(--font-mono);
  font-size: 13px;        /* 11→13: `.` 글리프 명확화 */
  padding: 2px 7px;       /* 1px 5px → 2px 7px: 키캡 여백 확보 */
  background: var(--surface-muted);
  border: 1px solid var(--border);
  border-radius: 3px;
  color: var(--fg);
  letter-spacing: 0.5px;  /* `.`이 `⌘⇧`와 결합 안 보이도록 */
}
```

**근거**:
- 13px = Path Preview row(13px JetBrains Mono)와 동일 사이즈 → 위계 충돌 우려 (검토 질문 #1)
- `letter-spacing: 0.5px` → 키 3개 결합 시 글리프 분리. 13px Mono 기준 약 6.5% 자간 확장
- padding 2px 7px → 키캡 형태 명확화 (현 1px 5px는 너무 타이트)
- WCAG AA: `--fg` (`#0a0a0a`) on `--surface-muted` (`#fafafa`) = **20.4:1** (이미 PASS, font-size 변경은 contrast 무관)

---

## 3. Finding 3 진단 — home folder 안내 부재

### 현재 텍스트

> "Hidden folders need: ⌘⇧. (macOS) or Ctrl+H (Linux) in your file manager"

### 문제

- Path Preview Card row에 `~` symbol은 노출되나 "home folder" 명시 X
- First-time 사용자는 `~`이 home임을 모를 수 있음 (특히 GUI 위주 사용자)
- "in your file manager"는 OS 단축키 컨텍스트만 제공 — 어디서 시작해야 하는지 미명시

### 패치 후보 B (Finding 3)

**안 ①** (default — 검토 질문 #3에 대한 일관된 디폴트):

```tsx
<p className="path-preview-hint">
  Start from your home folder. Reveal hidden folders with <kbd>⌘⇧.</kbd>
  <span className="kbd-label">(period)</span> on macOS or <kbd>Ctrl+H</kbd> on Linux.
</p>
```

**안 ②** (kbd 라벨만 추가, home folder 안내 없음):

```tsx
<p className="path-preview-hint">
  Hidden folders need: <kbd>⌘⇧.</kbd>
  <span className="kbd-label">(period)</span> on macOS or <kbd>Ctrl+H</kbd> on Linux in your file manager.
</p>
```

### 신규 클래스 (`.kbd-label`)

`app/globals.css` 2046 직후 (kbd 블록 직후):

```css
.path-preview-hint .kbd-label {
  font-family: var(--font-ui);
  font-size: 11px;
  color: var(--fg3);
  margin-left: 2px;
}
```

**근거**:
- `--font-ui` (Inter) → kbd(JetBrains Mono)와 명시적 구분
- `font-size: 11px` → 보조 텍스트로 시각 위계 확실
- `--fg3` → 본문(`--fg2`)보다 옅은 색조로 보조 라벨 표시
- `margin-left: 2px` → kbd 박스와 라벨 분리

### 토큰 사전 확인

| 토큰 | 정의 위치 | 용도 |
|------|----------|------|
| `--font-ui` | `globals.css:11-69` | Inter (label) |
| `--font-mono` | `globals.css:11-69` | JetBrains Mono (kbd) |
| `--fg` | `globals.css:11-69` | kbd text color (20.4:1 contrast) |
| `--fg3` | `globals.css:11-69` | secondary label color |
| `--surface-muted` | `globals.css:11-69` | kbd background |
| `--border` | `globals.css:11-69` | kbd border |

raw hex 사용 0건 (Invariant 패턴 준수).

---

## 4. 검토 질문 5개

### Q1. Visual hierarchy 위계 충돌

13px kbd ≡ Path Preview row (13px JetBrains Mono). kbd가 row보다 강조되는 어색함은? row와 동일 사이즈로 가도 무방한가? 대안: 12px kbd (row 13px 대비 1px 작게).

### Q2. Screen reader naturalness — `.kbd-label`

`<span className="kbd-label">(period)</span>`이 VoiceOver/NVDA에서 자연스럽게 읽히는가? 또는 `<kbd>` 자체에 `aria-label="period key"`가 더 적절한가? 현재 hint `<kbd>⌘⇧.</kbd>`는 screen reader가 "command shift period"로 읽지 못할 수 있음 (Codex Phase 6 Q6 미해결 잔존).

### Q3. 안 ① vs 안 ② — first-time 사용자 cognitive load

- 안 ①: "Start from your home folder. Reveal hidden folders with..." — 액션 순서 명시 (home → reveal)
- 안 ②: "Hidden folders need: ... in your file manager." — 기존 톤 유지 + `(period)` 라벨만 추가

어느 쪽이 first-time 사용자에게 cognitive load 적은가? 안 ①은 길이 ↑이지만 액션 명료. 안 ②는 짧지만 home folder 명시 부재.

### Q4. `~` symbol과 "home folder" 명시 중복 위험

Path Preview Card row 1: `~ / .claude / projects`. hint에 "Start from your home folder" 명시 시 `~`와 의미 중복 — 노이즈 vs 보강?

### Q5. WCAG AA 재계산 필요 항목

13px kbd + letter-spacing 0.5px + `--fg3` label 추가 후 재검토 항목:
- `--fg` (`#0a0a0a`) on `--surface-muted` (`#fafafa`): 20.4:1 (변경 없음 — color/background unchanged)
- `--fg3` on `--bg` (`#ffffff`): 별도 계산 필요. `--fg3` 정의 값에 따라 4.5:1 통과 여부 확인 요청

---

## 5. 본 검토에서 요청하는 산출물

1. **Verdict**: PASS / needs-attention / nit-only
2. **Q1-Q5 명시 응답** (각 1-2 문장)
3. **안 ① vs ② 권장** (Q3 응답 + 디폴트 선택 근거)
4. **HIGH/MEDIUM 결함이 있다면 mitigation 제안**
5. **추가 사각지대 (kbd a11y, microcopy 중복, font-size shift, letter-spacing UX 영향 등) 자유 기술**

PASS 또는 nit-only → Phase 7.5.2 (3 Edits 적용) 진입.
HIGH/MEDIUM ≥ 1건 → patch v2 발산 후 본 파일 재실행 (재시도 1회 한).

---

## 6. Patch v2 (Codex Phase 7.5.1 verdict 반영, 2026-05-22)

**v1 verdict (`codex-phase7.md`)**: needs-attention(MEDIUM ×2, LOW ×1). 본 섹션은 v2 발산 — 재실행 1회 한도 사용 (plan 7.5.1).

### Codex v1 결함 요약

| Severity | 사항 | v1 위치 | v2 mitigation |
|----------|-----|---------|---------------|
| **MEDIUM** | `.kbd-label` color `var(--fg3)` WCAG AA 미달 (`#8E8E8E` on `#FFFFFF` = 3.28:1 / on `#FAFAFA` = 3.14:1, < 4.5:1) | §3 신규 클래스 | `--fg3` → `--fg2` (7.81:1 PASS) |
| **MEDIUM** | `<span>(period)</span>`만으로 SR shortcut pronunciation 보장 X (`⌘⇧.`을 "command shift period"로 안 읽을 수 있음) | §3 안 ① JSX | macOS `<kbd>` `aria-label="Command Shift Period"` + `(period)` span `aria-hidden="true"` |
| **LOW** | "Start from your home folder" → 사용자가 home folder 자체를 선택하는 것으로 오인 가능 (Cell #2 SecurityError 분기 트리거 위험) | §3 안 ① 첫 문장 | "From your home folder, open `.claude/projects` or `.codex/sessions`. Reveal hidden folders with…" — 액션 대상 명시 |
| Q4 권장 | `~`과 "home folder" 한 번 연결 | §3 안 ① | "From your home folder (`~`)…" inline 연결 |

### Edit 1 v2 (`app/globals.css:2038-2046` kbd 블록) — **v1과 동일**

```css
.path-preview-hint kbd {
  font-family: var(--font-mono);
  font-size: 13px;
  padding: 2px 7px;
  background: var(--surface-muted);
  border: 1px solid var(--border);
  border-radius: 3px;
  color: var(--fg);
  letter-spacing: 0.5px;
}
```

> codex Q1 PASS — 13px ≡ row 사이즈 이슈 없음 (keycap 스타일 + actionable shortcut). Q5 PASS — `--fg`(`#0A0A0A`) on `--surface-muted`(`#FAFAFA`) = 18.97:1 (codex node 계산 검증).

### Edit 2 v2 (`app/globals.css` 신규 `.kbd-label`) — **color 변경**

```css
.path-preview-hint .kbd-label {
  font-family: var(--font-ui);
  font-size: 11px;
  color: var(--fg2);  /* v1: var(--fg3) — WCAG AA 미달 (3.28:1) / v2: var(--fg2) (7.81:1 PASS) */
  margin-left: 2px;
}
```

> codex Q5 mitigation. `--fg2`(`#525252`) on `--bg`(`#FFFFFF`) = 7.81:1, on `--surface-muted`(`#FAFAFA`) ≈ 7.5:1 (둘 다 4.5:1 초과). normal-text contrast 통과.

### Edit 3 v2 (`components/forms/JoinBurnIndexForm.tsx:422-424` JSX) — **a11y + copy revised**

```tsx
<p className="path-preview-hint">
  From your home folder (<code>~</code>), open <code>.claude/projects</code> or <code>.codex/sessions</code>. Reveal hidden folders with{" "}
  <kbd aria-label="Command Shift Period">⌘⇧.</kbd>
  <span className="kbd-label" aria-hidden="true">(period)</span> on macOS or{" "}
  <kbd aria-label="Control H">Ctrl+H</kbd> on Linux.
</p>
```

**변경 anchor**:
1. **MEDIUM mitigation #1** (SR pronunciation): `<kbd>` 양쪽에 `aria-label` 부여. `⌘⇧.` → "Command Shift Period", `Ctrl+H` → "Control H". `(period)` span에 `aria-hidden="true"`로 SR 중복 announcement 차단
2. **LOW mitigation** (home folder 선택 오인): "Start from your home folder" → "From your home folder (`~`), open `.claude/projects` or `.codex/sessions`. Reveal hidden folders with…" — owner 의도 명확화 (home에서 출발하되 home을 picker로 고르지 않음)
3. **Q4 연결**: `~` 토큰과 "home folder" 한 번에 묶음 (parenthetical) — Path Preview Card row의 `~` symbol과 hint의 "home folder" 의미 brige
4. `<code>` 태그 신규 사용: `.claude/projects` / `.codex/sessions` / `~` 모두 monospace inline path 표기. 기존 globals.css에 `code { font-family: var(--font-mono) }` 디폴트 스타일 적용 (별도 클래스 추가 불필요. 단 v2 검토에서 디폴트 contrast 확인 요청)

### Edit 4 v2 (선택, blind spot mitigation — `JoinBurnIndexForm.tsx:404-406`)

codex 추가 blind spot — Step 1 description "Pick the exact folder previewed below. Drill into hidden directories with the OS shortcut shown." → hint와 의미 중복. Edit 3 도입 후 hint가 단축키 안내를 흡수하므로 description에서 "Drill into hidden directories…" 절 제거 권장.

```tsx
{/* before */}
<p className="step-description">Pick the exact folder previewed below. Drill into hidden directories with the OS shortcut shown.</p>

{/* after */}
<p className="step-description">Pick the exact folder previewed below.</p>
```

> 본 Edit는 hint가 완전한 OS shortcut 안내를 제공한다는 전제 하에서만 적용. Edit 3 v2 미적용 시 Edit 4 v2 적용 금지.

### 토큰 사전 확인 (v2)

| 토큰 | 값 (globals.css L11-69) | 용도 | WCAG AA |
|------|------------------------|------|---------|
| `--font-ui` | Inter | `.kbd-label` font | — |
| `--font-mono` | JetBrains Mono | kbd + code font | — |
| `--fg` | `#0A0A0A` | kbd text color | 18.97:1 on `--surface-muted` ✅ |
| `--fg2` | `#525252` | `.kbd-label` text color (v2) | 7.81:1 on `--bg` ✅ |
| ~~`--fg3`~~ | ~~`#8E8E8E`~~ | ~~`.kbd-label` (v1)~~ | ~~3.28:1 ❌ 폐기~~ |
| `--surface-muted` | `#FAFAFA` | kbd background | — |
| `--border` | `#E5E7EB` | kbd border | — |
| `--bg` | `#FFFFFF` | body background | — |

raw hex 사용 0건 (Invariant #2 패턴 준수).

### v2 잔여 검증 질문 (3개)

#### Qv2-1. `<code>` 디폴트 스타일 contrast

`globals.css`에 `code` 디폴트 스타일이 정의되어 있는가? 정의되어 있다면 `--fg` / `--bg` contrast PASS인지 확인 요청. 미정의 시 브라우저 user-agent default(monospace, no background) 사용 — body의 `--fg` on `--bg` 18.97:1 inherit.

#### Qv2-2. `aria-label="Command Shift Period"` SR 발음 정확성

macOS VoiceOver / NVDA / JAWS가 "Command Shift Period"를 의도대로 읽는가? "Command" 대신 "Cmd"가 더 자연스럽지 않은가? `aria-label="Command Shift Period (period key)"` 같은 redundant clarification이 필요한가?

#### Qv2-3. Edit 4 도입 vs 유지

Edit 3에서 hint가 OS shortcut을 완전 흡수 시 step description의 "Drill into hidden directories…" 절 제거가 cognitive load 감소에 유리한가, 아니면 redundancy가 first-time 사용자에게 안전망이 되는가?

### v2 verdict 요청

1. **Verdict**: PASS / nit-only / needs-attention
2. **MEDIUM 결함 완전 해소** 여부 (contrast + SR pronunciation)
3. **LOW 결함 완전 해소** 여부 (home folder 오인)
4. **Edit 4 권장 여부** (Yes/No + 1줄 근거)
5. **Qv2-1~3 응답**

v2 nit-only / PASS → 7.5.2 (3 Edits 적용 + Edit 4 codex 권장 시 추가) 진입.
v2도 MEDIUM 잔존 → 재시도 한도(1회) 소진 → 본 Phase 7.5 보류 + Findings 2/3을 Phase 8 별 사이클로 이관 (plan 7.5 중단 조건).

---

## 7. Codex v2 verdict (2026-05-22, captured `/tmp/codex-phase7-v2.txt`)

**Verdict: nit-only** — 7.5.2 진입 게이트 PASS.

### v2 defect resolution
- **MEDIUM contrast 해소**: `.kbd-label` `color: var(--fg2)` → `#525252` on `#FFFFFF` = 7.81:1 / on `#FAFAFA` = 7.49:1 (둘 다 AA PASS, codex node 계산 검증)
- **MEDIUM SR pronunciation 정적 해소**: `<kbd aria-label="Command Shift Period">` + `<span aria-hidden="true">(period)</span>` 조합. 최종 발음은 owner 7.5.5 SR smoke로 확인 (런타임 영역으로 분리)
- **LOW home folder 오인 해소**: "From your home folder (`~`), open `.claude/projects` or `.codex/sessions`" — 출발 위치와 목표 폴더 분리됨

### Edit 4 v2 권장: **Yes**
Edit 3가 home 위치 + hidden folder shortcut 안내를 모두 흡수하므로 Step description의 "Drill into hidden directories…"는 중복. 제거로 cognitive load 감소. → **Edit 4 v2 적용 (7.5.2 포함)**

### Qv2 응답
- **Qv2-1** (`<code>` contrast): 전역 `code { … }` 디폴트 스타일 없음. `<code>`는 `.path-preview-hint`의 `color: var(--fg2)` 상속 → 7.81:1 PASS. typography 일관성 nit로 `.path-preview-hint code { font-family: var(--font-mono); color: inherit; }` 추가 권장 — **본 Patch v2에 nit 흡수**
- **Qv2-2** (SR 발음): `Command Shift Period` > `Cmd`. `Cmd`는 SR/locale 따라 축약어로 읽힐 위험. `(period key)` 같은 redundant clarification 불필요
- **Qv2-3** (Edit 4): cognitive load 감소에 유리 → 적용

### Code structure check
- 토큰 정의 정합 ✅ (`--fg`, `--fg2`, `--fg3`, `--surface-muted`, `--border`, `--font-ui`, `--font-mono` 모두 `globals.css` L11-90 존재)
- 마크업 위치 정합 ✅ (`JoinBurnIndexForm.tsx` L422-424 hint 교체 + L404-406 description 단축화)

### Codex v2 nit
- v2 설명에 "기존 globals.css에 code default style 적용" 표현이 실제와 불일치 (전역 `code` 스타일 없음). contrast 결함 아니라 merge blocker 아님. **본 verdict 섹션에서 정정**: `<code>`는 `.path-preview-hint`의 `--fg2` 상속으로 contrast PASS, 디폴트 스타일이 아닌 cascade에 의존

### v2 → 7.5.2 진입 결정
재시도 한도(1회) 사용 완료. v2 nit-only verdict + Edit 4 권장 + nit 흡수 → **7.5.2 진입 (Edit 1+2+3+4+nit 5종 적용)**.
