# Plan v1 — Landing MVP-4 안 B (11섹션 → 4섹션 축소)

**작성일**: 2026-05-22
**Owner**: scw0526
**S0 anchor**: `web/docs/decision/decision-log.md` "2026-05-22 [Landing Page MVP-4 안 B]"
**Memory anchor**: `project_landing-mvp-4-anB-2026-05-22`
**위험 3축**: 2.5/3 충족 → /codex 교차 리뷰 + /cso 감사 의무

---

## 0. AGENTS.md 사전 확인 (의무, plan v1 첫 단계 — workflow-10steps.md S0 직후)

본 프로젝트 `AGENTS.md` 경고: **"This is NOT the Next.js you know — breaking changes. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code."**

본 사이클 영향 영역 사전 확인 의무 문서:
- `node_modules/next/dist/docs/app-router/client-components.mdx` — `"use client"` boundary 룰
- `node_modules/next/dist/docs/app-router/use-search-params.mdx` — 직전 사이클 (folder-picker-ux-finding1)에서 Suspense boundary 의무 확인됨 — 본 사이클은 LandingApp.tsx 동일 컴포넌트 수정이라 패턴 재사용
- `node_modules/next/dist/docs/styling/css-modules.mdx` 또는 tailwindcss v4 docs — 본 사이클은 globals.css `:root` token + Tailwind utility 혼용

**Owner 진입 시 의무 출력**: S6 구현 시작 전 위 3개 doc 페이지 grep 결과 1줄씩 plan-execution log에 기록.

---

## 1. Context (문제·동기)

### 1.1 문제
coconutlabs.xyz 랜딩이 런칭 단계인데도 11섹션(StatusBar + Nav + Hero + Ticker + BurnIndexSection + ChallengeSection + BuildersSection + DropsSection + TrustSection + FinalCTA + Footer)으로 비대. 솔로 개발자/인디해커 타겟이 한 화면에 11개 메시지를 소화하지 못함.

### 1.2 동기 (S0 안 B 채택 근거)
- **인지부하 감소**: 4섹션 압축 (Header / Hero / Burn Index / Trust+CTA)
- **카테고리 정의자 톤 보존**: VES(Verified Efficiency Score) 메트릭이 본 서비스의 카테고리 정의 anchor → Burn Index 섹션 보존 의무
- **waitlist CTA fold 내 도달**: 4섹션 압축으로 첫 화면 fold 내 CTA 노출

### 1.3 Invariants (절대 위반 금지 — Brand · 기능 · UX 3축)
1. **Brand color invariant**: `--young-coconut #00D084` primary 보존. Advisory에서 제안한 slate/teal `#0F172A` / `#0F766E`는 base palette와 충돌이므로 채택 금지. 대신 기존 base token 활용:
   - Hero 강조: `--fg #0A0A0A` (다크 텍스트, 흰 surface 유지)
   - Burn Index alt-background: `--surface-muted #FAFAFA` (기존 토큰)
   - Trust 섹션 accent: `--young-coconut-dark #008C5A` (기존 verified 색)
2. **카피 invariant**: "Tiny tokens. Big ships." Hero 헤드 보존 (Brand Director 채택)
3. **VES 메트릭 보존**: Burn Index 표 전체 표시 (`BurnIndexSection.tsx` + DESIGN.md Verification Tiers 3-tier hierarchy 그대로 유지)
4. **WCAG AA 4.5:1**: 모든 텍스트/배경 조합 통과
5. **Auto-detect 진입 회귀 0**: `?auto-detect=1` URL 쿼리 → modal 자동 오픈 보존 (directly tied to AutoDetectListener Suspense 자식, 직전 finding1 사이클 산출물)
6. **E2E spec 영향 0**: `onboarding-30s.spec.ts` + `burn-import-fsa-picker.spec.ts` 모두 PASS 유지

