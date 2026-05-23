# Above-Fold 3 Elements — 정의 Lock (2026-05-23)

## 정의

Mobile 375x667 viewport 기준, 페이지 로드 직후 사용자에게 보여야 할 핵심 3 요소.

owner option (a) — `headline + sub + primary CTA`. SaaS 랜딩 전형 우선순위 (message → value-prop → conversion 3단계 완결).

1. **Element 1 — Hero Headline (H1)**
   - 위치: `components/Hero.tsx` L110-113
   - 텍스트: `Burn Index puts a number on your drag.`
   - CSS: `.hero-headline` (`app/globals.css` 검색 필요)
   - 픽셀 높이: **120px** (rect.top=440, bottom=560 — Playwright 375x667, fonts.ready, 2026-05-23 측정)

2. **Element 2 — Hero Sub-copy**
   - 위치: `components/Hero.tsx` L114-118
   - 텍스트 (production, SHOW_LEGACY=false): `Get your burn score. See where you rank against verified solo devs.`
   - CSS: `.hero-sub`
   - 픽셀 높이: **51.19px** (rect.top=580, bottom=631.19 — Playwright 측정)

3. **Element 3 — Primary CTA Button**
   - 위치: `components/Hero.tsx` L125-128
   - 라벨: `Join Burn Index`
   - 컴포넌트: `<Button variant="primary" size="lg">` (`@/components/primitives`)
   - 픽셀 높이: **38px** (rect.top=729.19, **bottom=767.19** — Playwright 측정)

## 합산 fold budget

