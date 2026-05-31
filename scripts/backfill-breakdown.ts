#!/usr/bin/env tsx
// scripts/backfill-breakdown.ts — one-time Redis backfill for legacy entries.
//
// Pre-B-cycle imports (before 2026-05-25) have breakdown:[] and toolsUsed
// tagging a single tool. This script synthesises a 1-row (single-tool) or
// 2-row 50/50 (multi-tool) breakdown so the leaderboard can slice tokens/cost
// by tool filter and show model chips without relying on the render fallback.
//
// The model field is always "unknown" — we have no per-model data for these
// envelopes. The shortenModelName mapping in BurnIndexSection renders "unknown"
// as "legacy", making the provenance visible in the UI.
//
// USAGE:
//   pnpm tsx web/scripts/backfill-breakdown.ts --dry-run
//   pnpm tsx web/scripts/backfill-breakdown.ts --snapshot ./tmp/pre-backfill.json
//   BACKFILL_APPROVED=1 pnpm tsx web/scripts/backfill-breakdown.ts --apply
//   pnpm tsx web/scripts/backfill-breakdown.ts --restore ./tmp/pre-backfill.json
//
// APPROVAL GATE: --apply requires BACKFILL_APPROVED=1 in the shell env (NOT .env).
//
// CLAIM-BYPASS GATE (A4, post-PR2): --apply and --restore HSET burn:leaderboard
//   directly, bypassing the canonical-key + claim system. They refuse unless
//   ALLOW_CLAIM_BYPASS=1 (shell env). A --restore of a pre-migration snapshot
//   resurrects raw split rows; AFTER it, re-run migrate-legacy-locks.ts --apply
//   to re-collapse them (do NOT feed this FLAT snapshot to migrate-legacy-
//   locks.ts --restore — it expects a different shape and would del+crash). This
//   gate exists so that footgun is never silent.
//
// ROLLBACK: --restore writes the snapshot file back to Redis. Keep the snapshot
//           until the on-call window closes (typically 48h after backfill).
//
// IDEMPOTENT: --apply skips entries that already have breakdown data.

import { Redis } from "@upstash/redis";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";

// --- Types (mirrors lib/data.ts, inlined to avoid Next.js path resolution) ---

type ToolId = "claude-code" | "codex";

interface ImportedEntryBreakdown {
  tool: ToolId;
  model: string;
  totalTokens: number;
  estimatedCostUsd: number;
}

interface ImportedEntry {
  handle: string;
  breakdown: ImportedEntryBreakdown[];
  toolsUsed: ToolId[];
  totalTokens: number;
  estimatedCostUsd: number;
  [key: string]: unknown;
}

// --- Redis client ---

function makeRedis(): Redis {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error(
      "Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN. " +
        "Load .env.local before running: source .env.local",
    );
  }
  return new Redis({ url, token });
}

const LEADERBOARD_KEY = "burn:leaderboard";

// Inline mirror of lib/server/handle.ts canonicalHandle — kept self-contained
// (this script deliberately inlines its types to avoid Next.js path resolution).
// Strips leading @(s), trims, lowercases, validates the GitHub-ish charset.
const CANONICAL_HANDLE_RE = /^[a-z0-9](?:[a-z0-9-]{0,38})$/;
function canonicalHandle(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const stripped = raw.trim().replace(/^@+/, "").toLowerCase();
  return CANONICAL_HANDLE_RE.test(stripped) ? stripped : null;
}

