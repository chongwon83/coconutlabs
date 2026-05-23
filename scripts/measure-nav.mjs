import { chromium } from 'playwright';

const VIEWPORTS = [
  { name: '375',  width: 375,  height: 667 },
  { name: '390',  width: 390,  height: 844 },
  { name: '430',  width: 430,  height: 932 },
  { name: '767',  width: 767,  height: 900 },
  { name: '768',  width: 768,  height: 900 },
  { name: '920',  width: 920,  height: 900 },
  { name: '921',  width: 921,  height: 900 },
  { name: '1024', width: 1024, height: 900 },
  { name: '1280', width: 1280, height: 900 },
];

const TOLERANCE = 0.5;

(async () => {
  const browser = await chromium.launch();
  const results = {};

  for (const v of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: v.width, height: v.height }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();

    await page.addInitScript(() => {
      const style = document.createElement('style');
      style.textContent = `*,*::before,*::after { animation: none !important; transition: none !important; }`;
      document.head.appendChild(style);
    });

    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);

    // header rect
    const header = await page.locator('nav.nav-v3').boundingBox();

    // logo / tagline / nav-links container / each nav-link / cta
    const logo = await page.locator('.nav-logo').boundingBox();
    const tagline = await page.locator('.nav-tagline').boundingBox();
    const navLinksContainer = await page.locator('.nav-links').boundingBox();
    const navLinkCount = await page.locator('.nav-links .nav-link').count();
    const navLinks = [];
    for (let i = 0; i < navLinkCount; i++) {
      const link = await page.locator('.nav-links .nav-link').nth(i);
      const text = await link.innerText();
      const box = await link.boundingBox();
      const lineHeightCheck = await link.evaluate(el => {
        const cs = getComputedStyle(el);
        return {
          lineHeight: parseFloat(cs.lineHeight) || 0,
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
          rectHeight: el.getBoundingClientRect().height,
        };
      });
      navLinks.push({ text, box, ...lineHeightCheck });
    }

    // CTA "Join Burn Index" in nav-actions (ghost button, sm)
    const cta = await page.locator('nav.nav-v3 button:has-text("Join Burn Index")').boundingBox();

    // wrap detection: scrollWidth > clientWidth OR rectHeight > lineHeight * 1.25
    const wrapResults = navLinks.map(nl => ({
      text: nl.text,
      wrapped:
        (nl.scrollWidth > nl.clientWidth + 0.5) ||
        (nl.lineHeight > 0 && nl.rectHeight > nl.lineHeight * 1.25),
      scrollWidth: nl.scrollWidth,
      clientWidth: nl.clientWidth,
      rectHeight: nl.rectHeight,
      lineHeight: nl.lineHeight,
    }));

    // overlap detection: navLinksContainer.right vs cta.left (horizontal)
    let overlap = null;
    if (navLinksContainer && cta) {
      const navRight = navLinksContainer.x + navLinksContainer.width;
      const ctaLeft = cta.x;
      const gap = ctaLeft - navRight;
      overlap = { navRight, ctaLeft, gap, overlapping: gap < -TOLERANCE };
    }

    // logo/tagline/nav-links/cta pair-wise horizontal overlap check
    const rects = { logo, tagline, navLinksContainer, cta };
    const rectKeys = Object.keys(rects).filter(k => rects[k]);
    const pairOverlaps = [];
    for (let i = 0; i < rectKeys.length; i++) {
      for (let j = i + 1; j < rectKeys.length; j++) {
        const a = rects[rectKeys[i]], b = rects[rectKeys[j]];
        const aRight = a.x + a.width, bRight = b.x + b.width;
        const horizontalOverlap = !(aRight <= b.x + TOLERANCE || bRight <= a.x + TOLERANCE);
        if (horizontalOverlap) pairOverlaps.push({ a: rectKeys[i], b: rectKeys[j] });
      }
    }

    results[v.name] = {
      viewport: { width: v.width, height: v.height },
      header,
      logo,
      tagline,
      navLinksContainer,
      navLinkCount,
      navLinks: wrapResults,
      cta,
      overlap,
      pairOverlaps,
      verdict: {
        anyWrap: wrapResults.some(w => w.wrapped),
        anyOverlap: overlap?.overlapping || pairOverlaps.length > 0,
      },
    };

    await page.screenshot({
      path: `/tmp/nav-${v.name}.png`,
      clip: { x: 0, y: 0, width: v.width, height: Math.min(80, v.height) },
    });

    await ctx.close();
  }

  console.log(JSON.stringify(results, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
