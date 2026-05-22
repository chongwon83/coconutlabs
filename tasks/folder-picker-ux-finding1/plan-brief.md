# Plan Brief — Finding 1 별 사이클: `?auto-detect=1` 모달 자동 오픈

**Date**: 2026-05-22
**Status**: 별 사이클 진입 trigger 역할 (실행 plan v1은 별 세션에서 S3 작성)
**Origin**: Phase 7 owner self-test에서 발견. 본 brief는 `folder-picker-ux` Phase 8.2 산출물

---

## 문제 (Verbatim from Phase 7)

Owner 2026-05-22 production self-test 발화:
> "Auto-detect Burn Summary 모달이 자동으로 뜨지는 않음"

`?auto-detect=1` 쿼리가 production landing 페이지에서 **modal 자동 오픈을 trigger하지 않는다**. 사용자는 Hero/Nav/DropsSection/FinalCTA의 "Join Burn Index" 버튼을 1회 클릭해야 modal이 열린다.

### 코드 anchor (Phase 7 verification 결과)

- `components/LandingApp.tsx:22` — `setModal` state. 유일한 trigger는 4곳 onClick handler (Nav L62 / Hero L66 / DropsSection L73 / FinalCTA L76)
- `components/LandingApp.tsx:28-41` — 유일 useEffect는 `/api/burnindex` fetch만 처리, URL 분리
- `components/forms/JoinBurnIndexForm.tsx:67-73` — `autoDetect` flag는 **모달 내부 콘텐츠**(Path Preview Card + picker 활성)만 제어. modal 자체 오픈은 LandingApp 책임

### Invariant #3 회귀가 아닌 이유

본 plan(`folder-picker-ux`)의 Invariant #3은 "auto-detect 진입 시 카드가 정상 렌더되는가" — modal이 열린 뒤를 보호. modal 자체 오픈은 별도 책임이며 본 plan 범위 밖이었음. Phase 7에서 owner 자체검증으로 발견된 UX gap.

---

## 변경 surface (예상 ~15줄)

**단일 파일**: `components/LandingApp.tsx`

```diff
- import { useState, useCallback, useEffect } from "react";
+ import { useState, useCallback, useEffect, useRef } from "react";
+ import { useSearchParams } from "next/navigation";

  export default function LandingApp() {
    const [toast, setToast] = useState({ visible: false, message: "" });
    const [modal, setModal] = useState<"join" | "challenge" | null>(null);
    const [imported, setImported] = useState<ImportedEntry[]>([]);
+   const userClosedRef = useRef<boolean>(false);
+   const searchParams = useSearchParams();

+   // 1회 trigger: ?auto-detect=1 진입 시 modal 자동 오픈
+   // 사용자가 close 클릭 후엔 query remain해도 재오픈 금지
+   useEffect(() => {
+     if (
+       searchParams?.get("auto-detect") === "1" &&
+       modal === null &&
+       !userClosedRef.current
+     ) {
+       setModal("join");
+     }
+   }, [searchParams, modal]);

    // ... 기존 코드 ...

-         <div className="modal-overlay" onClick={() => setModal(null)}>
+         <div
+           className="modal-overlay"
+           onClick={() => {
+             userClosedRef.current = true;
+             setModal(null);
+           }}
+         >
            <div
              className="modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="modal-close"
-               onClick={() => setModal(null)}
+               onClick={() => {
+                 userClosedRef.current = true;
+                 setModal(null);
+               }}
                aria-label="Close"
              >
                ×
              </button>
```

> ⚠️ `useSearchParams`는 Next.js 16.2.6 (`node_modules/next/dist/docs/` 사전 확인 의무 — AGENTS.md). App Router client component에서 사용 가능하나 Suspense boundary 또는 hydration 동작 사전 검증 필요.

---

## 위험 3축 평가 (헤비 권장)

| 축 | 충족 여부 | 근거 |
|----|-----------|------|
| ① 실패비용 ≥ 2h | **충족** | Invariant #3 (auto-detect 진입 회귀) 위반 시 production rollback + Vercel re-deploy + smoke test 재실행 = 2h+. `?auto-detect=1` 사용자가 modal 못 보면 핵심 UX 동선 차단. |
| ② 영향범위 | **충족** | 1 module (LandingApp.tsx) + production landing route (모든 진입자) + `?auto-detect=1` 쿼리 사용자. 단일 파일이나 진입 페이지 routing이라 blast radius 큼 |
| ③ 관찰가능성 | **부분** | modal 오픈 trigger는 즉시 시각적. 단 `userClosedRef` latch 누락 시 사용자가 close → URL remain → re-render 시 modal 재오픈하는 silent loop는 첫 1회만으론 발견 어려움 |

**점수: 2/3 충족 → /codex 교차 리뷰 강력 권장** (검증 분리 원칙 1순위 검증자). 헤비 작업으로 분류, S3.5 design phase 생략 가능(JSX 변경만), S7 design lint 생략 가능(시각 토큰 무변).

---

## Invariant 후보 (별 plan v1에서 확정)

### 기존 (folder-picker-ux 보존)

- **#3**: Auto-detect 카드 렌더 — `?auto-detect=1` 진입 시 modal 자동 오픈 + Path Preview Card 정상 표시

### 신규

