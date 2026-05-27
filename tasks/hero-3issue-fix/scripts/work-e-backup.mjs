#!/usr/bin/env node
// work-e-backup.mjs — Session A backup for Work E (production Upstash Redis).
//
// Captures full state of every key the cleanup-test-handle.mjs script will
// touch, BEFORE any destructive op. Produces a 6-file backup dir plus a
// manifest.json (sha256 of each artifact) that Session B verifies before
// --apply.
//
// Files produced under tasks/hero-3issue-fix/work-e-backup-<TS>/:
//   1. leaderboard.json           — HGETALL burn:leaderboard (entire hash)
//   2. hist-<detected-handle>.json (× 4) — HGETALL burn:hist:<H>
//   3. challenges.json            — LRANGE burn:challenges 0 -1
//   4. manifest.json              — sha256 of files 1-3 + meta
//
// Stdout contract (Session A operator copies into handoff packet slots 1-5):
//   BACKUP_DIR=...
//   BACKUP_TS=...
//   MANIFEST_SHA256=<sha256 of manifest.json>
//   DETECTED_HANDLES:
//     contract-1779201784594-month=<detected form>
//     ... (× 4)
//   ABORT_REASON=<empty | text>
//
// Abort policy: if ANY of the 4 target base names is absent from the
// leaderboard hash, write manifest.json with abort_reason and exit non-zero.
// History/challenges absence is NOT an abort (handle may simply have no
// history entries or challenge submissions).
//
// Env loading: --env-file <path> reads KEY=value lines and sets process.env
// (no dotenv dependency — keeps Redis.fromEnv() path identical to production).

import { Redis } from "@upstash/redis";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const LEADERBOARD_KEY = "burn:leaderboard";
const CHALLENGES_KEY = "burn:challenges";
const histKey = (handle) => `burn:hist:${handle}`;

const TARGET_BASE_NAMES = [
  "contract-1779201784594-month",
  "contract-1779201784594-dedup",
  "contract-1779201784594-trend",
  "contract-1779201784594-single",
];

const OUTPUT_ROOT = "tasks/hero-3issue-fix";

function parseArgs(argv) {
  const args = { envFile: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--env-file") {
      const v = argv[i + 1];
      if (v == null || v.startsWith("--")) {
        throw new Error(`--env-file requires a path (got ${v ?? "<end>"}).`);
      }
      args.envFile = v;
      i++;
    } else {
      throw new Error(`Unknown argument: ${a}`);
    }
  }
  if (!args.envFile) throw new Error("--env-file is required.");
  return args;
}

// Minimal KEY=VALUE loader. Skips blanks/comments, strips matched quotes.
// We deliberately do NOT pull in dotenv — script must work in CI/runtime
// environments where dependencies are pinned.
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

