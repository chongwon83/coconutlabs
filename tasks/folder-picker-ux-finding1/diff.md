# Diff — folder-picker-ux-finding1 (2026-05-22)

## 변경 파일

- `components/LandingApp.tsx`: +60 / -6 (`git diff --stat` 기준)

## 변경 의도

`?auto-detect=1` URL 쿼리 진입 시 modal 자동 오픈. 사용자 close 후 동일 세션 재오픈 차단 (Invariant #6).

## 핵심 변경 항목

1. **import 확장**
   - `useRef`, `Suspense`, `Dispatch`, `MutableRefObject`, `SetStateAction` (`react`)
   - `useSearchParams` (`next/navigation`)

2. **타입 alias** `ModalKind = "join" | "challenge" | null` 추출

3. **`AutoDetectListener` 자식 컴포넌트 (신규)**
   - `useSearchParams` 격리 → Suspense boundary 범위를 listener subtree만으로 제한
   - useEffect: `searchParams?.get("auto-detect") === "1" && modal === null && !userClosedRef.current` 3중 가드 후 `setModal("join")`
   - return null (DOM 렌더 0)

4. **`LandingApp` 컴포넌트 신규 hook**
   - `userClosedRef = useRef<boolean>(false)` — Invariant #6 latch
   - `closeModal = useCallback(() => { userClosedRef.current = true; setModal(null); }, [])` — 단일 close path

5. **close 경로 통일 (3곳 → closeModal)**
   - L45 `showToast` 내부 `setModal(null)` → `closeModal()` (dep `[closeModal]` 추가)
   - L89 modal-overlay onClick `() => setModal(null)` → `closeModal`
   - L96 modal-close button onClick `() => setModal(null)` → `closeModal`

6. **JSX 추가**
   - `<Suspense fallback={null}><AutoDetectListener .../></Suspense>` (StatusBar 위에 배치)

## diff hunks (요약)

```
@@ imports (+11/-1)            type alias + listener + 신규 hook 추가
@@ useState type alias 분리    no behavior change
@@ closeModal 신규 + showToast  setModal(null) → closeModal()
@@ JSX <Suspense>              listener 마운트
@@ overlay/close button        () => setModal(null) → closeModal
```

## 영향 범위

- `/` route prerender 상태 ○ Static 유지 (build 출력 확인) — Suspense Option A 효과
- 기존 244 vitest 회귀 0 (234/234 PASS)
- TypeScript strict EXIT 0
- 새 의존성 0 (모두 기존 next/react export)