// A4 guard: every write path here HSETs burn:leaderboard directly, bypassing the
// canonical-key + claim system added in PR2 (route claimAndUpsert). Post-PR2
// this is dangerous — a --restore of a PRE-migration snapshot resurrects raw
// split rows (@Foo alongside canonical foo), undoing migrate-legacy-locks; any
// write lands past the claim gate with no token check. Refuse unless the
// operator sets ALLOW_CLAIM_BYPASS=1 (shell env, NOT .env) after reading this.
function requireClaimBypass(command: string): void {
  if (process.env.ALLOW_CLAIM_BYPASS === "1") {
    console.warn(
      `[backfill] ⚠ ALLOW_CLAIM_BYPASS=1 — ${command} writing past the PR2 ` +
        `claim/canonical system. You own the canonical-key + claim consequences.`,
    );
    return;
  }
  console.error(
    [
      `[backfill] BLOCKED: ${command} bypasses the PR2 claim + canonical-key system.`,
      "  • --restore of a pre-migration snapshot resurrects raw split rows",
      "    (@Foo beside canonical foo) and undoes migrate-legacy-locks.",
      "  • any write lands past the claim gate (no token verification).",
      "  After a pre-migration --restore, re-run migrate-legacy-locks.ts --apply to re-collapse",
      "  (do NOT pass this flat snapshot to migrate-legacy-locks.ts --restore — different shape).",
      "  Set ALLOW_CLAIM_BYPASS=1 in your shell (NOT .env) only if you understand this.",
    ].join("\n"),
  );
  process.exit(1);
}

// --- Core synthesis logic (mirrors backfill-breakdown.test.ts) ---

type BackfillResult =
  | { action: "skip"; reason: string }
  | { action: "patch"; breakdown: ImportedEntryBreakdown[] };

function synthesizeBreakdown(e: ImportedEntry): BackfillResult {
  if (e.breakdown.length > 0) return { action: "skip", reason: "already has breakdown" };
  if (e.toolsUsed.length === 0) return { action: "skip", reason: "no toolsUsed signal" };

  if (e.toolsUsed.length === 1) {
    return {
      action: "patch",
      breakdown: [
        {
          tool: e.toolsUsed[0],
          model: "unknown",
          totalTokens: e.totalTokens,
          estimatedCostUsd: e.estimatedCostUsd,
        },
      ],
    };
  }

  const tokenHalf = Math.floor(e.totalTokens / 2);
  const costHalf = e.estimatedCostUsd / 2;
  return {
    action: "patch",
    breakdown: e.toolsUsed.map((tool, i) => ({
      tool,
      model: "unknown",
      totalTokens: i === 0 ? e.totalTokens - tokenHalf : tokenHalf,
      estimatedCostUsd: costHalf,
    })),
  };
}

// --- Commands ---

async function fetchAll(redis: Redis): Promise<Record<string, ImportedEntry>> {
  const raw = await redis.hgetall<Record<string, string>>(LEADERBOARD_KEY);
  if (!raw) return {};
  const out: Record<string, ImportedEntry> = {};
  for (const [handle, blob] of Object.entries(raw)) {
    try {
      const e = typeof blob === "string" ? JSON.parse(blob) : blob;
      out[handle] = {
        ...e,
        breakdown: Array.isArray(e.breakdown) ? e.breakdown : [],
        toolsUsed: Array.isArray(e.toolsUsed) ? e.toolsUsed : [],
      } as ImportedEntry;
    } catch {
      console.warn(`[backfill] skipping malformed entry: ${handle}`);
    }
  }
  return out;
}

async function dryRun(): Promise<void> {
  console.log("[backfill] DRY-RUN — no writes will occur\n");
  const redis = makeRedis();
  const entries = await fetchAll(redis);
  let wouldPatch = 0;
  let wouldSkip = 0;
  for (const [handle, e] of Object.entries(entries)) {
    const result = synthesizeBreakdown(e);
    if (result.action === "skip") {
      wouldSkip++;
      console.log(`  SKIP  ${handle}  (${result.reason})`);
    } else {
      wouldPatch++;
      console.log(`  PATCH ${handle}`);
      console.log(`        before: breakdown=[] toolsUsed=${JSON.stringify(e.toolsUsed)}`);
      console.log(`        after:  ${JSON.stringify(result.breakdown, null, 0)}`);
    }
  }
  console.log(`\n[backfill] dry-run summary: ${wouldPatch} would be patched, ${wouldSkip} skipped`);
}

async function snapshot(outPath: string): Promise<void> {
  const absPath = resolve(outPath);
  mkdirSync(dirname(absPath), { recursive: true });
  const redis = makeRedis();
  const raw = await redis.hgetall<Record<string, string>>(LEADERBOARD_KEY);
  writeFileSync(absPath, JSON.stringify(raw ?? {}, null, 2), "utf-8");
  console.log(`[backfill] snapshot written → ${absPath}`);
}

