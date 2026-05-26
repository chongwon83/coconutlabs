# TIL — CSS marquee의 offscreen-start pattern은 `prefers-reduced-motion`에서 silent blank를 만든다

Date: 2026-05-26
Project: coconutlabs Track B B.5 micro interactions

## 무엇을 배웠나

`@media (prefers-reduced-motion: reduce)` 블록에서 marquee/ticker 류의 무한 애니메이션을 끄려고 `animation: none !important;`만 적용하면, 콘텐츠가 영구 공백 상태가 될 수 있다. 그러면 **원래의 a11y 부채(animation으로 어지러움)보다 더 나쁜 상태**(아무것도 안 보임)가 된다.

원인은 marquee가 흔히 쓰는 **offscreen-start pattern**이다.

```css
/* CSS marquee의 흔한 패턴 */
.ticker-track {
  padding-left: 100%;           /* content를 viewport 바깥에서 시작 */
  animation: ticker 60s linear infinite;
}

@keyframes ticker {
  from { transform: translateX(0); }
  to   { transform: translateX(-100%); }
}
```

여기서 `animation`을 끄면 `padding-left: 100%`가 그대로 남아 모든 자식이 viewport 우측 밖에 잠긴다. transform도 마찬가지로 keyframe 첫 프레임이 적용되지 않으니 의도된 시작 위치가 아니다.

## 잘못 한 것

B.5 첫 패스에서 다음과 같이만 작성했다:

```css
@media (prefers-reduced-motion: reduce) {
  .product-shot-dot,
  .ticker-inner,
  .ticker-track,
  .lb-v3-foot .left .pulse {
    animation: none !important;
  }
}
```

코덱스(`/codex` default gpt-5.5) review 결과: **REVISE** — "ticker strip이 영구 공백이 된다, 원래 부채보다 나쁘다".

## 올바른 처리

reduced-motion 블록 안에서 animation만 끄지 말고 **layout도 정적 상태로 재설정**한다.

```css
@media (prefers-reduced-motion: reduce) {
  .product-shot-dot,
  .ticker-inner,
  .ticker-track,
  /* …other animated dots… */ {
    animation: none !important;
  }

  /* Ticker carriers start offscreen via padding-left:100% and rely on
     the keyframe to scroll content into view. Without the animation,
     content sits permanently offscreen — worse than the original debt.
     Static-layout override keeps the first items visible. */
  .ticker-inner,
  .ticker-track {
    padding-left: 0 !important;
    transform: none !important;
  }
}
```

## Regression guard

`animation-name === "none"`만 검증하면 이 함정을 못 잡는다. 실제로 viewport 안에 첫 자식이 들어 있는지 boundingBox로 같이 검사해야 한다.

`e2e/hero-pulse.spec.ts`:

```ts
test("reduced-motion: ticker content stays in viewport", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await awaitFonts(page);
  const ticker = page.locator(".ticker-track").first();

  const computed = await ticker.evaluate((el) => {
    const cs = window.getComputedStyle(el);
    return { paddingLeft: cs.paddingLeft, transform: cs.transform };
  });
  expect(computed.paddingLeft).toBe("0px");
  expect(computed.transform).toBe("none");

  const firstItem = ticker.locator(":scope > *").first();
  await expect(firstItem).toBeVisible();
  const box = await firstItem.boundingBox();
  const viewport = page.viewportSize();
  expect(box.x).toBeLessThan(viewport.width);
  expect(box.x + box.width).toBeGreaterThan(0);
});
```

## 일반화

CSS animation은 종종 *layout 역할*도 한다 — 시작 프레임이 정적 위치를 정의하는 경우. animation을 끌 때 layout 역할도 같이 끄는지 한 번 더 점검해야 한다. 체크리스트:

1. animation이 transform/translate으로 큰 변위를 만드는가? → 정지 시점에 그 변위가 정적 layout으로 보이는가?
2. 시작 프레임이 viewport 바깥인가? → animation이 없는 frame은 어디서 시작하는가?
3. opacity 같은 visibility 속성을 keyframe이 제어하는가? → animation 없을 때 자연 상태는 visible/invisible 중 어느 쪽인가?

## 부수적 발견

Visual baseline rebaseline은 **CSS-only motion 변경에서는 보통 불필요**.

이번 작업은 plan 단계에서 "snapshots capture mid-animation pixels → rebaseline 필요"로 가정했지만, `gh workflow run "Visual baseline lock (one-shot)" --ref track-b/b5-micro-interactions` 결과 PNG sha256이 committed baseline과 byte-identical이었다. Playwright `playwright.config.visual.ts`가 capture 시점에 animation을 disable하기 때문. 단 transform translate로 큰 layout 변위를 만드는 motion은 여전히 capture에 잡힐 수 있어 케이스별 확인 필요.

## 참고

- B.5 PR: https://github.com/chongwon83/coconutlabs/pull/28
- Plan: `~/.claude/plans/linear-crunching-star.md`
- Codex REVISE 후 APPROVE 받은 final diff: commit `883b2d8` on main
- E2E regression guard: `e2e/hero-pulse.spec.ts` test #4
