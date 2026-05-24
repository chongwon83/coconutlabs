# Session Handoff — Track 4 Visual Regression Baseline Lock

**작성일**: 2026-05-24
**작성 사유**: Track 4 cycle closure (S10 완료) → 다음 사이클 진입점 정리
**Trigger plan**: `~/.claude/plans/context-precious-flute.md` (Track 4 A~C, 3 viewport baseline lock)

---

## 0. 현재 상태 한줄 요약

**Track 4 cycle 종료 (S10 완료)**. working tree clean (untracked: `tasks/F1-nonce-atomic-del-backlog.md` + `.gstack/` + 직전 cycle handoff 2종 + 본 핸드오프). main branch `db7a0e7` pushed. CI 3 jobs (test 34s / visual 59s / e2e 86s) ✅. 신규 세션에서 별도 액션 **불필요** — 다음 사이클 진입 가능 상태.

---

## 1. 완료된 작업 (실행 결과)

### Step A — Playwright 설정 보강 + preflight invariant 8종

- `playwright.config.ts` use 블록 보강: `deviceScaleFactor=1`, `locale=en-US`, `timezoneId=UTC`, `colorScheme=light`, `reducedMotion=reduce`, chromium launch flags 3종 (`--font-render-hinting=none` 등)
- `expect.toHaveScreenshot` 기본값: `maxDiffPixelRatio: 0.02`, `threshold: 0.15`, `animations: disabled`, `caret: hide`, `scale: css`
- `e2e/preflight.spec.ts` 신규 (8 invariant): INV-1 DPR=1 / INV-2 FOFT-free / INV-3 priority/eager img complete / INV-4 storage 빈 상태 / INV-5a/5b hero-right display (mobile/desktop) / INV-6 antialiased / INV-7 (Codex) console.error+pageerror=0 / INV-8 (Codex) hero bbox stable across 2 rAF
- **Codex A-0 consultation**: macOS 10x dry-run 0 flake 권장 + 2 invariant 추가 (INV-7, INV-8)
- 10x dry-run flake 0건 통과

### Step B — Hero/Nav data-testid 18개 attachment

- `components/Hero.tsx` 11개 testid + `data-mask="dynamic"` 2개 (secondary-card / product-shot-content)
- `components/Nav.tsx` 7개 testid (nav-root / nav-inner / nav-logo / nav-links / nav-link / nav-cta / nav-cta-primary)
- 기존 className 100% 보존 (hero-fold.spec.ts 9 selector 회귀 0)
- claude-in-chrome F4 검증: 18개 testid 모두 DOM 도달 확인
- **Codex B-3 consultation**: secondary-card/product-shot 반복 컴포넌트 testid 중복 위험 평가 → `data-mask`만 부착하고 testid는 single instance만

### Step C — visual.spec.ts + CI Linux baseline lock

- `e2e/visual.spec.ts` 신규 (3 viewport: mobile-375 / desktop-921 / desktop-1280)
- `playwright.config.visual.ts` 분리 (default config은 default snapshot path 유지, visual config만 PNG snapshot 활성화 → `*-chromium-linux.png` 형식)
- `.github/workflows/visual-baseline-lock.yml` workflow_dispatch — **영구 보존** (1회용 아닌 rebaseline 인프라)
- baseline PNG 3개 commit (CI Linux artifact, 로컬 macOS PNG 금지 정책 준수)
- **Codex C-0 consultation (적대적)**: clip mode + sticky-header height 가정 + mask 영역 + 6주 false-positive source 5종 + owner 8항목 검수 체크리스트

### 안 commit refs

- `ff34678` — Track 4 baseline lock (3 PNG + visual.spec.ts + playwright.config.visual.ts + visual-baseline-lock.yml)
- `df380f4` — INV-2 fix (next/font Fallback FontFace `error` exempt)
- `db7a0e7` — S10 retro entry (decision-log.md only, workflow-state.md gitignored local-only)

### S10 회고

- `docs/decision/decision-log.md` 5줄 S0 + S10 회고 2항목 entry (committed in `db7a0e7`)
- `docs/workflow-state.md` (gitignored, solo 정책)

### Cross-conversation memory 2종 (영구 보존)

- `feedback_preflight-linux-smoke-required.md` — Playwright preflight invariant 신규 추가 시 Linux runner smoke 의무
- `project_track4-visual-baseline-2026-05-24.md` — rebaseline procedure + maxDiffPixelRatio 강화 timing

---

## 2. 핵심 함정 — INV-2 next/font Fallback FontFace (별 cycle 참조용)

**증상**: macOS 10x dry-run 0 flake 통과 후 commit/push → CI Linux e2e job 첫 실행에서 INV-2 즉시 실패.

**원인**: next/font가 `<Family> Fallback` FontFace (예: `Inter Fallback`, `JetBrains Mono Fallback`)를 metric matching 용도로 등록하면서 `src` descriptor를 안 붙임. 로컬 macOS에서는 status=`unloaded` 또는 일부 `loaded`로 나오지만 CI Linux에서는 `error`로 결정성 보고. **이건 정상** — 화면에 안 그려지고 baseline 손상 없음.

**Fix (commit df380f4)**:

```typescript
// e2e/preflight.spec.ts:86-94
const inFlight = fontStatuses.filter(
  (f) =>
    f.status === "loading" ||
    (f.status === "error" && !/ Fallback$/.test(f.family))
);
```

**가장 큰 교훈**: macOS dry-run 횟수가 아니라 환경 매트릭스가 답. Playwright preflight invariant 신규 추가 시 다음 중 1개 의무:
1. `act` 로컬 GitHub Actions runner로 Linux 환경 1회 smoke 실행
2. 임시 CI workflow_dispatch 트리거로 Linux runner에서 1회 smoke

