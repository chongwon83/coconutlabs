# ENG Review Amendment — Plan v1 Landing MVP-4 안 B (2026-05-22)

**Reviewer**: Claude (gstack `/plan-eng-review` mode) + `/codex` cross-review
**Target**: `tasks/landing-mvp-4/plan-v1.md` (IMMUTABLE) + `plan-ceo-review.md` (CEO delta)
**Mode**: TECHNICAL VERIFICATION + GAP RESOLUTION
**위험 3축**: 2.5/3 충족 → /codex 의무 cross-review 실행 완료

---

## 0. Scope Challenge — 8 파일 변경 + Hero contract 변경 + Feature flag 도입

### 0.1 Scope 검증
- 변경 파일: 8 mod + 1 new + 4 hide (D1=B에서 delete → hide로 변경됨, CEO delta)
- HARD-GATE: ✅ 충족 (3+ 파일 → 계획 사전 수립 의무, plan v1에 명시됨)
- Hero `onChallenge` prop 제거 외부 영향: LandingApp.tsx 외 grep 0건 확인됨 (Phase 1 §1.2)
- Feature flag 도입: `NEXT_PUBLIC_SHOW_LEGACY_SECTIONS` 신규 환경변수 (D1=B)

### 0.2 위험 3축 확정
| 축 | 충족 | 검증 |
|----|------|------|
| ① 실패비용 | ✅ | 첫인상 회복 ≥ 2h, feature flag로 5분 복귀 가능 (D1=B 채택) |
| ② 영향범위 | ✅ | LandingApp = 진입 routing, blast radius 큼 |
| ③ 관찰가능성 | 🟡 | waitlist 전환 silent 실패 가능 → F4 1주 self-check 보강 (CEO delta §10) |

→ **2.5/3 → /codex + /cso 의무 (Phase 6에서 실행)**

---

## 1. Codex Cross-Review 결과 (Gap 1, 2 해소)

### Gap 1 — Hero 내부 challenge/drops 탭 시스템

**문제**: `components/Hero.tsx`는 3-tab 시스템 (burn / challenge / drops) + 두 CTA(`onJoin` + `onChallenge`)를 가진다. plan v1 §2.1은 "Hero CTA 단일화(`onChallenge` prop 제거)"만 명시 — 내부 탭 시스템 처리 누락.

**Codex 권고**: **Option A** — 내부 탭·secondary CTA도 동일 flag로 conditional 숨김.

**근거** (codex 직접 인용):
> "D1=B의 핵심은 '보존+flag'인데, 외부 섹션은 flag로 보존하면서 Hero 진입점만 다른 정책을 적용하면 일관성이 깨진다. MVP-4의 기본 표시는 'Burn-centric'이어야 하므로 challenge/drops 탭과 secondary CTA가 default-visible 상태면 정체성 메시지가 흐려진다. Option B (내부 탭 영구 삭제)는 부활 비용을 다시 키워 D1=B 의도를 훼손한다. Option C (외부 flag + Hero standalone delete)는 섹션은 숨겨두고 Hero는 그대로 promote하는 모순 발생."

**Delta to plan v1**:
- **§2.1 (변경 파일)** `components/Hero.tsx` 행 수정:
  > **(이전)** "Hero 내부 Ticker 흡수 — 상단 sub-row로 ticker 표시. CTA 단일화(`onChallenge` prop 제거). subhead 카피 advisory anchor 적용"
  > **(개정)** "Hero 내부 Ticker 흡수 — 상단 sub-row로 ticker 표시. `NEXT_PUBLIC_SHOW_LEGACY_SECTIONS=true`일 때만 `onChallenge` prop, secondary CTA('Get Challenge Invite'), `HeroTab` challenge/drops 탭, `ProductShot` legacy branches를 노출. `false` 기본값에서는 **burn-only Hero** 렌더링 — 단일 CTA(`onJoin`) + burn tab만 active + ticker sub-row 흡수"

- **§3 Phase 4 step 1** 수정:
  > "components/Hero.tsx 변경 (Ticker 흡수 + **burn-only 분기** + CTA 단일화 default + flag conditional으로 legacy tabs 보존)"

