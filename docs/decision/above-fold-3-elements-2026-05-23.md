# Above-Fold 3 Elements — 정의 Lock (2026-05-23)

## 정의

Mobile 375x667 viewport 기준, 페이지 로드 직후 사용자에게 보여야 할 핵심 3 요소.

owner option (a) — `headline + sub + primary CTA`. SaaS 랜딩 전형 우선순위 (message → value-prop → conversion 3단계 완결).

1. **Element 1 — Hero Headline (H1)**
   - 위치: `components/Hero.tsx` L110-113
   - 텍스트: `Burn Index puts a number on your drag.`
   - CSS: `.hero-headline` (`app/globals.css` 검색 필요)
   - 픽셀 높이: 미측정 (Track 1 dev server 복구 후 차기 사이클 실측)

2. **Element 2 — Hero Sub-copy**
   - 위치: `components/Hero.tsx` L114-118
   - 텍스트 (production, SHOW_LEGACY=false): `Get your burn score. See where you rank against verified solo devs.`
   - CSS: `.hero-sub`
   - 픽셀 높이: 미측정 (Track 1 차기 사이클 실측)

3. **Element 3 — Primary CTA Button**
   - 위치: `components/Hero.tsx` L125-128
   - 라벨: `Join Burn Index`
   - 컴포넌트: `<Button variant="primary" size="lg">` (`@/components/primitives`)
   - 픽셀 높이: 미측정 (Track 1 차기 사이클 실측)

## 합산 fold budget

- viewport 가용 높이: `667 - 56 (sticky-header) = 611px`
- 3 elements 합산 + 간격: **≤ 611px** (Hero padding 조정 후 검증)
- 합산 측정값은 차기 사이클 Track 1 (Nav width 실측) 진행 시 동일 dev server 세션에서 함께 수집

## Out of fold (의도적 배치)

다음 요소는 fold **밖**에 배치 허용 — 스크롤 후 노출:

- `hero-eyebrow` (L106-109) — context label, 약화 가능
- `hero-chips` (L119-124) — Claude Code/Codex/Cursor/+more 지원 툴 표시
- `HeroSecondaryCard` (L135) — Top VES/Week fixes/AI spend 지표 카드
- `hero-right` (L138-153) — ProductShot (mobile에서 stack 하단으로 이동)

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

## 관련

- handoff 메모리: `project_landing-mvp-4-handoff-2026-05-23`
- plan: `~/.claude/plans/context-precious-flute.md` (Track 2)
- Hero 구현: `components/Hero.tsx` L98-157
- V3_NAV (sticky-header 56px 가정 근거): `lib/data.ts` L48-52
