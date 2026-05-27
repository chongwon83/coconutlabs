#!/usr/bin/env node
// work-e-purge.mjs — Work E dedicated destructive purge for 4 hard-coded test
// handles in production Upstash Redis. Companion to work-e-backup.mjs.
//
// WHY THIS EXISTS (vs scripts/cleanup-test-handle.mjs)
//   cleanup-test-handle.mjs enforces HANDLE_RE = /^@[a-zA-Z0-9_-]+$/ in
//   parseArgs *before* any Redis call. The 4 Work E targets are stored
//   WITHOUT the leading "@" (collector-test write path bypassed @-prefix
//   normalisation), so HANDLE_RE rejects them at exit=1. WORK_E_SESSION_PLAN
//   §3 forbids modifying cleanup-test-handle.mjs (shared destructive utility,
//   relaxing HANDLE_RE permanently broadens blast radius). This script is
//   the codex-recommended Option B: hard-coded 4 targets + @chongwon83
//   deny-list + manifest hash gate + JSON dry-run evidence.
//
// WHAT IT TOUCHES (per --apply run, all 4 targets sequentially)
//   For each target ∈ HARDCODED TARGET_BASE_NAMES (4 strings, frozen):
//     1. HDEL burn:leaderboard <base>          — remove leaderboard field
//     2. DEL  burn:hist:<base>                 — remove weekly history hash
//   After per-target loop:
//     3. LREM burn:challenges 0 <each row>     — only if live match count > 0
//                                                (backup matches_per_handle=0,
//                                                kept defensive)
//
// FAIL-CLOSED MITIGATIONS (codex review, 2026-05-27)
//   1. wildcard 금지            — TARGET_BASE_NAMES hard-coded, no CLI override
//   2. @chongwon83 deny-list    — intersection check (defense in depth)
//   3. manifest hash assertion  — sha256(backup/manifest.json) must match arg
//   4. before/after invariant   — @chongwon83 MUST exist in burn:leaderboard
//                                 both before AND after apply (else exit 2)
//   5. dry-run JSON             — stdout machine-readable plan (4 HDEL evidence)
//   6. LREM 0 explicit noop     — backup_match_count=0 + live_match_count check
//                                 emitted in JSON so silent drift visible
//   7. sequential apply         — per-target HDEL → DEL loop, exit code 검사
//
// USAGE
//   Dry-run (JSON to stdout):
//     node tasks/hero-3issue-fix/scripts/work-e-purge.mjs \
//       --env-file .env.local.prod \
//       --backup-dir tasks/hero-3issue-fix/work-e-backup-20260527T005523Z \
//       --expected-manifest-sha256 <64-hex>
//
//   Apply (requires both --apply AND --confirm-purge):
//     node tasks/hero-3issue-fix/scripts/work-e-purge.mjs \
//       --env-file .env.local.prod \
//       --backup-dir tasks/hero-3issue-fix/work-e-backup-20260527T005523Z \
//       --expected-manifest-sha256 <64-hex> \
//       --apply --confirm-purge
//
// EXIT CODES
//   0   dry-run OK, or apply complete with all invariants satisfied
//   1   precondition failure (bad args, missing env, hash mismatch, deny-list,
//       schema drift, @chongwon83 missing before apply, etc.)
//   2   apply-time corruption detected (residual targets, @chongwon83 lost)