### 1.4 Non-scope (이번 사이클이 다루지 않음)
- 11섹션 콘텐츠를 `/about` 등 보조 페이지로 prune-then-redirect — owner 명시 선택 (가) 채택 (단순 제거)
- BurnIndexSection 내부 Verification Tiers 3-tier 디자인 변경 (기존 DESIGN.md 보존)
- Modal/Form 컴포넌트 변경 (`JoinBurnIndexForm` + `ChallengeInviteForm`은 보존)
- 신규 메시지 발명 — Advisory Copy Lock 후보 3개만 채택, 추가 발산 금지
- 이메일 수집 정책 변경 (기존 API + privacy 그대로)

---

## 2. 변경 파일 목록 (예상 8 + 신규 1 + 삭제 4)

### 2.1 직접 변경 (8 파일)
| 파일 | 변경 내용 | 영향 |
|------|-----------|------|
| `components/LandingApp.tsx` | 6 import 제거 (ChallengeSection, BuildersSection, DropsSection, ChallengeInviteForm 사용 줄 변경) + JSX `<main>` 내 5 섹션 → 2 섹션(Hero, BurnIndexSection)로 축소 + Ticker 흡수 위치 결정 | 진입 페이지 routing |
| `components/Hero.tsx` | Hero 내부 Ticker 흡수 — 상단 sub-row로 ticker 표시. CTA 단일화(`onChallenge` prop 제거). subhead 카피 advisory anchor 적용 | Hero 컴포넌트 contract 변경 (`onChallenge` 인터페이스 제거) |
| `components/Ticker.tsx` | Hero 내부 sub-row 위치 적응 — standalone 섹션 props 제거 또는 size variant 추가 | Ticker가 sub-component로 변환 |
| `components/TrustSection.tsx` | FinalCTA 흡수 — TrustSection 내부에 이메일 1필드 form (`JoinBurnIndexForm` reuse) 통합 | TrustSection이 conversion CTA 담당 |
| `components/FinalCTA.tsx` | **삭제** (TrustSection에 흡수) | 사라짐 |
| `components/Nav.tsx` | sticky 56px 유지 + waitlist CTA 우측 정렬 확인 (이미 sticky라 변경 미소) | sticky behavior 확정 |
| `app/globals.css` | 신규 token 추가 가능: section spacing utility `--section-gap: 80px`, hero gap `--hero-gap: 120px`, H2 균일화 `--h2-size: 48px`. 또는 Tailwind utility만 사용 (선택) | CSS token 추가 |
| `DESIGN.md` | Anchor 보강: §Layout에 80px section spacing + alt-background + H2 48px 균일화 + max-width 1200px 5 패턴 추가 (기존 Verification Tiers 섹션은 그대로) | Design spec lock |

### 2.2 신규 (1 파일)
| 파일 | 목적 |
|------|------|
| `tasks/landing-mvp-4/notes-used.txt` | Pre-S0 vault 사전 조회 결과 로깅 (직전 사이클 회고 요청 — Phase 3 hook 도입 전 자기준수 의무) |

### 2.3 삭제 대상 (4 파일)
| 파일 | 제거 사유 |
|------|-----------|
| `components/ChallengeSection.tsx` | 안 B에서 DEFER (Brand Director 권고) |
| `components/BuildersSection.tsx` | 안 B에서 DEFER |
| `components/DropsSection.tsx` | 안 B에서 DEFER |
| `components/FinalCTA.tsx` | TrustSection에 흡수 |

### 2.4 보존 (참고 — 변경 없음)
- `components/StatusBar.tsx` — Header 영역 일부, sticky Nav와 함께 보존
- `components/Footer.tsx` — legal/contact 라인, 4섹션 외 minimal 유지
- `components/Toast.tsx`, `components/forms/JoinBurnIndexForm.tsx` — modal/form 컨테이너 보존
- `components/forms/ChallengeInviteForm.tsx` — **삭제 검토 대상** but Section 5 롤백 안전성 위해 본 사이클은 보존 (다음 사이클에서 평가)

---

## 3. 단계별 작업 순서

