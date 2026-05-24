# Burn Index Copy Honesty Sweep (Hybrid Honesty Cycle)

## Context

직전 burn-filter-removal 사이클(PR #18 `c267103`) 직후 owner가 5개 문구
("Ranked by VES…", "30-day window. Source-verified costs…", "VES = verified
fixes ÷ AI cost (USD)…", "Manual entry1", "Submitted by the builder…")의
일관성 점검을 요청. `/codex:rescue` + `/codex:adversarial-review` 병렬
디스패치 결과를 종합한 owner 결정: **Option C 하이브리드 정직** —
copy sweep + "Source-verified" overpromise 정직 보정 + 데모 시드 명시 +
Footer "Verification levels" → "Evidence levels" 리네임.

진단 근본 원인 (사이클 진입 전 합의):

1. **Triple-layer label inconsistency** — TIER_META 3-tier (Source-verified/
   Estimated/Manual entry) vs VERIF_DISPLAY 4-level (API-verified/CLI-verified/
   Token-only estimate/Manual entry) vs verifTierShort 3-chip (verified/
   estimated/manual). 동일 데이터에 3개 어휘.
2. **Source-verified overpromise** — methodology caption이 "Source-verified
   costs rank above estimates"라고 약속하지만 CLI 업로더(`lib/client/burn/
   collect.ts:230-239`)는 `costBasis:"estimated"` 하드코딩 → 실제 import는
   영구히 Estimated. Provider-synced/Self-reported는 demo 시드만 보유 (V3
   @sora 등).
3. **"Manual entry1" visual artifact** — `.lb-tier-label` + `.lb-tier-count`
   adjacent at 8px gap, 동일 color `var(--fg2)`, count badge bg
   `var(--surface-muted)` (#FAFAFA)가 tier-head bg `#FFFFFF`과 1.04:1
   contrast → pill 시각적으로 invisible → 사용자가 "Manual entry 1"을
   "Manual entry1"로 읽음.

## Preservation Contract (READ-ONLY)

0줄 수정. Storage 영속 계약 + V3 seed + wire/display split 아키텍처.

| 파일/심볼 | 보존 이유 |
|----------|----------|
| `lib/validateSummary.ts:52` (VerifLevel 4-union literals) | Redis/localStorage 영속 계약 |
| `lib/data.ts` V3_BUILDERS `verif` 필드 (seed) | 메서드러지 데모 데이터 |
| `lib/data.ts` `VERIF_DISPLAY` mapper + `verifDisplayLabel()` | wire/display split 핵심 |
| `lib/client/burn/collect.ts:230-239` CLI 업로더 하드코딩 | 별도 사이클 (out of scope) |
| BurnIndexSection.tsx `TIER_META.verified.label` ("Source-verified") | TIER 그룹 label은 시드 분포(Provider+Device 통합) 기반, caption만 honesty 보강 |

## Critical Files (MODIFY)

| 파일 | 변경 |
|------|------|
| `components/BurnIndexSection.tsx` | (1) L34-37 TIER_META.selfrep caption → demo seed 명시 (2) L103-105 section sub copy 정리 (3) L107-110 methodology caption → CLI source-tokens + estimated cost 정직 (4) L224-229 section note "Trust order" → "Evidence order" |
| `components/Footer.tsx` | L34 "Verification levels" → "Evidence levels" |
| `app/globals.css` | `.lb-tier-count` 1px border 추가 → pill 시각적 분리 ("Manual entry1" fix) |
| `DESIGN.md` | L110-119 prose 정합 (Trust order → Evidence order 표현 동기화, demo seed 캡션 변경 반영) |
| `docs/decision/decision-log.md` | S0 + S10 entry |

## Out of Scope

- CLI 업로더 pipeline 수정 (Provider-synced/Self-reported 실제 산출 능력 추가) — 별도 사이클
- VerifLevel 4-union literal 변경 (storage contract)
- V3 시드 데이터 재배포
- Hero.tsx L54 `# VES = verified fixes / AI cost USD` 주석 (formula 자체는 유효)
- Ticker.tsx fictional 데모 행 (`API-verified`/`CLI-verified` flavor copy 유지 — 데모 ticker 맥락에서 가독성)
- `.lb-tier-label`/`.lb-tier-count` font-size/spacing 재설계 (CSS contrast 1px border로 충분)

## Concrete Wording (Before → After)

### 1. TIER_META.selfrep caption (L34-37)
```
Before: "Submitted by the builder, not yet confirmed."
After:  "Methodology demo. Manual entry isn't shipped — these are seed rows showing how the tier renders."
```

### 2. section sub (L103-105)
```
Before: "Ranked by VES — Verified Efficiency Score (verified fixes ÷ AI cost USD). Lower spend, more fixes = higher rank."
After:  "Ranked by VES — verified fixes divided by AI spend in USD. Lower spend, more fixes = higher rank."
```
(반복되는 "Verified Efficiency Score" expansion 제거. 공식은 section-note에 유지.)

### 3. methodology caption (L107-110)
```
Before: "30-day window. Source-verified costs rank above estimates and manual entries at the same VES."
After:  "30-day window. Today every real import is token-collected with estimated cost; ties break by upload recency."
```
(Source-verified rank-above 주장 제거. 실제 파이프라인 상태(token+estimated)
명시 + 동점 처리 규칙 분명화.)

### 4. section note (L224-229)
```
Before: "VES = verified fixes ÷ AI cost (USD). Higher is better. Trust order: {Provider-synced} > {Device-synced} > {Estimated} > {Self-reported}."
After:  "VES = verified fixes ÷ AI cost (USD). Higher is better. Evidence order: {Provider-synced} > {Device-synced} > {Estimated} > {Self-reported}."
```
("Trust"는 사람을 평가하는 말. "Evidence"는 데이터를 평가하는 말 —
Footer rename과 일관.)

### 5. Footer L34
```
Before: "Verification levels: API-verified · CLI-verified · Token-only estimate · Manual entry"
After:  "Evidence levels: API-verified · CLI-verified · Token-only estimate · Manual entry"
```

### 6. .lb-tier-count CSS ("Manual entry1" fix)
```css
.lb-tier-count {
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--fg2);
  background: var(--surface-muted);
+ border: 1px solid var(--border);   /* +1 line: explicit pill edge */
  border-radius: var(--r-badge);
  padding: 1px 7px;
}
```
(`--border` `#E5E7EB`가 `#FFFFFF` 헤드 bg 위에 1.62:1 contrast — pill
edge 시각적으로 분명. font/spacing 무변경 → visual baseline diff 최소.)

## Risk 3-axis

| 축 | 평가 | 충족 |
|----|------|------|
| ① 실패비용 | UI copy + 1px border 추가. revert git revert 1회. < 30분 | 미충족 |
| ② 영향범위 | 4 files UI-only. storage·API·deploy 영향 0. | 미충족 (fuzzy borderline) |
| ③ 관찰가능성 | visual baseline + DESIGN.md lint가 sweep. silent failure 가능성 매우 낮음. | 미충족 |

**판정**: 0/3 → Fast-Path 라이트. /codex 의무 미발동.
**참고**: 의사결정 단계(option C 선정)에서 rescue + adversarial 1회씩
완료 — 본 사이클 구현 단계 추가 codex 호출 면제.

## Invariants

1. **VerifLevel union 보존**: `lib/validateSummary.ts:52` 0줄 수정
2. **VERIF_DISPLAY mapper 보존**: section note는 `verifDisplayLabel()` 호출 그대로 — "Trust order" → "Evidence order" 6자 변경만
3. **TIER_META.label 보존**: "Source-verified"/"Estimated"/"Manual entry" 라벨 동일. caption만 수정
4. **3-tier grouping 보존**: `TIER_ORDER`/`groupByTier()`/`verifTier()` 0줄 수정
5. **DESIGN.md token 정합**: `npx @google/design.md lint DESIGN.md` error 0
6. **Visual baseline diff**: CSS 변경 1줄(border 추가)만 → label/count text 위치 1px shift 가능 → CI Linux 재캡처 필요
7. **Cross-reference 0건**: `.lb-tier-count` 외부 사용처 없음 (grep 검증 완료)
8. **Wire literal grep**: `Provider-synced`/`Device-synced`/`Estimated`/`Self-reported` 4종 grep — section note 외 사용처 무변경

## Implementation Order

1. AGENTS.md gate: Next.js 16.2.6 useState client component 패턴 무변경 (이번 사이클 useState 추가/제거 0건)
2. ✅ S5 worktree: `coconut-burn-copy-honesty` 브랜치 생성 (main에서 fork)
3. `components/BurnIndexSection.tsx` 4개 edit 적용
4. `components/Footer.tsx` 1개 edit 적용
5. `app/globals.css` 1px border 추가
6. `DESIGN.md` prose 보강 (Trust→Evidence 용어 동기화 + demo seed 캡션 반영)
7. DESIGN.md lint: `npx @google/design.md lint DESIGN.md` error 0
8. Typecheck: `cd web && npx tsc --noEmit` → 0 errors
9. Unit/Integration: `cd web && npx vitest run` → green
10. E2E (간단): `cd web && npx playwright test e2e/onboarding-30s.spec.ts` → green
11. Visual local dry-run: diff 발생 예상 (border 1px 추가) → CI rebaseline 트리거
12. S8 review: 0/3 axis Fast-Path. codex 면제 (의사결정 단계 완료)
13. CI Linux visual rebaseline: workflow_dispatch 3 PNG
14. PR + `gh api -X PUT /merge` (worktree-safe 패턴)
15. S10 retro: decision-log 2줄 + workflow-state.md 업데이트

## Verification Gates

| Gate | 명령 | 통과 기준 |
|------|------|----------|
| AGENTS.md | 수동 확인 | useState 패턴 무변경 |
| DESIGN.md lint | `npx @google/design.md lint DESIGN.md` | error 0 |
| Typecheck | `cd web && npx tsc --noEmit` | 0 errors |
| Unit tests | `cd web && npx vitest run` | 모든 burn 테스트 green |
| E2E onboarding | `cd web && npx playwright test e2e/onboarding-30s.spec.ts` | green |
| Visual (CI rebaseline) | GH Actions workflow_dispatch | 3 Linux PNG 업데이트 |
| Grep 잔재 ("Source-verified costs rank") | `grep -rn "Source-verified costs rank" web/` | 0 hits |
| Grep 잔재 ("Trust order") | `grep -rn "Trust order" web/` | 0 hits |
| Grep 잔재 ("Verification levels") | `grep -rn "Verification levels" web/` | 0 hits |
| Manual smoke | `pnpm dev` → `/` 페이지 | 5개 문구 갱신 확인 + count pill 시각 분리 |

## Effort Estimate

- BurnIndexSection.tsx 4 edits: ~10 min
- Footer.tsx + globals.css: ~5 min
- DESIGN.md prose: ~10 min
- DESIGN.md lint + typecheck + tests: ~10 min
- Visual local dry-run + CI rebaseline: ~15 min
- PR + merge + S10 retro: ~10 min
- **Total**: ~1시간 (Fast-Path 라이트)

## Risk Register

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| 1 | DESIGN.md prose 수정이 google-labs lint에 broken-ref 유발 | Low | Step 7 lint 검증. prose 변경만 (token reference 무변경) |
| 2 | Visual baseline diff > 0.02 maxDiffPixelRatio | Mid | CSS 1줄(border 1px) + 텍스트 5건 — pixel shift 예상 범위 내. CI rebaseline 1 PR |
| 3 | "Methodology demo" 캡션이 사용자에게 "이 제품 미완성" 신호로 강하게 작동 | Low | 의도된 정직 — 마케팅 선반보다 신뢰 우선 (owner 선택 Option C) |
| 4 | Evidence vs Trust 용어 변경이 Trust 영역(footer-col-head "Trust" / `.burn-trust` 섹션)과 의미 충돌 | Low | Trust 섹션은 collection spec 관련 (개인정보·보안). Evidence는 측정 confidence. 다른 도메인 — 충돌 없음. |
| 5 | "Manual entry1" CSS fix가 다른 tier 헤더 시각 균형 깨뜨림 | Low | 3-tier 모두 동일 `.lb-tier-count` 사용 → 모두 동일하게 pill edge 보강 (의도된 일관성) |

## State Transitions

- 현재: S3 plan 완료 (이 문서)
- 다음: S6 implement → typecheck/test → visual rebaseline → PR merge → S10
- workflow-state.md 갱신: 각 단계 완료 시