import { Redis } from "@upstash/redis";
import {
  readFileSync,
  existsSync,
  statSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

// ─── Constants (frozen, no env override) ──────────────────────────────────

const LEADERBOARD_KEY = "burn:leaderboard";
const CHALLENGES_KEY = "burn:challenges";
const histKey = (handle) => `burn:hist:${handle}`;

// Hard-coded 4 targets — these are the ONLY base names this script will ever
// touch. No wildcard, no CLI override. Order matches WORK_E_SESSION_PLAN §1.
const TARGET_BASE_NAMES = Object.freeze([
  "contract-1779201784594-month",
  "contract-1779201784594-dedup",
  "contract-1779201784594-trend",
  "contract-1779201784594-single",
]);

// Deny-list: any of these handles appearing in target list (impossible given
// hard-coded source, but checked anyway for defense in depth) or in any
// computed HDEL plan triggers immediate exit. Includes both raw and @-prefix
// forms because the owner's account is stored with "@" but bare name shows
// up in some contexts.
const OWNER_DENY_HANDLES = Object.freeze(["@chongwon83", "chongwon83"]);

// Backup manifest schema we expect (work-e-backup.mjs schema_version=1).
const EXPECTED_MANIFEST_SCHEMA_VERSION = 1;

// ─── Arg parsing ──────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {
    envFile: null,
    backupDir: null,
    expectedManifestSha256: null,
    apply: false,
    confirmPurge: false,
  };

  function consumeValue(flag, i) {
    const v = argv[i + 1];
    if (v == null || v.startsWith("--")) {
      throw new Error(
        `Flag ${flag} requires a value (got ${v == null ? "<end of args>" : v}).`,
      );
    }
    return v;
  }

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--env-file") {
      args.envFile = consumeValue(a, i);
      i++;
    } else if (a === "--backup-dir") {
      args.backupDir = consumeValue(a, i);
      i++;
    } else if (a === "--expected-manifest-sha256") {
      args.expectedManifestSha256 = consumeValue(a, i);
      i++;
    } else if (a === "--apply") {
      args.apply = true;
    } else if (a === "--confirm-purge") {
      args.confirmPurge = true;
    } else {
      throw new Error(`Unknown argument: ${a}`);
    }
  }

  if (!args.envFile) throw new Error("--env-file is required.");
  if (!args.backupDir) throw new Error("--backup-dir is required.");
  if (!args.expectedManifestSha256) {
    throw new Error("--expected-manifest-sha256 is required.");
  }
  if (!/^[a-f0-9]{64}$/i.test(args.expectedManifestSha256)) {
    throw new Error(
      `--expected-manifest-sha256 must be a 64-char hex string (got "${args.expectedManifestSha256}").`,
    );
  }
  if (args.apply !== args.confirmPurge) {
    throw new Error(
      "--apply and --confirm-purge must be passed together. Both omitted = dry-run.",
    );
  }
  return args;
}

function usage() {
  console.error(
    [
      "Usage:",
      "  node tasks/hero-3issue-fix/scripts/work-e-purge.mjs \\",
      "    --env-file <path> \\",
      "    --backup-dir <path> \\",
      "    --expected-manifest-sha256 <64-hex> \\",
      "    [--apply --confirm-purge]",
      "",
      "Hard-coded 4-handle destructive purge with manifest hash gate.",
      "Targets (frozen):",
      ...TARGET_BASE_NAMES.map((n) => `  - ${n}`),
      "",
      "Default: dry-run (JSON plan to stdout). Apply requires BOTH flags.",
    ].join("\n"),
  );
}

// ─── Env loader (no dotenv dep, mirrors work-e-backup.mjs) ────────────────

function loadEnvFile(path) {
  if (!existsSync(path)) {
    throw new Error(`env file not found: ${path}`);
  }
  const text = readFileSync(path, "utf8");
  let count = 0;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
    count++;
  }
  return count;
}

function requireEnv() {
  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    throw new Error(
      "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set in --env-file.",
    );
  }
}