function isoTimestampSafe() {
  // YYYYMMDDTHHMMSSZ — sorts lexicographically, no colons (filesystem safe).
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function sha256OfFile(path) {
  const h = createHash("sha256");
  h.update(readFileSync(path));
  return h.digest("hex");
}

function logEnvFingerprint() {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? "";
  const tok = process.env.UPSTASH_REDIS_REST_TOKEN ?? "";
  const host = url.replace(/^https?:\/\//, "").split("/")[0];
  console.error(
    `[env] url=${host}  token=${tok.slice(0, 4)}***  (token redacted)`,
  );
}

// For each target base name, check whether the leaderboard hash contains
// either `<name>` (no prefix) or `@<name>` (with prefix). Returns the
// detected form, or null if neither is present.
function detectHandleForm(leaderboard, baseName) {
  if (leaderboard == null) return null;
  const noPrefix = baseName;
  const withPrefix = `@${baseName}`;
  if (Object.prototype.hasOwnProperty.call(leaderboard, withPrefix)) {
    return withPrefix;
  }
  if (Object.prototype.hasOwnProperty.call(leaderboard, noPrefix)) {
    return noPrefix;
  }
  return null;
}

function writeJson(path, obj) {
  writeFileSync(path, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`Error: ${err.message}`);
    console.error(
      "Usage: node tasks/hero-3issue-fix/scripts/work-e-backup.mjs --env-file <path>",
    );
    process.exit(1);
  }

  const envCount = loadEnvFile(args.envFile);
  console.error(`[env] loaded ${envCount} variables from ${args.envFile}`);
  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    console.error(
      "Error: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set in the env file.",
    );
    process.exit(1);
  }
  logEnvFingerprint();

  const ts = isoTimestampSafe();
  const backupDir = join(OUTPUT_ROOT, `work-e-backup-${ts}`);
  mkdirSync(backupDir, { recursive: true });
  console.error(`[backup] dir=${backupDir}`);

  const redis = Redis.fromEnv();

  // 1. Leaderboard full dump (anchor for handle prefix detection).
  console.error("[redis] HGETALL burn:leaderboard");
  const leaderboard = await redis.hgetall(LEADERBOARD_KEY);
  const leaderboardPath = join(backupDir, "leaderboard.json");
  writeJson(leaderboardPath, leaderboard ?? {});

  // 2. Detect handle form per target. Abort if any target is absent.
  const detected = {};
  const missing = [];
  for (const baseName of TARGET_BASE_NAMES) {
    const form = detectHandleForm(leaderboard, baseName);
    detected[baseName] = form;
    if (form == null) missing.push(baseName);
  }

  const meta = {
    schema_version: 1,
    backup_ts: ts,
    backup_dir: backupDir,
    target_base_names: TARGET_BASE_NAMES,
    detected_handles: detected,
    leaderboard_field_count: leaderboard
      ? Object.keys(leaderboard).length
      : 0,
    chongwon83_in_leaderboard:
      leaderboard != null &&
      Object.prototype.hasOwnProperty.call(leaderboard, "@chongwon83"),
    abort_reason: "",
    files: {},
  };

  if (missing.length > 0) {
    meta.abort_reason =
      `target(s) absent from burn:leaderboard: ${missing.join(", ")}. ` +
      `Cannot proceed — Session B would have no apply target. ` +
      `Investigate before re-running (perhaps the data layout changed, or owner already deleted).`;
    meta.files.leaderboard = {
      path: "leaderboard.json",
      sha256: sha256OfFile(leaderboardPath),
    };
    const manifestPath = join(backupDir, "manifest.json");
    writeJson(manifestPath, meta);
    const manifestSha = sha256OfFile(manifestPath);

    console.error(`\n[ABORT] ${meta.abort_reason}`);
    // Emit stdout contract even on abort so Session A operator can record it.
    process.stdout.write(`BACKUP_DIR=${backupDir}\n`);
    process.stdout.write(`BACKUP_TS=${ts}\n`);
    process.stdout.write(`MANIFEST_SHA256=${manifestSha}\n`);
    process.stdout.write("DETECTED_HANDLES:\n");
    for (const baseName of TARGET_BASE_NAMES) {
      process.stdout.write(
        `  ${baseName}=${detected[baseName] ?? "<absent>"}\n`,
      );
    }
    process.stdout.write(`ABORT_REASON=${meta.abort_reason}\n`);
    process.exit(2);
  }

  // 3. History dump per detected handle. Absence is OK (no abort).
  for (const baseName of TARGET_BASE_NAMES) {
    const handle = detected[baseName];
    console.error(`[redis] HGETALL ${histKey(handle)}`);
    const hist = await redis.hgetall(histKey(handle));
    const histPath = join(backupDir, `hist-${handle}.json`);
    writeJson(histPath, hist ?? {});
    meta.files[`hist-${baseName}`] = {
      path: `hist-${handle}.json`,
      handle,
      sha256: sha256OfFile(histPath),
      week_count: hist ? Object.keys(hist).length : 0,
    };
  }

  // 4. Full challenges list dump.
  console.error("[redis] LRANGE burn:challenges 0 -1");
  const challenges = await redis.lrange(CHALLENGES_KEY, 0, -1);
  const challengesPath = join(backupDir, "challenges.json");
  writeJson(challengesPath, challenges);
  meta.files.challenges = {
    path: "challenges.json",
    sha256: sha256OfFile(challengesPath),
    total_count: Array.isArray(challenges) ? challenges.length : 0,
    matches_per_handle: Object.fromEntries(
      TARGET_BASE_NAMES.map((bn) => [
        bn,
        Array.isArray(challenges)
          ? challenges.filter((r) => r?.handle === detected[bn]).length
          : 0,
      ]),
    ),
  };
  meta.files.leaderboard = {
    path: "leaderboard.json",
    sha256: sha256OfFile(leaderboardPath),
  };

  // 5. Manifest write + final sha256.
  const manifestPath = join(backupDir, "manifest.json");
  writeJson(manifestPath, meta);
  const manifestSha = sha256OfFile(manifestPath);

  // 6. stdout contract (Session A operator → handoff packet).
  process.stdout.write(`BACKUP_DIR=${backupDir}\n`);
  process.stdout.write(`BACKUP_TS=${ts}\n`);
  process.stdout.write(`MANIFEST_SHA256=${manifestSha}\n`);
  process.stdout.write("DETECTED_HANDLES:\n");
  for (const baseName of TARGET_BASE_NAMES) {
    process.stdout.write(`  ${baseName}=${detected[baseName]}\n`);
  }
  process.stdout.write(`ABORT_REASON=\n`);

  // 7. Operator-friendly summary on stderr (does not pollute stdout contract).
  console.error("\n[summary]");
  console.error(`  leaderboard fields: ${meta.leaderboard_field_count}`);
  console.error(`  @chongwon83 present: ${meta.chongwon83_in_leaderboard}`);
  console.error(`  challenges total: ${meta.files.challenges.total_count}`);
  for (const baseName of TARGET_BASE_NAMES) {
    const h = meta.files[`hist-${baseName}`];
    const cm = meta.files.challenges.matches_per_handle[baseName];
    console.error(
      `  ${baseName} → ${detected[baseName]}: ${h.week_count} weekKey(s), ${cm} challenge row(s)`,
    );
  }
}

main().catch((err) => {
  console.error("Fatal:", err?.stack ?? err?.message ?? err);
  process.exit(1);
});
