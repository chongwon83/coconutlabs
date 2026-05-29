// pricing-table-sync.test.ts — CI guard for the 3-layer pricing table.
//
// The pricing table lives in THREE places that must stay in sync, all by hand:
//   1. tools/usage-poc/model-pricing.json            — source of truth
//   2. tools/usage-poc/coconut_collector/             — package copy read by the
//      model-pricing.json                               Python collector at runtime
//   3. lib/client/burn/pricing.generated.ts          — codegen output read by the
//                                                        browser-side TS collector
//
// A drift between any two ships a cost-estimation bug silently: the Python and
// browser collectors would price the same model differently, which moves the VES
// denominator. Until now sync was verified by hand (shasum + re-run codegen +
// `git diff`); this test automates that check so a forgotten copy or a stale
// regen fails CI instead of reaching prod. See decision-log 2026-05-29 (VES
// denominator accuracy) S10 retro.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { MODEL_PRICING, PRICING_AS_OF } from "@/lib/client/burn/pricing.generated";

const SRC_PATH = new URL("../tools/usage-poc/model-pricing.json", import.meta.url);
const PKG_COPY_PATH = new URL(
  "../tools/usage-poc/coconut_collector/model-pricing.json",
  import.meta.url,
);

// Mirrors pickPricing() in scripts/codegen-pricing.mjs: keep model rows and the
// explicit `_default`, drop the leading-underscore meta keys (_pricing_as_of,
// _note, _match, _source). Any divergence from that filter is itself a drift.
function stripMeta(section: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(section).filter(([k]) => !k.startsWith("_") || k === "_default"),
  );
}

describe("pricing table — 3-layer sync guard", () => {
  it("keeps the source JSON and the packaged copy byte-identical", () => {
    // The Python collector reads the packaged copy via importlib.resources; if it
    // drifts from the source the browser (codegen'd from source) and Python price
    // differently. Raw-string compare so even a whitespace/ordering edit is caught.
    const src = readFileSync(SRC_PATH, "utf-8");
    const pkgCopy = readFileSync(PKG_COPY_PATH, "utf-8");
    expect(
      pkgCopy,
      "tools/usage-poc/coconut_collector/model-pricing.json is out of sync with " +
        "the source tools/usage-poc/model-pricing.json — re-copy it (they must be " +
        "byte-identical).",
    ).toBe(src);
  });

  it("keeps pricing.generated.ts in sync with the source JSON (no stale codegen)", () => {
    // Asserts the committed generated table reflects the current source JSON. If
    // this fails, the JSON was edited without re-running the codegen — fix with:
    //   node scripts/codegen-pricing.mjs
    const raw = JSON.parse(readFileSync(SRC_PATH, "utf-8"));

    expect(
      PRICING_AS_OF,
      "PRICING_AS_OF in pricing.generated.ts is stale — re-run " +
        "`node scripts/codegen-pricing.mjs`.",
    ).toBe(raw._pricing_as_of);

    expect(
      MODEL_PRICING.claude,
      "claude pricing in pricing.generated.ts is stale — re-run " +
        "`node scripts/codegen-pricing.mjs`.",
    ).toEqual(stripMeta(raw.claude));

    expect(
      MODEL_PRICING.codex,
      "codex pricing in pricing.generated.ts is stale — re-run " +
        "`node scripts/codegen-pricing.mjs`.",
    ).toEqual(stripMeta(raw.codex));
  });
});
