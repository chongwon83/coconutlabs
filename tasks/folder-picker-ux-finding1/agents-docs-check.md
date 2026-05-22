# AGENTS.md docs 사전 확인 — useSearchParams (Next.js 16.2.6)

**Date**: 2026-05-22
**Mandate**: `AGENTS.md` "Read the relevant guide in `node_modules/next/dist/docs/` before writing any code"

---

## 인용 (1차 anchor)

`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md`

- **L179** (production build 규칙): "During production builds, a static page that calls `useSearchParams` from a Client Component **must be wrapped in a `Suspense` boundary**, otherwise the build fails with the [Missing Suspense boundary with useSearchParams] error."
- **L82-84** (CSR bailout): "If a route is prerendered, calling `useSearchParams` will cause the Client Component tree up to the closest `Suspense` boundary to be client-side rendered."
- **L86**: "We recommend wrapping the Client Component that uses `useSearchParams` in a `<Suspense/>` boundary."
- **L178**: "In development, routes are rendered on-demand, so `useSearchParams` doesn't suspend and things may appear to work without `Suspense`."

---

## 결론

**Suspense boundary 의무 = TRUE**.

본 cycle은 production landing route (`app/page.tsx` 또는 `app/(landing)/page.tsx`)에 `useSearchParams`를 도입하므로:

1. 개발 환경(`npm run dev`)에서는 Suspense 없어도 동작 (오인 위험)
2. **production build (`npm run build`) 시 boundary 미적용 → 빌드 실패**
3. Boundary 적용 시 해당 client component subtree까지 CSR bailout — 나머지 page는 prerender 유지 가능

---

## 선택: Option A (자식 컴포넌트 분리)

parent plan Task C.6 Step 6 §Option A/B 중 **Option A** 선택. 사유:
- LandingApp 전체를 Suspense로 감싸는 Option B는 page-wide CSR bailout 위험 (자식 트리 전체가 client boundary로 들어감)
- Option A는 `AutoDetectListener` (또는 동등명) child component만 분리해서 Suspense로 wrap → 나머지 LandingApp 자식 SSR 콘텐츠 영향 최소
- google-labs docs L86 권장: "the Client Component that uses `useSearchParams`" 단위로 boundary 적용

구현 형태 (parent plan Task C.6 Step 6 §Option A 참조):

```tsx
function AutoDetectListener({ modal, setModal, userClosedRef }: Props) {
  const searchParams = useSearchParams();
  useEffect(() => {
    if (
      searchParams?.get("auto-detect") === "1" &&
      modal === null &&
      !userClosedRef.current
    ) {
      setModal("join");
    }
  }, [searchParams, modal]);
  return null;
}

export default function LandingApp() {
  // ... state
  return (
    <>
      <Suspense fallback={null}>
        <AutoDetectListener modal={modal} setModal={setModal} userClosedRef={userClosedRef} />
      </Suspense>
      {/* 기존 JSX */}
    </>
  );
}
```

---

## Next.js 16.2.6 Version History 확인

L380-382: `v13.0.0 | useSearchParams introduced.` → API 안정, breaking change 없음. 16.2.6에서도 docs 그대로 적용.
