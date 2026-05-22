# /codex Phase 1 적대적 검토 인풋 — folder-picker-ux Finding 1

**Date**: 2026-05-22
**Plan**: `tasks/folder-picker-ux-finding1/plan-v1.md`
**Brief**: `tasks/folder-picker-ux-finding1/plan-brief.md`
**Risk**: 위험 3축 2/3 충족 (실패비용 + 영향범위, 관찰가능성 부분)

---

## 컨텍스트

Next.js 16.2.6 App Router client component(`components/LandingApp.tsx`)에 `?auto-detect=1` URL 쿼리 진입 시 modal 자동 오픈 useEffect를 추가한다. `useSearchParams` + `useRef` latch 패턴 + `closeModal` useCallback 단일 close path. 변경 surface ~15-25 라인.

코드 diff (plan-brief.md §변경 surface + plan v1 §Phase 3 보강):

```tsx
// 추가 import
import { useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

// 컴포넌트 내부
const userClosedRef = useRef<boolean>(false);
const searchParams = useSearchParams();

// 단일 close path
const closeModal = useCallback(() => {
  userClosedRef.current = true;
  setModal(null);
}, []);

useEffect(() => {
  if (
    searchParams?.get("auto-detect") === "1" &&
    modal === null &&
    !userClosedRef.current
  ) {
    setModal("join");
  }
}, [searchParams, modal]);

// 모든 close 호출 (overlay / close button / showToast setTimeout)을 closeModal로 통일
onClick={closeModal}
```

## Invariants (위반 시 즉시 중단)

- #3 (본체 보존): auto-detect 진입 후 Path Preview Card 정상 렌더
- #6 (신규): 동일 세션 close 후 modal 재오픈 0건

## 6묶음 적대적 질문

다음 6개 영역을 검토하고 각 영역별로 결함(HIGH/MEDIUM/LOW/CLEAN) + 근거 + mitigation 제안.

### Q1 — `useSearchParams` Next.js 16.2.6 client component 동작

`useSearchParams`가 App Router client component(`"use client"` directive 가정)에서 다음을 보장하는가:
- Hydration mismatch 없이 SSR ↔ CSR 일관된 값
- Suspense boundary 의무인가? (Next.js 14에서 의무화 — 16.2.6 동작 확인 필요)
- `node_modules/next/dist/docs/`에서 16.2.6 공식 가이드 인용 부탁(AGENTS.md 의무 — Next.js training data 신뢰 금지)

### Q2 — `useRef` + React StrictMode double-invoke

`userClosedRef`가 React 19 StrictMode double-invoke 시:
- useEffect cleanup 없이 두 번 호출되어도 `userClosedRef.current`가 의도와 다르게 설정될 위험?
- 첫 invoke에서 modal 오픈 → cleanup → 두 번째 invoke에서 또 modal 오픈하는 경합?
- React 19 useEffect dependency `[searchParams, modal]`이 modal state change마다 재실행될 때 latch 검사 충분?

### Q3 — onClick path 경합

본 cycle 변경 후 사용자 시나리오:
- 사용자가 `https://...?auto-detect=1` 진입 → useEffect가 modal 오픈
- 사용자가 modal close → `userClosedRef.current = true`
- 사용자가 같은 세션에서 Hero "Join Burn Index" 버튼 클릭 → `setModal("join")` 직접 호출

문제: onClick은 `userClosedRef`를 체크하지 않음(useEffect만 체크). 즉 latch 후에도 onClick path는 정상 동작해야 함. **이게 의도된 동작인지 검증** — 의도와 다르면 onClick path도 latch 체크 추가 필요?

### Q4 — Truthy value 분기

`searchParams?.get("auto-detect") === "1"`은 strict "1"만 매칭. 다음 케이스 동작:
- `?auto-detect=true` → false (오작동? URL 자유도 너무 좁음?)
- `?auto-detect` (값 없음) → false (Chrome에서 `?auto-detect=` 또는 `?auto-detect`로 진입 시 어떻게 parse되는가?)
- `?auto-detect=1&auto-detect=2` → `get()`은 첫 값 반환 → "1" → true (의도된 동작인가?)

**JoinBurnIndexForm.tsx:67-73 `autoDetect` flag 분기 로직과 일치 시켜야** — 사전 grep해서 어떻게 parse하는지 확인 후 일치 권고.

### Q5 — Invariant #6 실측 방법

"동일 세션 내 close 후 재오픈 0건"을 Playwright e2e로 검증 가능한가? 또는 owner manual cell?
- Playwright: `page.goto('?auto-detect=1')` → modal 확인 → close click → `page.waitForTimeout(N)` → modal 존재 여부 재확인
- N 값은 useEffect 재실행 trigger를 어떻게 강제할 것인가? (searchParams 그대로면 useEffect 재실행 안 함이라 false negative 위험)
- Phase 5 cells #3 "history 조작"의 구체 명령 — `window.history.pushState({}, '', '?auto-detect=1')` 후 modal 재오픈 여부?

### Q6 — 비-버튼 close 경로 누락 (Hard gate 검출)

본 cycle은 modal-overlay·modal-close button·`showToast` setTimeout 3곳에 `closeModal` latch 통일을 명시 (Task C.6 Step 2 inventory 의무). 단 다음 비-버튼 close 경로가 latch 우회할 수 있는가:

- **ESC 키 close**: 기존 LandingApp.tsx에 ESC keydown listener 존재 여부 grep (`grep -n 'Escape\|key.*Esc' web/components/LandingApp.tsx`). 존재 시 해당 handler도 `closeModal` 통일 의무 (현 plan 미명시)
- **브라우저 back/forward**: 사용자가 brower back button으로 modal 닫는 시나리오. `popstate` listener 또는 router event 처리 여부
- **외부 imperative close**: `LandingApp` 외 컴포넌트(예: `JoinBurnIndexForm` 내부 success callback)에서 `setModal(null)` 호출 가능성. props drilling 또는 context로 setModal 전달되는지 inventory
- **Toast outside Modal**: `showToast`는 modal 안에서만 호출되나? grep으로 호출 경로 전수 확인 (`grep -n showToast web/components/`)

**HIGH 판정 시**: 누락된 close 경로마다 `closeModal` 통일 의무를 Task C.6 Step 5에 추가 (현 5경로 → N경로). LOW면 비-버튼 경로 부재 명시.

## 응답 형식

각 Q마다:
- **판정**: HIGH / MEDIUM / LOW / CLEAN
- **근거**: 2-3줄
- **mitigation**: 구체 코드 또는 검증 절차 (HIGH/MEDIUM 시)
- **관련 docs**: Next.js 16.2.6 또는 React 19 anchor (해당 시)