async function apply(): Promise<void> {
  if (process.env.BACKFILL_APPROVED !== "1") {
    console.error(
      "[backfill] BLOCKED: set BACKFILL_APPROVED=1 in your shell (NOT .env) after reviewing --dry-run output",
    );
    process.exit(1);
  }
  requireClaimBypass("--apply");

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const logPath = resolve(`./tmp/backfill-${ts}.log`);
  mkdirSync(resolve("./tmp"), { recursive: true });

  const redis = makeRedis();
  const entries = await fetchAll(redis);
  const log: string[] = [];
  let patched = 0;
  let skipped = 0;

  for (const [handle, e] of Object.entries(entries)) {
    const result = synthesizeBreakdown(e);
    if (result.action === "skip") {
      skipped++;
      continue;
    }
    const updated: ImportedEntry = { ...e, breakdown: result.breakdown };
    await redis.hset(LEADERBOARD_KEY, { [handle]: JSON.stringify(updated) });
    const msg = `PATCHED ${handle} breakdown=${JSON.stringify(result.breakdown)}`;
    log.push(msg);
    console.log(`  ${msg}`);
    patched++;
  }

  writeFileSync(logPath, log.join("\n") + "\n", "utf-8");
  console.log(`\n[backfill] applied: ${patched} patched, ${skipped} skipped. Log → ${logPath}`);
}

async function restore(snapshotPath: string): Promise<void> {
  const absPath = resolve(snapshotPath);
  const raw: Record<string, string> = JSON.parse(readFileSync(absPath, "utf-8"));

  // Surface the resurrection risk BEFORE the bypass gate: how many snapshot keys
  // are non-canonical (raw aliases the migration would have collapsed). The gate
  // then refuses unless ALLOW_CLAIM_BYPASS=1.
  const nonCanonical = Object.keys(raw).filter((k) => canonicalHandle(k) !== k);
  if (nonCanonical.length > 0) {
    console.warn(
      `[backfill] ⚠ snapshot has ${nonCanonical.length} non-canonical key(s) ` +
        `(e.g. ${nonCanonical.slice(0, 3).join(", ")}). Restoring re-introduces ` +
        `raw split rows that migrate-legacy-locks collapsed. AFTER this restore, ` +
        `re-run \`migrate-legacy-locks.ts --apply\` to re-collapse them. Do NOT pass ` +
        `this FLAT {handle:blob} snapshot to migrate-legacy-locks.ts --restore — it ` +
        `expects a rich {leaderboard,claims,hist} shape and would del+crash.`,
    );
  }
  requireClaimBypass("--restore");

  const redis = makeRedis();
  // Merge-restore: HSET overwrites snapshot handles without DEL so entries
  // submitted after the snapshot are preserved (not lost). Codex P2 fix.
  if (Object.keys(raw).length > 0) {
    await redis.hset(LEADERBOARD_KEY, raw);
  }
  console.log(
    `[backfill] restored ${Object.keys(raw).length} entries from ${absPath}`,
  );
}

// --- CLI entry ---

const [, , cmd, arg] = process.argv;

(async () => {
  switch (cmd) {
    case "--dry-run":
      await dryRun();
      break;
    case "--snapshot":
      if (!arg) { console.error("Usage: --snapshot <path>"); process.exit(1); }
      await snapshot(arg);
      break;
    case "--apply":
      await apply();
      break;
    case "--restore":
      if (!arg) { console.error("Usage: --restore <snapshot-path>"); process.exit(1); }
      await restore(arg);
      break;
    default:
      console.error(
        "Usage:\n" +
          "  pnpm tsx web/scripts/backfill-breakdown.ts --dry-run\n" +
          "  pnpm tsx web/scripts/backfill-breakdown.ts --snapshot ./tmp/pre-backfill.json\n" +
          "  BACKFILL_APPROVED=1 pnpm tsx web/scripts/backfill-breakdown.ts --apply\n" +
          "  pnpm tsx web/scripts/backfill-breakdown.ts --restore ./tmp/pre-backfill.json",
      );
      process.exit(1);
  }
})();
