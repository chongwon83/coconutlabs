# TIL — SWR Polling Can Break Playwright networkidle

Date: 2026-05-26

## Context

Track B B.3에서 Hero secondary stat bar를 실제 Burn Index aggregate data에 연결했다.

구현:

- `GET /api/burnindex/stats`
- client-side SWR polling
- refresh interval: 30초
- failed refresh 시 마지막 정상 stats 유지

이후 PR #25 첫 CI에서 `e2e`만 실패했다.

## Symptom

실패한 테스트는 새로 추가한 Hero stats 테스트가 아니라 기존 `e2e/preflight.spec.ts`의 viewport invariant였다.

실패 지점:

```ts
await page.reload({ waitUntil: "networkidle" });
```

에러:

```text
page.reload: Test timeout of 30000ms exceeded.
waiting for navigation until "networkidle"
navigated to "http://localhost:3002/"
```

페이지 snapshot상 DOM은 이미 정상 렌더링되어 있었다.

## Root Cause

`networkidle`은 "앱이 준비됨"을 뜻하지 않는다.

SWR polling, analytics, long-lived requests, streaming, background refresh가 있는 페이지에서는 네트워크가 완전히 조용해지는 순간이 테스트 기대와 어긋날 수 있다. B.3에서 Hero stats polling이 추가되면서 기존 preflight reload의 `networkidle` 대기가 CI/dev-mode에서 불안정한 readiness condition이 됐다.

## Fix

reload 자체는 CSS chunk 갱신 목적으로만 필요했다. 따라서 navigation readiness는 `load`로 좁히고, 실제 필요한 조건은 별도 assertion으로 검증했다.

Before:

```ts
await page.reload({ waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await expect(page.locator(".hero-right")).toHaveCSS("display", "flex");
```

After:

```ts
await page.reload({ waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
await expect(page.locator(".hero-right")).toHaveCSS("display", "flex");
```

## Lesson

Playwright에서 `networkidle`을 generic readiness signal로 쓰지 않는다.

대신 테스트가 실제로 보장해야 하는 조건을 직접 기다린다.

- navigation: `load` 또는 `domcontentloaded`
- font readiness: `document.fonts.ready`
- UI readiness: locator visibility/text/CSS assertion
- data readiness: API stub request count 또는 화면에 나타나는 값

## Result

수정 후:

- local `npx playwright test e2e/preflight.spec.ts`: 9 passed
- local `npx playwright test`: 42 passed
- PR #25 CI: all green
- latest `main` Production deployment: success

## Related Files

- `components/Hero.tsx`
- `components/LandingApp.tsx`
- `e2e/live-badge-polling.spec.ts`
- `e2e/preflight.spec.ts`
- `docs/handoff/2026-05-26-track-b-b3-complete.md`
