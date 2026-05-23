// Track 1: Above-fold pixel measurement (Playwright SoT)
// One-shot script — Codex Track 1 권고 모두 반영
// - nav.height 동적 측정 (56 상수 X)
// - StatusBar 별도 측정
// - headline/sub/cta {height, top, bottom}
// - 4번째 요소 후보 침범 검증 (rect.top < viewport.height)
// - SHOW_LEGACY=false production copy assert
// - document.fonts.ready + rAF 2회

import { chromium } from "playwright";

const URL_BASE = "http://localhost:3000";
const VIEWPORT = { width: 375, height: 667 };

const PRODUCTION_SUB_COPY = "Get your burn score";

const FOURTH_ELEMENT_CANDIDATES = [
  { name: "hero-right (ProductShot)", selector: ".hero-right" },
  { name: "hero-eyebrow", selector: ".hero-eyebrow" },
  { name: "hero-chips", selector: ".hero-chips" },
  { name: "hero-secondary-card", selector: ".hero-secondary-card" },
  { name: "ticker", selector: '[class*="ticker"]' },
];

async function safeBox(locator) {
  try {
    if (await locator.count() === 0) return null;
    return await locator.first().boundingBox();
  } catch {
    return null;
  }
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();

  // animation/transition disable (frame-race 방지)
  await page.addInitScript(() => {
    const style = document.createElement("style");
    style.textContent = `*, *::before, *::after {
      animation: none !important;
      transition: none !important;
    }`;
    document.head.appendChild(style);
  });

  await page.goto(URL_BASE, { waitUntil: "domcontentloaded" });

  // font swap 안정화 + 2 rAF (paint stabilize)
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(
    () =>
      new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(r)),
      ),
  );

  // SHOW_LEGACY=false production copy assert
  const subText = await page.locator(".hero-sub").first().textContent();
  const isProductionCopy = subText?.includes(PRODUCTION_SUB_COPY) ?? false;

  // nav/status 동적 측정
  const navBox = await safeBox(page.locator("nav.nav-v3"));
  const statusBarBox = await safeBox(
    page.locator('[class*="status-bar"], [class*="StatusBar"]'),
  );

  // 3 핵심 elements (hero 내부 스코프로 한정 — Nav의 Join 버튼 회피)
  const headlineBox = await safeBox(page.locator(".hero-headline"));
  const subBox = await safeBox(page.locator(".hero-sub"));
  const ctaBox = await safeBox(page.locator(".hero-actions button").first());

  // 4번째 요소 침범 후보
  const fourthCandidates = {};
  for (const c of FOURTH_ELEMENT_CANDIDATES) {
    const box = await safeBox(page.locator(c.selector));
    fourthCandidates[c.name] = box
      ? {
          ...box,
          enters_fold: box.y < VIEWPORT.height,
          rect_top: box.y,
        }
      : null;
  }

  // 화면 캡처 (참고용)
  await page.screenshot({
    path: "/tmp/fold-375.png",
    clip: { x: 0, y: 0, width: VIEWPORT.width, height: VIEWPORT.height },
  });

  // Gate 판정
  const navH = navBox?.height ?? 0;
  const statusH = statusBarBox?.height ?? 0;
  const adjustedFold = VIEWPORT.height - navH - statusH;

  const ctaBottom = ctaBox ? ctaBox.y + ctaBox.height : null;
  const headlineHeight = headlineBox?.height ?? null;
  const subHeight = subBox?.height ?? null;
  const ctaHeight = ctaBox?.height ?? null;

  const sum3 =
    headlineHeight && subHeight && ctaHeight
      ? headlineHeight + subHeight + ctaHeight
      : null;

  const fourthInvasions = Object.entries(fourthCandidates)
    .filter(([, v]) => v && v.enters_fold)
    .map(([k, v]) => ({ name: k, top: v.rect_top }));

  const ctaInFold = ctaBottom != null && ctaBottom <= VIEWPORT.height;
  const ctaInAdjustedFold = ctaBottom != null && ctaBottom <= adjustedFold;

  const report = {
    meta: {
      viewport: VIEWPORT,
      url: URL_BASE,
      timestamp: new Date().toISOString(),
      show_legacy_assert: {
        sub_text: subText,
        is_production_copy: isProductionCopy,
      },
    },
    chrome: {
      nav_height: navH,
      statusbar_height: statusH,
      adjusted_fold_height: adjustedFold,
      naive_fold_667_minus_56: VIEWPORT.height - 56,
    },
    elements: {
      headline: headlineBox,
      sub: subBox,
      cta: ctaBox,
    },
    metrics: {
      sum_3_elements_height: sum3,
      cta_bottom: ctaBottom,
      cta_in_naive_fold_667: ctaInFold,
      cta_in_adjusted_fold: ctaInAdjustedFold,
    },
    fourth_element_candidates: fourthCandidates,
    fourth_element_invasions: fourthInvasions,
    gate_judgment: {
      sum_3_le_611: sum3 != null ? sum3 <= 611 : null,
      cta_bottom_le_667: ctaInFold,
      cta_bottom_le_adjusted: ctaInAdjustedFold,
      no_4th_invasion: fourthInvasions.length === 0,
      verdict:
        ctaInAdjustedFold && fourthInvasions.length === 0
          ? "GATE_A_FIT"
          : "GATE_B_OVERFLOW",
    },
  };

  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