특히 다음 영역은 macOS/Linux 차이 큼 → Linux smoke 의무:
- `document.fonts` API 상태 (`loading`/`loaded`/`error`/`unloaded`)
- `getComputedStyle` font 관련 속성 (`-webkit-font-smoothing` 등)
- canvas/raster 비교 (visual baseline)
- `Intl` locale 출력 형식

→ memory: `feedback_preflight-linux-smoke-required.md`
→ TIL: `~/Documents/DevVault/4-TIL/2026-05-24-nextfont-fallback-fontface-ci-linux-error.md`

---

## 3. git 상태 (스냅샷)

```
db7a0e7  docs(decision): S10 retro for Track 4 — Playwright visual regression baseline lock  ← HEAD
df380f4  fix(test): exempt next/font Fallback FontFace from INV-2 error check
ff34678  feat(test): Track 4 — Playwright visual regression baseline lock
```

- working tree: clean
- untracked (intentional, no commit):
  - `tasks/F1-nonce-atomic-del-backlog.md` — 별 cycle 진입용 (직전 cycle 잔여)
  - `tasks/folder-picker-ux-finding1/SESSION_HANDOFF.md` — 직전 cycle handoff
  - `tasks/token-path-real-verify/SESSION_HANDOFF.md` — 직전 cycle handoff
  - `tasks/track4-visual-baseline/SESSION_HANDOFF.md` — 본 핸드오프 (방금 작성)
  - `.gstack/` — security reports (gitignored)
- Vercel: 본 cycle은 test/CI 인프라만 추가 → production deploy 트리거 없음

---

## 4. 다음 세션 진입 시 액션 항목

### 즉시 필요한 액션
**없음**. 본 사이클은 closure 완료.

### Rebaseline 절차 (의도된 layout/font 변경 시)

```bash
gh workflow run visual-baseline-lock.yml -f reason="<이유>"
# 완료 후
gh run download <run-id> -n visual-baseline -D /tmp/visual-baseline
cp /tmp/visual-baseline/*.png e2e/visual.spec.ts-snapshots/
git add e2e/visual.spec.ts-snapshots/
git commit -m "chore(visual): rebase baseline — <이유>"
git push origin main
```

⚠️ **로컬 macOS PNG commit 절대 금지** — first-green-baseline 안티패턴.

### 다음 사이클 후보 (참조 — 명시 채택 시에만)

1. **F1 nonce atomicity fix 별 cycle** (`tasks/F1-nonce-atomic-del-backlog.md` Option A — DEL-first reply-count + case 11 concurrent test)
2. **Follow-up #2** (`tasks/hygiene-and-e2e/unverified.md`) — CI retry policy 미해결
3. **auto-detect 전체 활성화 절차** (memory `project_auto-detect-flip-procedure.md`) — Axis 1 ≥ 15 후 Vercel env `NEXT_PUBLIC_AUTO_DETECT_DEFAULT=true` + Redeploy
4. **maxDiffPixelRatio 0.02 → 0.01 강화** (6주 운영 후 timing 결정):
   ```bash
   gh run list --workflow=CI --jq '[.[]|select(.conclusion=="failure" and (.path|test("visual")))] | length'
   ```
   false-positive 5건 이하면 0.01로 강화, 10건+이면 0.02 유지 + 원인 분석.

### 보류 항목

- **Pre-S0 vault note logging (notes-used.txt) 운영 절차 강제**: 보류. Phase 3 SessionStart hook 자동화 도입 시점에 함께 처리 (룰만 추가하면 자기준수 부담만 증가)
- **`/codex --full --o-mini` flag**: gstack default gpt-5.5만 사용 (memory `feedback_codex-cli-gpt5-codex-unavailable` 준수)

---

## 5. 강한 증거 (decision-log 회고 줄)

본 cycle은 다음 패턴을 검증함:

- **3-step 분리 + Codex 3회 (A-0/B-3/C-0)**: 각 step 진입 전 적대적 검토로 함정 (FOFT vs Fallback FontFace, sticky-header height 가정, mask 영역) 사전 차단
- **`playwright.config.visual.ts` 분리**: 다른 e2e job (test/e2e)에 visual snapshot path 오염 방지 + 향후 visual-only flag 운영 분리 용이
- **`workflow-dispatch visual-baseline-lock.yml` 영구 보존**: 1회용 CI step이 아닌 영구 인프라로 두면 6개월 후 rebaseline 시 owner가 "이거 어떻게 했지" 헤맬 일 없음
- **macOS dry-run의 결정적 한계**: 10회 0 flake도 CI Linux 환경 차이 1건 못 잡음 → "확률성 flake가 아닌 결정성 환경 차이"라는 멘탈모델 명시화

---

## 6. 참조

- Track 4 plan: `~/.claude/plans/context-precious-flute.md` (Step A~C)
- decision-log entry: `docs/decision/decision-log.md` 2026-05-24 [Track 4…]
- Visual baseline PNG: `e2e/visual.spec.ts-snapshots/*-chromium-linux.png` (3개)
- Rebaseline workflow: `.github/workflows/visual-baseline-lock.yml`
- Preflight spec: `e2e/preflight.spec.ts` (8 invariant)
- Visual spec: `e2e/visual.spec.ts` (3 viewport)
- Visual config: `playwright.config.visual.ts`
- TIL: `~/Documents/DevVault/4-TIL/2026-05-24-nextfont-fallback-fontface-ci-linux-error.md`
- Memory: `[[feedback_preflight-linux-smoke-required]]`, `[[project_track4-visual-baseline-2026-05-24]]`
- CI evidence: GitHub Actions run `26347081198` (test 34s / visual 59s / e2e 86s)
