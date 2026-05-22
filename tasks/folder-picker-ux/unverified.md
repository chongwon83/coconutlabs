# Unverified Items & Known Limitations — Folder Picker UX

**Date**: 2026-05-22 (Phase 7.5.6 closure)

## Planner Contract/Criteria Spot Check

Planner spot check: contract/criteria 섹션에 코드 스니펫·diff·라인 단위 지시 ✅ 없음 (본 plan은 scope / phase 분해 / criteria만 기술, S2 pickFolder 재작성 의도는 "어떻게"가 아닌 "무엇을·어떤 분기 기준으로"로만 기술). v2 delta §I 동일 확인.

## Design Phase 3 결과 (2026-05-21)

- **Verdict**: **PASS — HIGH/MEDIUM 결함 0건** (Claude self-audit, owner 권한 위임 모드)
- **5축 + v2 추가 1축** 모두 통과 — A 시각 hierarchy / B Mono↔Inter / C token reuse / D WCAG AA / E microcopy / F fsaError↔fsaWarning
- **NIT 3건** (Phase 5 구현 시 반영, 블로킹 아님):
  1. `.path-preview-card` border → `var(--border)` 사용 (globals.css 패턴 일관)
  2. DESIGN.md `## Components` 섹션 추가 → **보류** (현 DESIGN.md scope는 leaderboard tier 한정, forms 추가는 scope 확장. diff.md `DESIGN.md ~+10/-0 (조건부)` → **skip**)
  3. `.form-warning` 시각 표현 → bg tint (`--young-coconut-soft`) 단독 사용 (border는 `.form-error`와 weight 유사, bg tint가 non-fatal 의미 더 부드러움)
- **Phase 5 진입 가능**: ✅

## Codex Phase 1 결과 (2026-05-21)

- **Verdict**: `needs-attention` → **PARTIAL** 판정
- **In-scope MEDIUM #3 (IDB persistence failure → hard blocker)**: Plan v2 delta §B에서 mitigation 반영 — picker / name check / handle state set / IDB save 4단계 분리. `fsaWarning` 신규 channel 도입. Must-pass #7 + Invariant #5 추가. 본 사이클 Phase 5 구현 의무.
- **Out-of-scope critical #1 (PyPI recovery codes 평문 노출)**: 본 plan 범위 밖 — owner 즉시 처리 필요 (재발급 + 파일 삭제 + `credentials/` `.gitignore` + git history 검증). 본 plan 진행 차단 아님
- **Out-of-scope high #2 (e2e onboarding test 비-hermetic, 실 backend 오염 가능)**: 별 사이클 — token/burnindex mock + test Redis namespace. 본 plan 진행 차단 아님

## Phase 6 Cell #2 실측 + Contingency Patch v2 (2026-05-22)

- **Cell #2 owner 실측 결과**: `e.name="AbortError"` (code 20), UI 빨간 메시지 무노출. Codex Phase 6 CONCERN MEDIUM 적중. Chrome은 홈 디렉터리 거절을 AbortError로 dispatch (SecurityError 아님).
- **Plan v3 §Contingency Patch (timing-based 1500ms) 폐기**: 실제 picker UX 호출당 10-15초 소요 → 1500ms 내 2회 발생 불가능. self-correction 후 count-based로 pivot.
- **Contingency Patch v2 (count-based) 적용**: `JoinBurnIndexForm.tsx:99 + 126-134` — `abortCountRef = useRef<number>(0)`. 1회 AbortError silent (UX exploration), 2회 누적 시 `fsaWarning` (yellow, non-fatal) 노출. Invariant #4 (e.name only) 유지. **검증 4종 PASS**: tsc / vitest 234 / build / secret leak 0.
- **잔여**: owner Cell #2 재실측 (1차 silent + 2차 fsaWarning 노출 확인). dev 서버 HMR 적용된 상태에서 localhost:3000/?auto-detect=1 reload 후 진행.
- **fsaWarning 텍스트 카피 검증**: "Trouble picking the folder? Chrome blocks system folders…" — owner 실측 시 카피 적절성 (red error 대비 부드러움 vs 명확성) 확인 의무.

## Phase 7.5.6 Closure (2026-05-22)