- viewport 가용 높이 (실측): `667 - 57 (nav.nav-v3) - 79 (StatusBar) = 531px`
  - **정의 lock 시 가정 (`611px = 667 - 56`)은 StatusBar 79px 누락으로 -80px 오류**
  - codex Track 1 적대적 검토에서 사전 지적 (4 blind spots 중 #2 채택)
- 3 elements 합산: `120 + 51.19 + 38 = 209.19px` (간격 제외)
- 3 elements bottom-most: **767.19px (CTA bottom) > 667 viewport** → **viewport 밖**
- 합산 자체는 budget 통과(209<<531)지만 **vertical 배치 누적**(eyebrow + ProductShot + margins)으로 CTA가 fold 밖

## Gate 판정 (2026-05-23 Track 1 실측)

- `sum_3_elements_height ≤ 611`: ✅ (209.19)
- `cta_bottom ≤ 667 (naive viewport)`: ❌ (767.19, -100.19 초과)
- `cta_bottom ≤ 531 (adjusted_fold)`: ❌ (767.19, -236.19 초과)
- `no 4th element invasion (rect.top < 667)`: ❌ (ProductShot top=184, eyebrow top=391.5)
- **Verdict**: `GATE_B_OVERFLOW` (Track 2 진입 의무)
- 측정 산출물: `/tmp/fold-measurements.json`, `/tmp/fold-375.png`

## Out of fold (의도적 배치)

다음 요소는 fold **밖**에 배치 허용 — 스크롤 후 노출:

- `hero-eyebrow` (L106-109) — context label, 약화 가능 ⚠️ **실측 top=391.5 (fold 내부 침범)**
- `hero-chips` (L119-124) — Claude Code/Codex/Cursor/+more 지원 툴 표시
- `HeroSecondaryCard` (L135) — Top VES/Week fixes/AI spend 지표 카드
- `hero-right` (L138-153) — ProductShot
  - ⚠️ **`app/globals.css` L2080 `@media (max-width: 920px) { .hero-right { order: -1 } }` 적용 — mobile에서 stack 상단(top=184)으로 이동**
  - 정의 lock 시 "mobile에서 stack 하단으로 이동" 가정 **오류** (codex Track 1 blind spot #1)

## Non-goals

- 4번째 요소 (product-shot, secondary card 등)는 fold 밖 허용
- 가로 scroll 발생 시 즉시 fix (별도 사이클)
- Desktop ≥768px viewport의 fold 정의는 별도 (mobile 우선 lock)
- SHOW_LEGACY=true 경로의 sub-copy 변형은 본 lock 대상 아님 (production 기준)

## Invariant

본 lock 적용 후 다음 위반 시 즉시 alert:

- mobile 375x667에서 fold 진입 element 수 < 3 (요소 누락)
- mobile 375x667에서 fold 진입 element 수 > 3 (다른 요소가 위로 침범)
- 합산 높이 > 611px (overflow → fold cut)

## 적용 시점

본 정의 lock 후 **차기 사이클**에서 Hero.tsx + `app/globals.css` `.hero-v3 padding` 조정.

조정 결과는 본 artifact의 "합산 fold budget" 기준 통과로 검증.

## Track 1 미실측 사유 (handoff)

본 사이클 진입 시 dev server 기동 실패 — `web-landing-mvp-4/node_modules`가 sister `web/` 디렉토리로의 symlink이라 Turbopack이 `Symlink invalid` 거부 (FATAL).

차기 사이클 첫 작업: dev server 환경 정상화 (symlink 제거 + 로컬 `npm install` 또는 next.config 우회) → Track 1 viewport 실측 → 본 artifact 픽셀 높이 3개 채움.

## Self-Review (미해결 위험 명시)

본 사이클 codex 적대적 검토는 silent hang으로 미수행. owner 검토용 미해결 위험 3개:

1. **Lock 강도**: 픽셀 높이 모두 미측정 → 본 문서는 "element 선택의 의도 lock"이지 "spatial lock"이 아님. 차기 사이클 실측 후 4번째 요소 침범 또는 합산 overflow 발견 시 element 재선정 trigger 가능 (lock 깨질 수 있음).
2. **Out-of-fold 가정 검증 부재**: eyebrow/chips/HeroSecondaryCard는 현재 desktop·mobile 동일 stack. mobile 375x667에서 실제 fold 진입 여부 미확인. dev server 복구 후 첫 실측에서 4+ element가 fold 진입할 가능성 존재. 발생 시 fold cut을 element 우선순위 재조정으로 처리할지(option a) Hero padding/spacing 압축으로 처리할지(option b) 차기 사이클 owner 재결정 필요.
3. **Invariant 자동화 부재**: 본 artifact의 invariant 3개는 owner 수동 점검 의존. screenshot diff CI 도입 전까지 drift 위험 (예: 후속 commit으로 4번째 element 추가 시 본 lock 위반 감지 불가). 차기 사이클 검증 phase 진입 시 자동화 layer 결정 의무 (screenshot diff vs Playwright e2e vs 수동 gate).

## Track 1 실측 후 추가 (2026-05-23)

위 1·2 risk **모두 실재**로 확인. 측정 결과:

- **Risk 1 (Lock 강도)**: `611px` budget 가정이 StatusBar(79px) 누락으로 -80px 오차. 실제 가용 fold는 **531px**. budget 자체를 보정해야 lock 유효.
- **Risk 2 (Out-of-fold 가정)**: `.hero-right` mobile에서 `order: -1`로 상단 이동 — "stack 하단으로 이동" 가정 오류. ProductShot이 headline보다 위(y=184 vs y=440)에 렌더되어 4th element 침범 확정.
- **Risk 3 (Invariant 자동화)**: Track 4 phase에서 Playwright `toHaveScreenshot` baseline + maxDiffPixelRatio gate로 해소 예정. **단 Track 2 layout 안정화 후** baseline lock (잘못된 상태를 정상화하는 안티패턴 회피).

### Gate B 후속 액션 (Track 2 진입 의무)

`-100.19px CTA overflow` 해소 후보 (codex Track 2 토론 결정 의무):

- (a) `.hero-v3` padding 압축 — `48px 0 56px` → `24px 0 32px`로 -48px 회수
- (b) `.hero-eyebrow` mobile 숨김 또는 font-size 축소 (-40~60px 회수)
- (c) `@media (max-width: 920px) { .hero-right { order: -1 } }` 제거 → ProductShot을 fold 밖으로 이동 (-100~200px 회수, 가장 큰 효과)
- (d) above-fold lock 정의 자체 재선정 (headline + sub만 = 2 elements, CTA scroll 후 노출)

**1차 시도 권장 = (c)**: 정의 lock의 "ProductShot은 stack 하단" 의도와 일치하는 방향. owner 의사결정 후 적용.

## 관련

- handoff 메모리: `project_landing-mvp-4-handoff-2026-05-23`
- plan: `~/.claude/plans/context-precious-flute.md` (Track 2)
- Hero 구현: `components/Hero.tsx` L98-157
- V3_NAV (sticky-header 56px 가정 근거): `lib/data.ts` L48-52