- **#6**: Close 후 재오픈 0건 — 동일 세션 내 사용자가 close 클릭하면 query param 그대로여도 modal 재오픈 0건. `userClosedRef.current = true` latch가 SPA 세션 동안 유지

> ⚠️ **#6 한계 명시 (별 plan v1 의무 기재)**: `userClosedRef`는 React component state — **페이지 reload 시 reset**. 즉 사용자가 close → reload 시 modal 재오픈 발생. 이는 의도된 동작 (URL이 still `?auto-detect=1` → 새 세션이라 신규 trigger). 사용자가 영구 dismiss를 원하면 별 사이클에서 sessionStorage 검토.

---

## Scope / Non-scope

**Scope**:
- LandingApp.tsx 단일 파일 modification
- useEffect 1개 신규 (modal auto-open)
- useRef 1개 신규 (userClosedRef latch)
- 2곳 onClick handler에 latch set 추가 (overlay + close button)

**Non-scope**:
- Modal close 후 URL query 제거 (별 사이클, router.replace 검토 필요)
- sessionStorage 영구 dismiss (별 사이클, UX 정책 결정 필요)
- challenge modal 자동 오픈 (본 cycle은 `?auto-detect=1` ↔ `join` modal만)
- Hero/Nav/DropsSection/FinalCTA button 행동 변경
- JoinBurnIndexForm.tsx 변경 (autoDetect flag 동작 그대로)

---

## 진입 시점 + 검증 의무

### 진입 trigger

owner 별 세션 발화로 별 plan v1 작성 시작. 본 brief는 trigger 역할만, 실행 plan은 별도.

### 별 plan v1 작성 시 의무 (Codex Phase 1 적대적 검토 포함)

위험 3축 2/3 충족 → /codex Phase 1 적대적 검토 의무. 다음 5묶음 질문 사전 검토:

1. `useSearchParams`가 Next.js 16.2.6 client component에서 hydration mismatch 없이 동작하는가? Suspense boundary 의무 사항?
2. `userClosedRef`가 React StrictMode double-invoke 시 false positive(close 안 했는데 close로 latch)를 일으키지 않는가?
3. Hero/Nav onClick으로 modal 연 사용자가 close 시 latch가 set됨 — 그 사용자가 같은 세션에서 다시 URL `?auto-detect=1` 추가/재로딩 안 한 채 다른 entry로 modal 열려고 하면 정상 동작하는가? (onClick은 latch에 영향받지 않는가 — 본 brief는 useEffect만 latch 체크하므로 OK 추정, 검증 의무)
4. `searchParams.get("auto-detect") === "1"`만으론 부족, 다른 truthy 값(`"true"` / `""` / `"yes"`) 허용 여부? `JoinBurnIndexForm.tsx:67-73` 의 autoDetect flag 분기 로직과 일치 시켜야 (코드 anchor 사전 확인 의무)
5. Invariant #6 ("close 후 재오픈 0건")의 실측 방법 — Playwright e2e 또는 owner manual cell. Phase 6 cells에 추가할 항목

### 검증 4종 (별 plan v1 Phase 5 의무)

- `npx tsc --noEmit` exit 0
- `npx vitest run` 그린 (LandingApp 관련 테스트 영향 확인)
- `npm run build` 성공
- `grep -c COLLECTOR_HMAC_SECRET .next/static/chunks/*.js` = 0 (Invariant #1 본 cycle도 유지)

### Owner Happy Path Cells (별 plan v1 Phase 6 의무)

| # | 입력 | 기대 결과 |
|---|------|----------|
| 1 | `https://www.coconutlabs.xyz/?auto-detect=1` 진입 | Modal 자동 오픈 + Path Preview Card 표시 |
| 2 | 위 modal close 클릭 | Modal 닫힘, URL remain |
| 3 | 같은 탭에서 새로고침 없이 동일 페이지 anchor 클릭 또는 history 조작 | Modal 재오픈 0건 (latch 작동) |
| 4 | Same tab reload | Modal 다시 자동 오픈 (latch reset 정상) |
| 5 | `https://www.coconutlabs.xyz/` (쿼리 없이) | Modal 자동 오픈 안 함, 수동 클릭으로만 |
| 6 | Modal 안에서 picker 정상 완료 후 close → URL `?auto-detect=1` 추가 | Re-open behavior 명세 (별 plan v1에서 결정) |

---

## 추정 분량

단일 파일 + useRef latch + useEffect 1개 → **라이트~중급 작업**. S0~S6 압축 사이클 **1.5~2h** (S3.5 design phase 생략, S7 design lint 생략 — JSX 로직 변경만, 시각 토큰 무변).

---

## 관련 anchor

- 본 cycle 산출물: `tasks/folder-picker-ux/` (5종 산출물 + codex-phase{1,6,7,8}.md)
- Memory: [[project-folder-picker-ux-2026-05-22]] — 본 cycle의 패턴 (4 error 분기, count-based heuristic, kbd 시인성)
- Memory: [[project_auto-detect-flip-procedure]] — ON-flip 절차, UX iteration 1 anchor 포함
- Decision log: 2026-05-22 Folder picker UX — Approach B
- Plan: `~/.claude/plans/p1-rollout-lazy-trinket.md` Phase 8.2 (본 brief 작성 단계)