### Phase 1 — 사전 점검 (S3.5 Design Phase 시작 전, 15분)
- [ ] `AGENTS.md` 의무 doc 3종 grep 결과 plan-execution.md 1줄씩 기록
- [ ] 삭제 대상 4 파일에 대한 외부 참조 grep 재검증 (`grep -r 'ChallengeSection\|BuildersSection\|DropsSection\|FinalCTA' web/{app,components,e2e,__tests__,lib}` → LandingApp.tsx 외 매치 0건 확인)
- [ ] 기존 DESIGN.md `npx @google/design.md lint web/DESIGN.md` 실행 → 현재 error 카운트 baseline 확보
- [ ] `tasks/landing-mvp-4/notes-used.txt` 작성 (Pre-S0 vault 조회 결과)

### Phase 2 — S3.5 Design Phase (DESIGN.md anchor 확정, 30분, Task #7)
- [ ] DESIGN.md §Layout 섹션 보강: 80px section spacing / alt-background (Burn `--surface-muted`) / H2 균일화 48px / max-width 1200px container / Hero hero-gap 120px
- [ ] §Components 섹션에 sticky-header, hero-cta, trust-card 컴포넌트 spec 추가 (advisory anchor + brand token 보정)
- [ ] design-md skill lint 통과 (error 0). WCAG AA 4.5:1 contrast 4 조합 점검:
  - `#00D084` on `#FFFFFF` → 1.9:1 (FAIL — 큰 텍스트만 허용, decorative 사용)
  - `#008C5A` on `#FFFFFF` → 4.6:1 (PASS)
  - `#0A0A0A` on `#FFFFFF` → 19.3:1 (PASS)
  - `#0A0A0A` on `#FAFAFA` → 18.5:1 (PASS)
  - Trust 강조용 `#008C5A` on `#FFFFFF` 채택 — advisory teal 미채택

### Phase 3 — S4 plan review (15분, Task #6 직후)
- [ ] `/plan-eng-review` (헤비 작업 — 8 파일 변경) — Hero contract 변경 영향 추적
- [ ] `/plan-ceo-review` (전략 — 7섹션 제거가 SEO/사용자 여정에 미치는 영향)
- [ ] Delta 산출: review 후 plan v1 → v2 갱신 또는 plan-amendment.md 추가

### Phase 4 — S6 구현 (60~90분, 위험 3축 2.5/3 → /codex 의무 사전 정의)
순서 (의존성 그래프):
1. `components/Hero.tsx` 변경 (Ticker 흡수 + CTA 단일화 + subhead 카피 적용)
2. `components/TrustSection.tsx` 변경 (FinalCTA 흡수 — `JoinBurnIndexForm` import + 이메일 1필드 form)
3. `components/LandingApp.tsx` 변경 (5 섹션 → 2 섹션 + import 제거 + `onChallenge` prop 제거)
4. `components/Ticker.tsx` 변경 (Hero sub-row variant 추가)
5. `app/globals.css` section spacing token 추가 (선택)
6. 삭제: `ChallengeSection.tsx` / `BuildersSection.tsx` / `DropsSection.tsx` / `FinalCTA.tsx`
7. 각 단계 후 `npm run build` 통과 확인 (TypeScript strict + Next.js compile)

### Phase 5 — S7 plan-design-review (15분, 웹 UI 의무)
- [ ] `npx @google/design.md lint web/DESIGN.md` error 0 재확인
- [ ] localhost 시각 검수: 4섹션 spacing + alt-background + H2 균일화 + max-width 적용 확인
- [ ] WCAG AA 실측 (Chrome DevTools Accessibility tab)

