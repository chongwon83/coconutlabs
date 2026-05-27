// burn-index-models-redesign.test.ts — MODELS column helper unit tests.
//
// Guards the vertical mini-chip stack helpers added 2026-05-27:
//   modelFamily()       — maps chip label to a CSS dot color class
//   visibleModelChips() — top-N by cost share, pct=0 dropped
//   shortenModelName()  — "unknown" → "legacy" + existing model shortcuts
//
// These are pure functions so no DOM/render needed.

import { describe, it, expect } from "vitest";

// Inline the helpers under test.

function modelFamily(label: string): string {
  const l = label.toLowerCase();
  if (l === "legacy") return "legacy";
  if (l.startsWith("opus")) return "opus";
  if (l.startsWith("sonnet")) return "sonnet";
  if (l.startsWith("haiku")) return "haiku";
  if (l.startsWith("gpt")) return "gpt";
  if (l.startsWith("codex")) return "codex";
  return "other";
}

function visibleModelChips(chips: { label: string; pct: number }[], max: number) {
  return chips.filter((c) => c.pct > 0).slice(0, max);
}

function shortenModelName(model: string): string {
  if (model === "unknown") return "legacy";
  if (model.includes("opus-4-7")) return "opus 4.7";
  if (model.includes("opus-4-5")) return "opus 4.5";
  if (model.includes("sonnet-4-6")) return "sonnet 4.6";
  if (model.includes("sonnet-4-5")) return "sonnet 4.5";
  if (model.includes("haiku-4-5")) return "haiku 4.5";
  if (model.includes("gpt-5.5") || model.includes("gpt-5-codex")) return "gpt-5.5";
  if (model.includes("codex-mini")) return "codex-mini";
  return model;
}

// topModelsChips inlined (same logic as component).
function topModelsChips(
  breakdown: { tool: string; model: string; totalTokens: number; estimatedCostUsd: number }[],
  max = 2,
): { label: string; pct: number }[] {
  if (breakdown.length === 0) return [];
  const total = breakdown.reduce((acc, b) => acc + b.estimatedCostUsd, 0);
  if (total === 0) return [];
  const sorted = [...breakdown].sort((a, b) => b.estimatedCostUsd - a.estimatedCostUsd);
  const top = sorted.slice(0, max).map((b) => ({
    label: shortenModelName(b.model),
    pct: Math.round((b.estimatedCostUsd / total) * 100),
  }));
  const remaining = sorted.length - max;
  if (remaining > 0) top.push({ label: `+${remaining}`, pct: 0 });
  return top;
}

describe("modelFamily", () => {
  it("maps opus prefix to opus", () => expect(modelFamily("opus 4.7")).toBe("opus"));
  it("maps sonnet prefix to sonnet", () => expect(modelFamily("sonnet 4.6")).toBe("sonnet"));
  it("maps haiku prefix to haiku", () => expect(modelFamily("haiku 4.5")).toBe("haiku"));
  it("maps gpt prefix to gpt", () => expect(modelFamily("gpt-5.5")).toBe("gpt"));
  it("maps codex prefix to codex", () => expect(modelFamily("codex-mini")).toBe("codex"));
  it("maps 'legacy' to legacy", () => expect(modelFamily("legacy")).toBe("legacy"));
  it("maps unknown prefix to other", () => expect(modelFamily("claude-3-opus")).toBe("other"));
});

describe("visibleModelChips", () => {
  const chips = [
    { label: "sonnet 4.6", pct: 65 },
    { label: "haiku 4.5", pct: 30 },
    { label: "opus 4.7", pct: 5 },
    { label: "+1", pct: 0 },
  ];

  it("returns top N with pct>0", () => {
    const result = visibleModelChips(chips, 3);
    expect(result).toHaveLength(3);
    expect(result.map((c) => c.label)).toEqual(["sonnet 4.6", "haiku 4.5", "opus 4.7"]);
  });

  it("drops pct=0 overflow chip", () => {
    const result = visibleModelChips(chips, 4);
    expect(result).toHaveLength(3); // "+1" pct=0 dropped
  });

  it("max=2 returns only top 2", () => {
    const result = visibleModelChips(chips, 2);
    expect(result).toHaveLength(2);
  });
});

describe("shortenModelName", () => {
  it("converts unknown to legacy (backfilled rows)", () => {
    expect(shortenModelName("unknown")).toBe("legacy");
  });
  it("shortens claude sonnet-4-6", () => {
    expect(shortenModelName("claude-sonnet-4-6-20251022")).toBe("sonnet 4.6");
  });
  it("passes through unrecognized model", () => {
    expect(shortenModelName("my-custom-model")).toBe("my-custom-model");
  });
});

describe("topModelsChips — legacy chip surfaces for backfilled rows", () => {
  it("breakdown with model:unknown → chip label becomes legacy", () => {
    const breakdown = [
      { tool: "claude-code" as const, model: "unknown", totalTokens: 500_000, estimatedCostUsd: 5.0 },
    ];
    const chips = topModelsChips(breakdown, 2);
    expect(chips[0].label).toBe("legacy");
    expect(chips[0].pct).toBe(100);
  });

  it("empty breakdown → returns empty array (renders — in MODELS cell)", () => {
    expect(topModelsChips([], 2)).toHaveLength(0);
  });

  it("overflow chip present when breakdown exceeds max", () => {
    const breakdown = [
      { tool: "claude-code" as const, model: "claude-opus-4-7", totalTokens: 300_000, estimatedCostUsd: 3.0 },
      { tool: "claude-code" as const, model: "claude-sonnet-4-6-20251022", totalTokens: 200_000, estimatedCostUsd: 2.0 },
      { tool: "claude-code" as const, model: "claude-haiku-4-5-20251001", totalTokens: 100_000, estimatedCostUsd: 1.0 },
    ];
    const chips = topModelsChips(breakdown, 2);
    expect(chips).toHaveLength(3); // top-2 + "+1" overflow
    expect(chips[2].label).toBe("+1");
    expect(chips[2].pct).toBe(0);
  });
});