function logEnvFingerprint() {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? "";
  const tok = process.env.UPSTASH_REDIS_REST_TOKEN ?? "";
  const host = url.replace(/^https?:\/\//, "").split("/")[0];
  console.error(
    `[env] url=${host}  token=${tok.slice(0, 4)}***  (token redacted)`,
  );
}

// ─── Backup manifest validation ───────────────────────────────────────────

function sha256OfFile(path) {
  const h = createHash("sha256");
  h.update(readFileSync(path));
  return h.digest("hex");
}

function arrayEq(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function validateBackup(backupDir, expectedSha) {
  if (!existsSync(backupDir)) {
    throw new Error(`backup dir not found: ${backupDir}`);
  }
  const dirStat = statSync(backupDir);
  if (!dirStat.isDirectory()) {
    throw new Error(`backup dir is not a directory: ${backupDir}`);
  }
  const manifestPath = join(backupDir, "manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error(`backup manifest.json missing: ${manifestPath}`);
  }
  const actualSha = sha256OfFile(manifestPath);
  if (actualSha.toLowerCase() !== expectedSha.toLowerCase()) {
    throw new Error(
      `manifest sha256 mismatch:\n  expected ${expectedSha}\n  actual   ${actualSha}\n` +
        `Refuse to proceed — backup integrity not verified.`,
    );
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (manifest.schema_version !== EXPECTED_MANIFEST_SCHEMA_VERSION) {
    throw new Error(
      `manifest schema_version mismatch: expected ${EXPECTED_MANIFEST_SCHEMA_VERSION}, got ${manifest.schema_version}.`,
    );
  }
  if (!arrayEq(manifest.target_base_names, TARGET_BASE_NAMES)) {
    throw new Error(
      `manifest target_base_names mismatch:\n  expected ${JSON.stringify(TARGET_BASE_NAMES)}\n  actual   ${JSON.stringify(manifest.target_base_names)}`,
    );
  }
  if (manifest.chongwon83_in_leaderboard !== true) {
    throw new Error(
      `manifest.chongwon83_in_leaderboard must be true (got ${manifest.chongwon83_in_leaderboard}). ` +
        `Backup was taken at a state where the owner's row was absent — refuse to proceed.`,
    );
  }
  if (manifest.abort_reason && manifest.abort_reason !== "") {
    throw new Error(
      `manifest carries abort_reason: "${manifest.abort_reason}". Backup is not a clean baseline.`,
    );
  }
  return { manifestPath, manifest, actualSha };
}

// ─── Deny-list assertion (defense in depth) ───────────────────────────────

function assertDenyListClean() {
  const denySet = new Set(OWNER_DENY_HANDLES);
  const intersection = TARGET_BASE_NAMES.filter((n) => denySet.has(n));
  if (intersection.length > 0) {
    throw new Error(
      `DENY-LIST VIOLATION: TARGET_BASE_NAMES contains ${JSON.stringify(intersection)} ` +
        `which is on OWNER_DENY_HANDLES. This is impossible given hard-coded source — ` +
        `the script has been tampered with. Refusing all operations.`,
    );
  }
  return { deny_handles: [...OWNER_DENY_HANDLES], intersection };
}

// ─── Live readback ────────────────────────────────────────────────────────

async function readLiveState(redis) {
  // 1. Owner row (must always be present).
  const chongwonEntry = await redis.hget(LEADERBOARD_KEY, "@chongwon83");

  // 2. Per-target leaderboard + hist.
  const perTarget = [];
  for (const base of TARGET_BASE_NAMES) {
    const entry = await redis.hget(LEADERBOARD_KEY, base);
    const histLen = await redis.hlen(histKey(base));
    perTarget.push({ base, entry, histLen });
  }

  // 3. Challenges list (full pull; CHALLENGES_CAP=500 elsewhere).
  const allChallenges = await redis.lrange(CHALLENGES_KEY, 0, -1);
  const targetSet = new Set(TARGET_BASE_NAMES);
  const matchingChallenges = allChallenges.filter(
    (r) => r && targetSet.has(r.handle),
  );

  return {
    chongwonEntry,
    perTarget,
    allChallenges,
    matchingChallenges,
  };
}

// ─── Plan builder (JSON for stdout) ───────────────────────────────────────

function buildPurgePlan({
  backupValidation,
  denyAssertion,
  liveBefore,
  manifest,
}) {
  const targetSet = new Set(TARGET_BASE_NAMES);
  const fieldsToHdel = liveBefore.perTarget.map((t) => ({
    field: t.base,
    present_live: t.entry != null,
    backup_present: Object.prototype.hasOwnProperty.call(
      manifest.detected_handles ?? {},
      t.base,
    )
      ? manifest.detected_handles[t.base] != null
      : false,
  }));
  const histToDel = liveBefore.perTarget.map((t) => ({
    key: histKey(t.base),
    live_hlen: t.histLen,
    backup_week_count:
      manifest.files?.[`hist-${t.base}`]?.week_count ?? null,
  }));
  const backupMatches = manifest.files?.challenges?.matches_per_handle ?? {};
  const liveMatchCount = liveBefore.matchingChallenges.length;
  const backupMatchCount = Object.values(backupMatches).reduce(
    (a, b) => a + (Number(b) || 0),
    0,
  );
  const allPlannedHdelsPresent = fieldsToHdel.every((f) => f.present_live);

  return {
    schema: "work-e-purge-plan/1",
    generated_at: new Date().toISOString(),
    backup_validation: {
      backup_dir: backupValidation.backupDir,
      manifest_path: backupValidation.manifestPath,
      manifest_sha256: backupValidation.actualSha,
      schema_version: manifest.schema_version,
    },
    deny_list_assertion: {
      deny_handles: denyAssertion.deny_handles,
      target_intersection: denyAssertion.intersection,
      defense_in_depth_passed: denyAssertion.intersection.length === 0,
    },
    chongwon83_in_leaderboard_before: liveBefore.chongwonEntry != null,
    leaderboard: {
      fields_to_hdel: fieldsToHdel,
      fields_preserved: ["@chongwon83"],
      total_hdel_planned: fieldsToHdel.filter((f) => f.present_live).length,
    },
    hist_to_del: histToDel,
    challenges_lrem: {
      live_match_count: liveMatchCount,
      backup_match_count: backupMatchCount,
      backup_matches_per_handle: backupMatches,
      noop_if_zero_intent: liveMatchCount === 0,
      will_perform_lrem: liveMatchCount > 0,
    },
    all_planned_hdels_present: allPlannedHdelsPresent,
    ready_to_apply:
      liveBefore.chongwonEntry != null &&
      denyAssertion.intersection.length === 0 &&
      allPlannedHdelsPresent,
  };
}

// ─── Apply (sequential, fail-loud) ────────────────────────────────────────

async function applyPurge(redis, liveBefore) {
  const ops = [];

  // 1. Per-target HDEL + DEL (sequential per target).
  for (const t of liveBefore.perTarget) {
    if (OWNER_DENY_HANDLES.includes(t.base)) {
      // Impossible given hard-coded TARGET_BASE_NAMES, but check before any
      // destructive call. Defense in depth.
      throw new Error(
        `apply ABORT: target "${t.base}" is on deny-list. Refusing HDEL.`,
      );
    }
    if (t.entry != null) {
      const r = await redis.hdel(LEADERBOARD_KEY, t.base);
      ops.push({
        op: "HDEL",
        key: LEADERBOARD_KEY,
        field: t.base,
        removed: Number(r) || 0,
      });
      console.error(`  ✓ HDEL ${LEADERBOARD_KEY} ${t.base} → removed=${r}`);
    } else {
      ops.push({
        op: "HDEL",
        key: LEADERBOARD_KEY,
        field: t.base,
        removed: 0,
        skipped_reason: "field absent in BEFORE readback",
      });
      console.error(`  - HDEL ${LEADERBOARD_KEY} ${t.base} skipped (absent)`);
    }

    if (t.histLen > 0) {
      const r = await redis.del(histKey(t.base));
      ops.push({
        op: "DEL",
        key: histKey(t.base),
        removed: Number(r) || 0,
      });
      console.error(`  ✓ DEL  ${histKey(t.base)} → removed=${r}`);
    } else {
      ops.push({
        op: "DEL",
        key: histKey(t.base),
        removed: 0,
        skipped_reason: "hlen=0 in BEFORE readback",
      });
      console.error(`  - DEL  ${histKey(t.base)} skipped (hlen=0)`);
    }
  }

  // 2. LREM each matching challenge row (defensive — backup said 0 matches).
  if (liveBefore.matchingChallenges.length > 0) {
    for (const row of liveBefore.matchingChallenges) {
      // Re-stringify in the same projection order used by redisStore.ts
      // (and cleanup-test-handle.mjs) so the byte payload matches LREM.
      const projected = {
        handle: row.handle,
        challenge: row.challenge,
        claimedFixes: row.claimedFixes,
        status: row.status,
        verifiedFixes: row.verifiedFixes,
        submittedAt: row.submittedAt,
        verifiedAt: row.verifiedAt,
      };
      const payload = JSON.stringify(projected);
      const r = await redis.lrem(CHALLENGES_KEY, 0, payload);
      ops.push({
        op: "LREM",
        key: CHALLENGES_KEY,
        handle: row.handle,
        removed: Number(r) || 0,
      });
      console.error(
        `  ✓ LREM ${CHALLENGES_KEY} 0 <${row.handle}@${row.submittedAt}> → removed=${r}`,
      );
    }
  } else {
    ops.push({
      op: "LREM",
      key: CHALLENGES_KEY,
      removed: 0,
      skipped_reason: "live_match_count=0 (audited noop, matches backup=0)",
    });
    console.error(
      `  - LREM ${CHALLENGES_KEY} skipped (live=0 matches, audited noop)`,
    );
  }

  return ops;
}

async function verifyAfter(redis) {
  // 1. @chongwon83 MUST still be there. This is the invariant.
  const chongwonEntry = await redis.hget(LEADERBOARD_KEY, "@chongwon83");

  // 2. Each target MUST be absent.
  const perTarget = [];
  for (const base of TARGET_BASE_NAMES) {
    const entry = await redis.hget(LEADERBOARD_KEY, base);
    const histLen = await redis.hlen(histKey(base));
    perTarget.push({ base, entry, histLen });
  }

  // 3. Challenges: no target handle should remain.
  const allChallenges = await redis.lrange(CHALLENGES_KEY, 0, -1);
  const targetSet = new Set(TARGET_BASE_NAMES);
  const residualChallenges = allChallenges.filter(
    (r) => r && targetSet.has(r.handle),
  );

  const violations = [];
  if (chongwonEntry == null) {
    violations.push(
      "CORRUPTION: @chongwon83 absent from burn:leaderboard AFTER apply.",
    );
  }
  for (const t of perTarget) {
    if (t.entry != null) {
      violations.push(
        `RESIDUAL: burn:leaderboard["${t.base}"] still present after HDEL.`,
      );
    }
    if (t.histLen > 0) {
      violations.push(
        `RESIDUAL: burn:hist:${t.base} hlen=${t.histLen} after DEL.`,
      );
    }
  }
  if (residualChallenges.length > 0) {
    violations.push(
      `RESIDUAL: ${residualChallenges.length} challenge rows still match target handles.`,
    );
  }

  return {
    chongwon83_present: chongwonEntry != null,
    per_target: perTarget.map((t) => ({
      base: t.base,
      leaderboard_absent: t.entry == null,
      hist_empty: t.histLen === 0,
    })),
    residual_challenges_count: residualChallenges.length,
    violations,
    clean: violations.length === 0,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`Error: ${err.message}\n`);
    usage();
    process.exit(1);
  }

  // Step 1: Hard-coded deny-list intersection (impossibility guard).
  let denyAssertion;
  try {
    denyAssertion = assertDenyListClean();
  } catch (err) {
    console.error(`Fatal: ${err.message}`);
    process.exit(1);
  }

  // Step 2: Env file.
  try {
    const envCount = loadEnvFile(args.envFile);
    console.error(`[env] loaded ${envCount} variables from ${args.envFile}`);
    requireEnv();
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
  logEnvFingerprint();

  // Step 3: Backup manifest validation.
  let backupValidation, manifest;
  try {
    const v = validateBackup(args.backupDir, args.expectedManifestSha256);
    backupValidation = { ...v, backupDir: args.backupDir };
    manifest = v.manifest;
    console.error(
      `[backup] manifest sha256 OK (${v.actualSha.slice(0, 8)}...), schema_version=${manifest.schema_version}`,
    );
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }

  // Step 4: Live BEFORE readback.
  const redis = Redis.fromEnv();
  let liveBefore;
  try {
    liveBefore = await readLiveState(redis);
  } catch (err) {
    console.error(`[redis] BEFORE readback failed: ${err?.stack ?? err}`);
    process.exit(1);
  }
  console.error(
    `[before] @chongwon83 present=${liveBefore.chongwonEntry != null}, ` +
      `targets present=${liveBefore.perTarget.filter((t) => t.entry != null).length}/4, ` +
      `challenge matches=${liveBefore.matchingChallenges.length}`,
  );

  // Step 5: Critical live precondition.
  if (liveBefore.chongwonEntry == null) {
    console.error(
      `Fatal: @chongwon83 absent from burn:leaderboard BEFORE apply. ` +
        `Refusing all operations — production state already corrupt or pointed at wrong env.`,
    );
    process.exit(1);
  }

  // Step 6: Build & emit plan JSON.
  const plan = buildPurgePlan({
    backupValidation,
    denyAssertion,
    liveBefore,
    manifest,
  });

  if (!plan.ready_to_apply) {
    // Emit the plan anyway so the operator can see *why* it's not ready.
    process.stdout.write(JSON.stringify(plan, null, 2) + "\n");
    console.error(
      `\n[not-ready] plan.ready_to_apply=false. Inspect the JSON above.`,
    );
    process.exit(1);
  }

  if (!args.apply) {
    // Dry-run path: JSON plan to stdout (the "4 fields planned" evidence).
    process.stdout.write(JSON.stringify(plan, null, 2) + "\n");
    console.error(
      `\n[dry-run] no writes performed. Re-run with --apply --confirm-purge to commit.`,
    );
    return;
  }

  // Step 7: Apply.
  console.error(`\n[apply] sequential HDEL/DEL/LREM for 4 targets...`);
  let ops;
  try {
    ops = await applyPurge(redis, liveBefore);
  } catch (err) {
    console.error(`Fatal during apply: ${err?.stack ?? err}`);
    console.error(
      `\n[partial] some ops may have committed. Inspect Redis state manually ` +
        `using backup as the recovery baseline.`,
    );
    process.exit(2);
  }

  // Step 8: AFTER readback + invariant check.
  let after;
  try {
    after = await verifyAfter(redis);
  } catch (err) {
    console.error(`[redis] AFTER readback failed: ${err?.stack ?? err}`);
    process.exit(2);
  }

  const applyReport = {
    schema: "work-e-purge-apply-report/1",
    completed_at: new Date().toISOString(),
    plan_id: backupValidation.actualSha,
    ops,
    after,
  };
  process.stdout.write(JSON.stringify(applyReport, null, 2) + "\n");

  if (!after.clean) {
    console.error(`\n[FAIL] invariant violations:\n  ${after.violations.join("\n  ")}`);
    process.exit(2);
  }
  console.error(
    `\n[ok] 4 handles purged, @chongwon83 preserved. Apply report on stdout.`,
  );
}

main().catch((err) => {
  console.error("Fatal:", err?.stack ?? err?.message ?? err);
  process.exit(1);
});