### Phase 6 — S8 검증 (Review Harness 3종 출력 + 위험 3축 의무, 30~45분)
- [ ] `npm run test` 전체 회귀 PASS (직전 사이클 244/244 baseline)
- [ ] `npx playwright test` e2e 3 specs 전부 PASS (auto-detect modal + folder picker + onboarding-30s)
- [ ] `npm run build` Static prerender 유지 확인 (`/` static export 보존)
- [ ] `/review` 코드 리뷰 통과
- [ ] **/codex 교차 리뷰** (위험 3축 2.5/3 충족 의무) — pre-defined 5묶음:
  - Q1: Hero `onChallenge` prop 제거가 외부 caller 영향 (LandingApp 외 grep 0건 확인 evidence)
  - Q2: Ticker sub-row variant가 standalone 사용처 회귀 없음 (확인 grep)
  - Q3: TrustSection `JoinBurnIndexForm` import 시 modal-overlay 클릭 처리 (in-section form은 modal 아님 → form props 변화 필요)
  - Q4: AutoDetectListener Suspense boundary 회귀 0 (LandingApp 변경이 boundary 깨지 않음)
  - Q5: WCAG AA contrast 실측 vs DESIGN.md 명시값 4 조합 일치
- [ ] **/cso 보안 감사** (이메일 수집 = 민감 데이터) — 기존 `/api/burnindex` token 검증 경로 회귀 0 확인
- [ ] B3 5종 산출물 작성 (`criteria.md` / `criteria-execution-log.md` / `diff.md` / `unverified.md` / `smoke-golden-regression.md`)

### Phase 7 — Owner Happy Path 직접 실행 게이트 (의무, 15분)
- [ ] localhost `http://localhost:3000/` 진입 → 4섹션 fold 내 확인 owner 손기록
- [ ] `?auto-detect=1` URL 진입 → modal 오픈 확인 owner 손기록
- [ ] waitlist CTA(Hero + Trust 양쪽) 클릭 → modal/form 동작 확인 owner 손기록
- [ ] `smoke-golden-regression.md`에 owner 직접 1줄 기록 (자동 우회 차단)

### Phase 8 — S9 배포 + S10 retro
- [ ] commit "feat(landing): MVP-4 11섹션 → 4섹션 안 B 축소" + push (solo direct-push, no PR per memory `feedback_coconutlabs-solo-no-review-request`)
- [ ] Vercel Production deploy 통과
- [ ] production smoke test (Chrome MCP): 4섹션 시각 검수 + waitlist 전환 동작
- [ ] decision-log S10 회고 2줄 추가

---

## 4. 검증 방법 (Review Harness 3종 + 평가기준 80% 통과)

