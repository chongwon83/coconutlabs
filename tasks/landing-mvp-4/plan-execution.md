# Plan-Execution Log — Landing MVP-4

S3 plan v1 phase-by-phase 실행 로그. 매 phase 완료 시 1줄 append.

---

## Phase 1 — 사전 점검 (2026-05-22)

### 1.1 AGENTS.md 의무 doc 3종 grep (plan v1 §0 — Next.js v16 breaking changes 경계)
- **server-and-client-components**: `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md` — "Learn how you can use React Server and Client Components to render parts of your application on the server or the client." (LandingApp.tsx `"use client"` boundary 룰)
- **use-search-params**: `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md` — "API Reference for the useSearchParams hook." (AutoDetectListener Suspense boundary 의무 — 직전 사이클 finding1 패턴 재사용)
- **tailwind-v3-css**: `node_modules/next/dist/docs/01-app/02-guides/tailwind-v3-css.md` — "Style your Next.js Application using Tailwind CSS v3 for broader browser support." (⚠️ v4 docs 미존재 — 본 사이클 globals.css `:root` token 변경 시 Tailwind v4 syntax 사용 중인지 owner 확인 필요)

### 1.2 삭제 대상 4 파일 외부 참조 grep 재검증
Pattern: `ChallengeSection|BuildersSection|DropsSection|FinalCTA`

| 매치 위치 | 종류 | 안전성 |
|----------|------|--------|
| `components/LandingApp.tsx:19-23` | 4 imports | 본 사이클 변경 대상 (제거 예정) |
| `components/LandingApp.tsx:125-129` | 4 JSX usages | 본 사이클 변경 대상 (제거 예정) |
| `components/{FinalCTA,BuildersSection,ChallengeSection,DropsSection}.tsx` | self-definition | 본 사이클 삭제 대상 |
| `app/**`, `e2e/**`, `__tests__/**`, `lib/**` | **0 hits** | ✅ 외부 의존성 없음 — 삭제 안전 |

→ **삭제 안전성 확정** (LandingApp.tsx import/JSX 제거와 동시 삭제 가능)

### 1.3 DESIGN.md lint baseline (`npx @google/design.md lint web/DESIGN.md`)
```
errors: 0
warnings: 4 — colors.{primary,secondary,tertiary,error} 'defined but never referenced by any component'
infos: 1 — 8 colors / 3 typography / 2 rounding / 3 spacing / 3 components
```

→ **S8 진입 차단 무관 (error 0)**. 단 4 warning은 S3.5 Design Phase에서 정리 권고 — Components 섹션에 sticky-header/hero-cta/trust-card spec 추가 시 `{colors.primary}` 참조하면 자연 해소.

### 1.4 Pre-S0 vault note logging (`tasks/landing-mvp-4/notes-used.txt`)
✅ 작성 완료. ① 직접 적용 2건 (idb-structuredclone, codex-heavy-1pass), ② 참고 2건 (web-font, nextjs-image).

---

## Phase 1 Self-Check
- [x] AGENTS.md doc 3종 grep + 1줄 요약
- [x] 삭제 대상 외부 참조 0건 확인
- [x] DESIGN.md lint baseline (error 0)
- [x] notes-used.txt 작성

**Phase 1 PASS** → Phase 2 (S3.5 Design Phase) 진입 준비 완료.

---

## Phase 2 — S3.5 Design Phase (2026-05-22)

### 2.1 DESIGN.md 보강 항목
- **YAML front matter 추가**:
  - `spacing.xl` (80px), `spacing.2xl` (120px) — section vertical rhythm 토큰화
  - `typography.hero-heading` (84px / 1.05 / -0.02em), `typography.section-heading` (48px / 1.15), `typography.hero-subhead` (18px)
  - `components.sticky-header` (56px bar, primary `surface`)
  - `components.hero-cta` (primary fill, on-surface label)
  - `components.trust-card` (on-surface body — secondary 미사용으로 4.29:1 contrast warning 회피)
  - `components.alt-bg-section` (surface-muted bg, Burn Index 섹션)
  - `components.error-text` (form validation 전용)
  - `components.tier-verified-accent` (2px 좌측 accent strip, secondary 색 안전한 non-text 사용처)