- **Trigger**: Phase 7.5 deploy 후 owner 추가 발화 "사이즈는 좀 키워야겠음. 좀 더 키워줘" — kbd 13px 여전히 작아 보임. font-size 1단계 추가 bump.
- **Patch**: `app/globals.css` `.path-preview-hint kbd` font-size 13→15px / padding 2px 7px → 2px 8px / line-height 1.4 신규. 색상·letter-spacing·token 무변.
- **검증**: `npx tsc --noEmit` ✅ / `npx vitest run` 234/234 ✅ / `npm run build` ✅ / `grep -c COLLECTOR_HMAC_SECRET .next/static/chunks/*.js` = 0 ✅. WCAG AA contrast 재계산 PASS (font-size 변동은 ratio 무관 — 15px kbd `#0A0A0A` on `#FAFAFA` = 18.97:1, `.kbd-label` `#525252` on `#FFFFFF` = 7.81:1, 둘 다 ≥ 4.5:1).
- **Deploy**: Vercel commit `40cd00c` auto-deploy 완료.
- **Owner Happy Path Gate**: Phase 7.5.6 (40cd00c) 2026-05-22 owner-direct production check ✅ + mcp computed style verify ✅ (font-size 15px / padding 2px 8px / line-height 21px) + owner 발화 "사이즈 괜찮음". `smoke-golden-regression.md` Phase 7.5 row owner-direct 손글씨 기록 완료. 잔여 미검증 unchanged (Brave/Vivaldi, telemetry counter, parent-path validation Q3).

## 잔여 미검증 (Phase 5 이후 갱신)

### Brave / Vivaldi / Arc 등 Chromium 파생 브라우저 미테스트 (Codex Q1)

DOMException `name` 일관성을 Chrome 86+/Edge 86+ 외에서 미확인. 본 작업은 Chrome/Edge 사용자 기준 — 파생 브라우저에서 다른 `error.name` 반환 시 fallback ("Couldn't open the folder picker. Try a different browser…") 메시지로 흡수 예상.

**Acceptance**: Codex Phase 1 응답에서 cross-browser 명시적 결함 지적 없음 (Finding #3은 IDB persistence 별 이슈) → 통과. owner 1주 운영 모니터링 후 별도 사이클.

### macOS `⌘⇧.` glyph 폰트 fallback (Codex Q2)

~~Path Preview Card hint에 `⌘⇧·` 사용~~. Windows 기본 폰트가 U+2318/U+21E7 결손 시 tofu(`□`) 노출 가능. fallback ASCII 표기 추가는 Phase 1 Codex 결함 시점에 결정.

**2026-05-22 Cell #3 owner 실측 발견**: Plan §S1 + 구현은 `⌘⇧·` (U+00B7 MIDDLE DOT) 사용. 이는 **macOS 실제 단축키 `⌘⇧.` (U+002E PERIOD)과 다른 문자** — Codex Phase 1 Q2 검토 시 문자 식별까지 명시했으나 typo 그대로 통과. owner Cell #3 시도 시 "search로 안 잡혀" 보고로 발견. **1자 fix 적용** `JoinBurnIndexForm.tsx:423`: `·` → `.`. 검증 4종 PASS (tsc / vitest 234/234 / build / secret leak 0). Cell #1 PASS는 시각 노출 기준이므로 retroactive 영향 없음. 잔여 Windows/Linux tofu 검증은 별 사이클.

### Client-side telemetry (cancel / mismatch ratio)

cancel / mismatch 횟수 카운터 미도입. 본 사이클 non-scope. 별도 사이클에서 axis3 또는 ux-instrumentation으로 도입 검토.

### OS detection 로직

본 작업은 macOS + Linux 두 hint 동시 노출. Linux 사용자가 macOS hint를 보는 cognitive cost vs OS detection 코드 분기 비용 → 후자 더 큼 판단. 1주 운영 후 user feedback 검토.

## Known Limitations (Won't Fix This Cycle)

### Safari / Firefox FSA 미지원

`showDirectoryPicker` Safari/Firefox 미지원. 현재 `autoDetect` 분기 (line 67-73)가 `"showDirectoryPicker" in window` 체크로 fallback "Join Burn Index" 수동 폼 노출 — 본 작업은 Chrome/Edge 사용자 UX만 다룸.

### Path Preview Card 다국어화

UI 영어 유지 결정. 한국어 owner 유저는 영어 microcopy 그대로 학습 비용 감수. i18n은 별 사이클.