### 4.1 평가기준 (작업 시작 시 Evaluator 서브에이전트로 매번 재추출)
임시 후보 7개 (S4 review 직후 `tasks/landing-mvp-4/criteria.md` 확정):
1. **[Brand invariant]** `--young-coconut #00D084` token 보존, slate/teal 미사용 (grep `#0F172A\|#0F766E\|slate-900` = 0 hits)
2. **[Carousel invariant]** Hero 카피 "Tiny tokens. Big ships." 보존 (grep 1+ 매치)
3. **[VES 메트릭 보존]** BurnIndexSection 컴포넌트 외부 contract 변경 0건 (grep diff = 0)
4. **[E2E 회귀 0]** Playwright 3 specs PASS
5. **[Unit 회귀 0]** Vitest 244+ PASS
6. **[WCAG AA]** 4 색 조합 contrast 명시값 ≥ 실측값 (DevTools 측정 evidence)
7. **[Auto-detect 회귀 0]** AutoDetectListener Suspense + userClosedRef latch 보존 (Invariant #6 직전 사이클 산출물 유지)

### 4.2 Review Harness 3종 출력 의무
1. **테스트 실행 결과**: `npm run test -- --reporter=verbose` + `npx playwright test --reporter=list` + `npm run build` 3종 통과/실패 카운트
2. **평가기준 통과 표**: 7항목 ✅/❌ + 1줄 근거 (`criteria-execution-log.md`)
3. **미통과 사유 + 다음 액션**: ❌ 항목별 원인 + owner 결정 필요 여부

---

## 5. 롤백 기준 (한도 4종 + 트리거 조건)

### 5.1 4종 한도 (harness-loop.md 의무)
- **시간 박스**: 본 사이클 추정 4~5시간 × 1.5 = 7.5시간 (Phase 1~8 합산). 초과 시 자동 중단 + owner 보고
- **토큰 박스**: 세션 컨텍스트 50% 도달 시 `/context-save` 강제 → 새 세션 `/context-restore`
- **재시도 한도**: API 3회 / 동일 검증 실패 2회
- **중단 조건 (invariant)**: 다음 중 하나 충족 시 즉시 중단 + 롤백
  - 평가기준 통과율 < 80% (재시도 후에도)
  - WCAG AA 4 조합 중 1건 이상 실측 미달
  - E2E spec 회귀 1건 이상
  - `?auto-detect=1` modal 자동 오픈 회귀

### 5.2 롤백 절차
- Phase 4 이전 중단 → 변경 없음, plan만 폐기
- Phase 4~6 중단 → `git reset --hard HEAD~N` (commit 이전 상태) + 삭제된 4 컴포넌트 복원
- Phase 7 후 production 중단 → Vercel previous deployment redeploy (~34초)

### 5.3 부분 롤백 (콘텐츠만 복귀)
- 4섹션 자체는 유지하되 특정 섹션(예: Burn Index 표) 직전 design으로 복귀 → 해당 컴포넌트 git revert만 사용

---

## 6. 위험 3축 점검 (S0 → S3 명문화)

| 축 | 충족 | 사유 + 검증 평가 |
|----|------|-----------------|
| ① 실패비용 | ✅ | 첫인상 회복 어려움. 4섹션 → 11섹션 복귀 가능하지만 사용자 신뢰 회복 비용 ≥ 2h |
| ② 영향범위 | ✅ | 8 파일 변경 + 4 파일 삭제 = 12 파일. LandingApp = 진입 routing, blast radius 큼 |
| ③ 관찰가능성 | 🟡 | waitlist 전환율 silent 실패 가능. Telemetry 보강 검토 — `JoinBurnIndexForm` submit 성공/실패 카운터 이미 존재 확인 필요 |

→ **2.5/3 충족 → /codex 교차 리뷰 + /cso 감사 의무** (Phase 6 S8 단계 실행)

---

## 7. 직전 사이클 회고 적용 (token-path-real-verify S10 회고 #1~#3)

- ✅ **#1** F1 INFO 별 사이클 분리 — 본 사이클은 token 경로 미접촉이라 무관
- ✅ **#2** "토큰 모듈 mock 룰" plan template 첫 섹션 명시 — Section 1.3 Invariant 5번 "Auto-detect 진입 회귀 0"가 sibling 룰
- ✅ **#3** Pre-S0 vault note logging — Phase 1에서 `tasks/landing-mvp-4/notes-used.txt` 작성 의무화

---

## 8. PRD F-ID 매핑 (현재 PRD 부재 — 임시 매핑)

본 프로젝트에 공식 PRD 파일 없음 (Pre-S0 grep 결과). 임시 F-ID:
- **F-LANDING-001** Hero — "Tiny tokens. Big ships." 카피 + 단일 CTA
- **F-LANDING-002** Burn Index — VES 메트릭 leaderboard (기존 DESIGN.md Verification Tiers)
- **F-LANDING-003** Trust + Final CTA — 검증 배지 + 이메일 1필드 form
- **F-LANDING-004** Sticky Header — Nav + StatusBar + waitlist CTA

S4 review 후 PRD 파일 생성 검토 (prd-generator 에이전트 활용 가능).

---

## 9. Next 단계

➡️ **본 plan v1을 owner 검수 후 (변경 0줄이면 v1 그대로) S3.5 Design Phase 진입** (Task #7).

본 plan은 작성 직후 commit 권장 (Plan-as-Artifact, commit-policy.md). 단 본 프로젝트는 솔로 direct-push 정책이므로 next commit batch에 포함.