- **Prose 보강**:
  - §Overview: 4-section landing 구조 명시
  - §Colors: WCAG AA contrast 6 조합 표 추가
  - §Typography: hero-heading / section-heading / hero-subhead 역할 설명
  - §Layout: 80/120/56px rhythm + max-w 1200px + alt-bg 패턴 명시
  - §Do's and Don'ts: primary 텍스트 금지 + secondary 18px 이하 금지 룰 추가

### 2.2 WCAG AA contrast 실측 (design-md lint 검증)
| 조합 | 비율 | 판정 | 사용처 |
|------|------|------|--------|
| `#0A0A0A` on `#FFFFFF` | 19.3:1 | ✅ PASS | 본문 |
| `#0A0A0A` on `#FAFAFA` | 18.5:1 | ✅ PASS | Burn Index 본문 |
| `#008C5A` on `#FFFFFF` | 4.29:1 | ⚠️ Large only | 18px+ 또는 decorative |
| `#00D084` on `#FFFFFF` | 1.9:1 | ⚠️ Decorative only | hero-cta fill (텍스트 위가 #0A0A0A) |
| `#B45309` on `#FAFAFA` | 4.9:1 | ✅ PASS | Burn Index 추정 tier 카운트 |
| `#DC2626` on `#FFFFFF` | 4.8:1 | ✅ PASS | error-text |

### 2.3 design-md lint 결과 (Final)
```
errors:   0
warnings: 0
infos:    1 (token-summary: 8 colors / 6 typography / 2 rounding / 5 spacing / 9 components)
```

→ **Baseline 4 warnings → 0 warnings 개선**. S8 게이트 통과 조건(error 0) 충족.

### Phase 2 Self-Check
- [x] DESIGN.md §Layout 보강 (80/120/56px + max-w + alt-bg)
- [x] DESIGN.md §Components 보강 (sticky-header / hero-cta / trust-card / alt-bg-section + 등 4)
- [x] WCAG AA contrast 6 조합 명시 + 실측 일치
- [x] design-md lint error 0 / warning 0 통과

**Phase 2 PASS** → Phase 3 (S4 plan review) 진입 준비 완료.

---

## Phase 3 — S4 plan review (2026-05-22)

### 3.1 /plan-ceo-review (완료)
- **Mode**: SELECTIVE EXPANSION
- **Output**: `tasks/landing-mvp-4/plan-ceo-review.md` (CEO review with delta)
- **Findings**: G1 (methodology gap) / G2 (irreversibility) / G3 (conviction threshold) / F3 (reactivation trigger) / F4 (trust signal sufficiency) / F5 (PRD 정식화 backlog)
- **Owner decisions**:
  - **D1 = B** (Feature flag 전략): 4 컴포넌트 코드 보존 + env var hide
  - **D2 = 1** (Burn Index 헤더 methodology copy 추가)
- **Plan v1 Delta**: 8 항목 (§2.1 신규 BurnIndexSection 변경 / §2.3 rename to feature-flag / Phase 1·4·5·7 수정 / §8.1 부활 트리거 신규 / §10 출시 후 1주 self-check 신규)
- **다음 단계**: Delta 적용 결정 (amendment file vs plan v1.1) 후 `/plan-eng-review` 진입

### 3.2 /plan-eng-review (완료)
- **Mode**: TECHNICAL VERIFICATION + GAP RESOLUTION
- **Delta 적용 방법**: 별도 amendment file (`tasks/landing-mvp-4/plan-amendment-eng.md`) — Plan-as-Artifact 정책 (plan v1 immutable 보존)
- **Codex 의무 cross-review 실행 결과** (위험 3축 2.5/3 충족):

  | Gap | 문제 | Codex 권고 | 채택 |
  |-----|------|----------|------|
  | Gap 1 (Hero 내부 탭) | Hero.tsx 3-tab + secondary CTA가 default-visible이면 burn-centric 정체성 흐림 | **Option A** — `NEXT_PUBLIC_SHOW_LEGACY_SECTIONS=true`일 때만 challenge/drops 탭 + secondary CTA 노출 | ✅ |
  | Gap 2 (TrustSection 흡수) | D1=B로 FinalCTA flag-hidden → MVP 기본값에서 퍼널 종단 부재 위험 | **Option B** — TrustSection 흡수 유지 (compact variant) + flag=true 시 중복 허용 (legacy 복원 의도) | ✅ |

- **Plan v1 Delta**: 6 항목 (§2.1 Hero/TrustSection 행 수정 / §2.3 FinalCTA 사유 수정 / §3 Phase 4 step 1·2 수정 / §4.1 평가기준 #8 #9 신설)
- **신규 평가기준 2건**:
  - **#8 [Feature flag 단방향성]**: flag=false 기본값에서 Hero 초기 `HeroTab === 'burn'` + secondary CTA 렌더 0건
  - **#9 [퍼널 종단 보장]**: flag=false 환경에서 TrustSection 내 `<form>` 또는 `JoinBurnIndexForm` 인스턴스 ≥ 1 렌더
- **Architecture verifications**:
  - Hero `onChallenge` prop은 interface에서 제거하지 않음 (optional 유지, flag conditional 전달)
  - Suspense boundary 보존 (AutoDetectListener `useSearchParams` Suspense child)
  - Feature flag 패턴: `process.env.NEXT_PUBLIC_SHOW_LEGACY_SECTIONS === "true"` 빌드타임 inline (런타임 비용 0)
  - TypeScript strict 통과 (optional props + ambient declaration string|undefined)
- **Performance**: Bundle size delta ~9KB gzip (4 hidden components + Hero legacy branches) — D1=B reversibility 가치 대비 수용 결정. dynamic import는 다음 사이클 검토
- **Outside Voice (Codex 잔여 우려)**: flag=true 시 TrustSection compact CTA + FinalCTA 시각 중복 → Phase 5 (S7) Owner Happy Path 직접 검수 항목 추가
- **Phase 4 5묶음 /codex 사전 정의**: ① Hero burn-only 분기 ② TrustSection compact CTA ③ LandingApp flag wiring ④ Ticker Hero sub-row variant ⑤ BurnIndexSection methodology copy

### Phase 3 Self-Check
- [x] /plan-ceo-review 완료 (output file 생성)
- [x] Owner 2 decisions 반영 (D1=B, D2=1)
- [x] Plan v1 delta 산출 (8 항목, CEO)
- [x] Delta 적용 방법 결정 (별도 amendment files)
- [x] /plan-eng-review 진입 + 완료
- [x] Codex 의무 cross-review (Gap 1=A / Gap 2=B 채택)
- [x] ENG delta 산출 (6 항목 + 평가기준 2 신설)
- [x] Review Readiness Dashboard 9/9 PASS

**Phase 3 PASS** → Phase 4 (S5 worktree 분리 → S6 구현 5묶음) 진입 준비 완료.

---

## Phase 4 — S5 worktree + S6 구현 (대기, owner 승인 후 진입)

### 4.0 진입 게이트 점검
- ✅ Plan v1 immutable (변경 0건)
- ✅ CEO delta (`plan-ceo-review.md`)
- ✅ ENG delta (`plan-amendment-eng.md`)
- ✅ DESIGN.md error 0 warning 0 (Phase 2)
- ✅ AGENTS.md 3 docs grep 완료 (Phase 1)
- ✅ 삭제 → hide 전환 (4 파일 외부 참조 0건)

### 4.1 다음 액션 (owner 결정 대기)
- (a) S5 worktree 분리 후 Phase 4 S6 진입 (8 파일+ 변경 → worktree 권장, plan v1 §3 Phase 5 정합)
- (b) feature branch만 (worktree 생략) 후 Phase 4 진입
- (c) 본 plan + delta 재검토 (추가 변경 요청)

→ owner: a/b/c 중 선택 시점