- **§4.1 평가기준 추가** (#8 신설):
  > **[Feature flag 단방향성]** `process.env.NEXT_PUBLIC_SHOW_LEGACY_SECTIONS !== 'true'` 기본값에서 Hero 초기 `HeroTab === 'burn'`이고 `<button>Get Challenge Invite</button>` 렌더링 0건 (DOM grep evidence)

**구현 세부 (Codex trade-off 노트)**:
- `useState<HeroTab>("burn")` 초기값은 burn이지만, flag=false 시 다른 탭 진입 경로가 없도록 challenge/drops 탭 버튼 자체를 flag conditional rendering으로 감싸기
- `ProductShot` 분기는 burn 케이스만 default-active, 다른 케이스는 flag=true일 때만 도달 가능

---

### Gap 2 — TrustSection FinalCTA 흡수

**문제**: plan v1 §2.1은 "TrustSection FinalCTA 흡수 — `JoinBurnIndexForm` reuse"이고 §2.3은 `FinalCTA.tsx` 삭제. 하지만 D1=B에서 `FinalCTA.tsx`는 **보존 (flag-hidden)**로 변경됨. 흡수와 보존이 충돌 — TrustSection이 흡수를 하면 flag=true 시 CTA 중복 (TrustSection + FinalCTA).

**Codex 권고**: **Option B** — TrustSection 흡수는 **유지**, 단 compact variant.

**근거** (codex 직접 인용 — 본 cycle의 핵심 통찰):
> "D1=B는 `FinalCTA.tsx` 파일/컴포넌트 보존이지, MVP 기본 화면에서 CTA를 잃어도 된다는 뜻은 아니다. FinalCTA는 default flag-hidden이므로 MVP 기본값에서 최종 CTA가 사라지면 waitlist 퍼널 종단이 비어버린다. Option A (흡수 삭제)는 default 화면에 final CTA 부재로 conversion 하락. compact variant로 흡수를 유지하면 flag=true 시 (legacy section + Trust CTA) 중복이 보이지만 이는 legacy 복원 모드의 의도된 동작."

**Delta to plan v1**:
- **§2.1 (변경 파일)** `components/TrustSection.tsx` 행 수정:
  > **(이전)** "FinalCTA 흡수 — TrustSection 내부에 이메일 1필드 form (`JoinBurnIndexForm` reuse) 통합"
  > **(개정)** "MVP 기본값에서 최종 CTA 역할 — 섹션 하단에 `JoinBurnIndexForm` (existing entrypoint reuse) + reassurance copy 1줄 compact 통합. `FinalCTA.tsx`는 `NEXT_PUBLIC_SHOW_LEGACY_SECTIONS=true`일 때 기존 별도 섹션으로 보존 (중복 허용 — legacy 복원 모드 의도)"

- **§2.3 (Hide via flag)** `FinalCTA.tsx` 행 사유 수정:
  > **(이전)** "TrustSection에 흡수"
  > **(개정)** "default flag-hidden — legacy 복원 시 TrustSection compact CTA와 함께 표시 (중복 의도)"

- **§3 Phase 4 step 2** 수정:
  > "components/TrustSection.tsx 변경 — `JoinBurnIndexForm` import + compact form + reassurance copy 통합. Modal trigger 아닌 **in-section form**으로 동작 (form props 변환 검토)"

- **§4.1 평가기준 추가** (#9 신설):
  > **[퍼널 종단 보장]** flag=false (default) 환경에서 TrustSection 내 `<form>` 또는 `JoinBurnIndexForm` 인스턴스 ≥ 1 렌더 (DOM grep evidence) — MVP 기본값에서 waitlist 종단 CTA 부재 0건

**구현 세부 (Codex trade-off 노트)**:
- `JoinBurnIndexForm`은 기존에 modal-overlay 사용 가능성 있음 — in-section 사용 시 props variant (`variant?: "modal" | "inline"`) 필요 검토 (Phase 6 Q3 codex 검증 항목)
- Suspense boundary 영향: TrustSection이 client component면 기존 LandingApp Suspense boundary 안에 포함 — 신규 boundary 불필요
- `AutoDetectListener`는 `useSearchParams` 의존 → modal 진입 경로 보존됨 (TrustSection inline form은 별개 path)

---

### Gap 1·2 Mutual Interaction

**Codex 명시**: "두 결정은 직접 의존성 없음. 단 동일 flag 의미 공유:
- `false` (default) = **Burn Index 중심 MVP** (Hero burn-only + Trust inline CTA 종단)
- `true` (legacy 복원) = **challenge/drops Hero + 기존 4 sections + FinalCTA + TrustSection compact CTA 중복**

중복은 legacy 복원 모드의 의도된 동작이므로 ban 아님."

---

## 2. Architecture Review (기술 검증)

### 2.1 Hero `onChallenge` prop 인터페이스 변경 영향

| 변경 | 영향 | 검증 |
|------|------|------|
| `HeroProps` interface에서 `onChallenge?: () => void` 유지 (Option A 채택 시) | `LandingApp.tsx` flag=false 시 미전달 = no-op | TypeScript optional ⇒ build error 0건 |
| `LandingApp.tsx`에서 `onChallenge` 전달 시 flag conditional | flag=true 시 challenge modal 트리거 보존 | E2E spec 영향 0 (auto-detect 무관) |

→ **결정**: `onChallenge` prop은 **interface에서 제거하지 않음** (Codex Option A 정합). Plan v1 §2.1 "CTA 단일화(`onChallenge` prop 제거)" 표현은 **flag=false 환경에서 미사용**으로 해석. prop 자체는 유지.

### 2.2 Suspense boundary 보존

- `app/page.tsx` Suspense fallback 보존 (직전 사이클 finding1 패턴)
- `AutoDetectListener`는 `useSearchParams` → 클라이언트 + Suspense child 보존
- `LandingApp.tsx` flag conditional은 **server-safe** (env var 접근은 `process.env.NEXT_PUBLIC_*` 빌드 타임 inline) → SSR 회귀 없음

### 2.3 Feature flag 구현 패턴

```tsx
// LandingApp.tsx
const SHOW_LEGACY = process.env.NEXT_PUBLIC_SHOW_LEGACY_SECTIONS === "true";

return (
  <main>
    <Hero
      onJoin={handleJoin}
      {...(SHOW_LEGACY ? { onChallenge: handleChallenge } : {})}
    />
    <BurnIndexSection />
    {SHOW_LEGACY && <ChallengeSection />}
    {SHOW_LEGACY && <BuildersSection />}
    {SHOW_LEGACY && <DropsSection />}
    <TrustSection />
    {SHOW_LEGACY && <FinalCTA />}
  </main>
);
```

**패턴 선택 근거**:
- `process.env.NEXT_PUBLIC_*`은 Next.js 빌드 타임 inline → 런타임 비용 0
- conditional rendering이 tree-shaking 대상은 아님 (lib에 포함됨) — bundle size 영향은 §4 참조
- 동적 토글 X (재배포 필요) — F3 부활 트리거 표 (CEO delta §8.1) 정합

### 2.4 TypeScript strict 통과 보장

- `HeroProps` `onChallenge?: () => void` optional 유지 → 미전달 OK
- `JoinBurnIndexForm` `variant?: "modal" | "inline"` props 추가 필요 (in-section 사용처 대응)
- `process.env.NEXT_PUBLIC_SHOW_LEGACY_SECTIONS` 타입: Next.js global ambient declaration 자동 string | undefined → `=== "true"` 비교로 안전

---

## 3. Tests (회귀 점검)

### 3.1 E2E spec 영향
- `onboarding-30s.spec.ts`: Hero CTA "Join Burn Index" 클릭 → modal 진입 (현 동작 유지)
- `burn-import-fsa-picker.spec.ts`: FSA folder picker (직전 사이클 finding1 패턴) — 본 사이클 변경 영향 0
- `auto-detect modal` spec: `?auto-detect=1` → modal 자동 오픈 — `AutoDetectListener` Suspense 보존이라 무관

### 3.2 Unit 회귀
- Vitest 244+ baseline 유지 (직전 사이클 산출물)
- Hero burn-only 분기 추가 → 신규 Hero test 1개 추가 권장 (`Hero.test.tsx`에서 `process.env.NEXT_PUBLIC_SHOW_LEGACY_SECTIONS=false` 환경 시 challenge tab 렌더 0건)

### 3.3 Brand color invariant
- `grep '#0F172A\|#0F766E\|slate-900' web/{components,app}` → 0 hits 유지 의무 (Plan v1 §1.3.1)

---

## 4. Performance (Bundle size delta)

**Feature flag 보존 비용**:
- 4 컴포넌트 (`ChallengeSection`, `BuildersSection`, `DropsSection`, `FinalCTA`) bundle 포함 — flag=false 시에도 dead code로 남음
- 추정 추가 bundle: ~8KB gzip (4 컴포넌트 평균 2KB) — landing page first-load 영향 미미
- 대안: dynamic import (`next/dynamic`)로 conditional 로드 — 단 SSR 복잡도 증가 → **본 사이클 미채택**, 다음 사이클 검토

**Burn-only Hero 분기 비용**:
- HeroTab 내부 상태 + ProductShot 분기 코드는 잔존 (flag=true 시 활성)
- 추가 bundle: ~1KB gzip — 무시 가능

→ **결정**: bundle size 추가 ~9KB gzip은 D1=B reversibility 가치 대비 수용 가능.

---

## 5. Implementation Tasks (Phase 4 S6 구현 5묶음 — /codex 사전 정의)

Phase 4 진입 시 다음 5묶음으로 `/codex` 의무 검증 (각 묶음 1-pass 통과 시 다음 진행):

1. **묶음 1 — Hero burn-only 분기**: Hero.tsx에서 `SHOW_LEGACY` 분기 추가 + challenge/drops 탭 conditional render + secondary CTA conditional + ProductShot legacy branch conditional
2. **묶음 2 — TrustSection compact CTA**: TrustSection.tsx에 `JoinBurnIndexForm` import + reassurance copy + (필요 시) `variant: "inline"` props 추가
3. **묶음 3 — LandingApp flag wiring**: 4 컴포넌트 import 보존 + JSX conditional rendering + Hero에 `onChallenge` flag conditional 전달
4. **묶음 4 — Ticker Hero sub-row variant**: Ticker.tsx size variant prop 추가
5. **묶음 5 — BurnIndexSection methodology copy** (CEO delta): header 1-2줄 추가 + DESIGN.md `burn-methodology-caption` spec verification

---

## 6. Outside Voice (Codex 직접 인용)

Codex의 잔여 우려 (Phase 4 진입 시 owner 인지 의무):

> "Option A (Gap 1)와 Option B (Gap 2) 모두 채택 시, flag=true 복원 시 화면 정합성 점검 필수. 특히 TrustSection compact CTA + FinalCTA 동시 표시는 시각 중복 — legacy 복원 모드에서 의도된 동작이라 명시했지만, Phase 5 (S7 design-review)에서 owner 직접 시각 검수 시 'CTA 2번 보이는 게 이상하다' 판단이 들면 즉시 alert."

→ **Phase 5 Owner Happy Path 추가 체크**: `NEXT_PUBLIC_SHOW_LEGACY_SECTIONS=true` 환경에서 TrustSection compact CTA + FinalCTA 시각 중복이 의도대로 자연스러운지 owner 직접 1줄 기록.

---

## 7. Review Readiness Dashboard

| 진입 조건 (S5 worktree → Phase 4) | 상태 |
|----------------------------------|------|
| Plan v1 immutable (변경 0건) | ✅ |
| CEO delta 산출 (`plan-ceo-review.md`) | ✅ |
| ENG delta 산출 (본 파일) | ✅ |
| Gap 1, 2 codex 의무 cross-review 완료 | ✅ |
| 위험 3축 2.5/3 명시 | ✅ |
| 평가기준 9개 (7 기존 + 2 신설 #8, #9) | ✅ |
| Phase 4 5묶음 /codex 검증 사전 정의 | ✅ |
| Feature flag 패턴 코드 샘플 첨부 | ✅ |
| Bundle size delta 추정 + 수용 결정 | ✅ |

**Verdict**: Plan v1 + CEO delta + 본 ENG delta 정합. **S5 worktree 분리 → Phase 4 S6 구현 진입 가능**.

---

## 8. ENG Review Self-Check

- [x] Scope Challenge 수행 (Section 0)
- [x] /codex 의무 cross-review 실행 (Gap 1, 2)
- [x] Architecture review (Hero contract / Suspense / feature flag / TypeScript)
- [x] Tests 회귀 점검 (E2E / Unit / Brand invariant)
- [x] Performance bundle size delta 추정
- [x] Phase 4 5묶음 /codex 사전 정의
- [x] Outside Voice (codex 잔여 우려)
- [x] Solo project 정책 반영 (no PR, direct-push)
- [x] Tier 1 Hard Rules 보존 (HARD-GATE, Context 50%, Evidence-Based)

---

## GSTACK REVIEW REPORT

**Verdict**: ✅ **PASS with deltas** — Plan v1 + CEO delta + 본 ENG delta 정합. Phase 4 (S5 → S6) 진입 가능.

**Decision summary**:
- Gap 1 (Hero internal tabs) → Option A (feature flag conditional, codex 권고 채택)
- Gap 2 (TrustSection FinalCTA absorption) → Option B (compact variant 흡수 유지, codex 권고 채택)
- `onChallenge` prop interface 보존 (제거 X, optional 유지)
- Feature flag 패턴: `process.env.NEXT_PUBLIC_SHOW_LEGACY_SECTIONS === "true"` 빌드타임 inline
- 평가기준 7 → 9 (Feature flag 단방향성 + 퍼널 종단 보장 신설)
- Bundle size +9KB gzip 수용 (D1=B reversibility 가치)

**Cross-skill artifacts**:
- `tasks/landing-mvp-4/plan-v1.md` (IMMUTABLE, 233 lines)
- `tasks/landing-mvp-4/plan-ceo-review.md` (CEO delta, 8 items)
- `tasks/landing-mvp-4/plan-amendment-eng.md` (본 파일, ENG delta 6 items + 2 신설 평가기준)
- `tasks/landing-mvp-4/plan-execution.md` (Phase 3.2 완료 로그)

**Next phase entry conditions**: 9/9 PASS (Review Readiness Dashboard §7 참조)

**Owner action required**: S5 worktree 분리 여부 결정 — plan v1 §3 Phase 5는 worktree 권장 (8 파일+ 변경, blast radius 큼). plan-execution.md §4.1 참조.
