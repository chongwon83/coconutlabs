#!/usr/bin/env node
// cleanup-test-handle.mjs — owner CLI to FULL-PURGE one handle from the Upstash
// Redis burn store. Companion to manage-unverified.mjs; same Redis instance,
// same dry-run/--apply discipline, but this script DELETES rather than appends.
//
// WHY THIS EXISTS
//   redisStore.ts is intentionally append-only (no deleteEntry method) so that
//   the production code path can never accidentally drop a card. Owner-driven
//   one-off cleanups (e.g. removing a verify-bot test entry that pollutes the
//   leaderboard) therefore need an out-of-band tool. We code it rather than
//   keep it as a one-shot shell snippet so the operation is reproducible,
//   audit-grep-able, and protected by the same guards as manage-unverified.mjs.
//
// WHAT IT TOUCHES (per --handle <H>)
//   1. HDEL burn:leaderboard <H>            — leaderboard card
//   2. DEL  burn:hist:<H>                   — weekly history hash
//   3. LREM burn:challenges 0 <each-row>    — every ChallengeRecord whose
//                                             handle === <H> (each round-trip)
//
// DEFAULT DRY-RUN: writes happen ONLY with --apply. Without it the CLI prints
// readback + "would HDEL/DEL/LREM" lines and exits 0.
//
// USAGE
//   node scripts/cleanup-test-handle.mjs --handle @coconut-verify-bot
//   node scripts/cleanup-test-handle.mjs --handle @coconut-verify-bot --apply
//
// REQUIRES env vars: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN. Treat
// the token as a secret — never log it in plaintext. Load via .env.local or
// `vercel env pull` before invoking.

import { Redis } from "@upstash/redis";

// Mirror of redisStore.ts constants — keep in sync if either changes.
const LEADERBOARD_KEY = "burn:leaderboard";
const CHALLENGES_KEY = "burn:challenges";
const histKey = (handle) => `burn:hist:${handle}`;

// Reserved owner handle that does not require the extra confirmation prompt.
// All other handles (including any future test bots) need an explicit --force
// or an interactive "type the handle to confirm" gate. Keeps the script narrow
// to its known cleanup target while still permitting future one-offs.
const KNOWN_TEST_HANDLES = new Set(["@coconut-verify-bot"]);

// Strict handle shape — matches the leaderboard entry validator on the server
// (@-prefix + alnum/_/-). Refuses wildcards like "@*" or "" outright.
const HANDLE_RE = /^@[a-zA-Z0-9_-]+$/;

function parseArgs(argv) {
  const args = { handle: null, apply: false, force: false };

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
    if (a === "--handle") {
      args.handle = consumeValue(a, i);
      i++;
    } else if (a === "--apply") {
      args.apply = true;
    } else if (a === "--force") {
      args.force = true;
    } else {
      throw new Error(`Unknown argument: ${a}`);
    }
  }

  if (!args.handle) throw new Error("--handle is required.");
  if (!HANDLE_RE.test(args.handle)) {
    throw new Error(
      `--handle must match ${HANDLE_RE} (got "${args.handle}"). Wildcards forbidden.`,
    );
  }
  return args;
}

function usage() {
  console.error(
    [
      "Usage:",
      "  node scripts/cleanup-test-handle.mjs --handle <@name> [--apply] [--force]",
      "",
      "Performs a full purge of one handle from Upstash Redis:",
      "  1. HDEL burn:leaderboard <handle>",
      "  2. DEL  burn:hist:<handle>",
      "  3. LREM burn:challenges 0 <each-matching-row>",
      "",
      "Env required: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN",
      "Default: dry-run (no writes). Pass --apply to commit.",
      "Non-test handles require --force (guards against typos).",
    ].join("\n"),
  );
}

function requireEnv() {
  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    console.error(
      "Error: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set.\n" +
        "Hint: `vercel env pull .env.local` then `source .env.local` (or `dotenv -- node ...`).",
    );
    process.exit(1);
  }
}

// Print a one-line redacted token preview so the operator can confirm WHICH
// project the script is pointed at without exposing the secret itself. Same
// pattern as security.md `mask_sensitive` (first 4 chars only).
function logEnvFingerprint() {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? "";
  const tok = process.env.UPSTASH_REDIS_REST_TOKEN ?? "";
  const host = url.replace(/^https?:\/\//, "").split("/")[0];
  console.log(
    `[env] url=${host}  token=${tok.slice(0, 4)}***  (token redacted)`,
  );
}

// Read current state for the handle — used in the dry-run preview and the
// post-apply readback. Returns the three measured quantities so the caller
// can both display and assert on them.
async function readState(redis, handle) {
  // HGET returns the stored entry value (object thanks to @upstash/redis JSON
  // auto-parse) or null if the field is absent.
  const entry = await redis.hget(LEADERBOARD_KEY, handle);
  const histLen = await redis.hlen(histKey(handle));
  // Read the whole challenges list and count handle matches. CHALLENGES_CAP is
  // 500; pulling all is cheap enough for a one-off CLI and avoids subtle
  // pagination bugs (LRANGE 0 -1 returns the full list).
  const allChallenges = await redis.lrange(CHALLENGES_KEY, 0, -1);
  const matchingChallenges = allChallenges.filter((r) => r?.handle === handle);
  return { entry, histLen, allChallenges, matchingChallenges };
}

function fmtState(label, state, handle) {
  const present = state.entry != null ? "PRESENT" : "absent";
  return [
    `[${label}]`,
    `  burn:leaderboard[${handle}]: ${present}`,
    `  burn:hist:${handle}:        ${state.histLen} weekKey(s)`,
    `  burn:challenges matches:    ${state.matchingChallenges.length} / ${state.allChallenges.length} total`,
  ].join("\n");
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`Error: ${err.message}\n`);
    usage();
    process.exit(1);
  }

  requireEnv();
  logEnvFingerprint();

  if (!KNOWN_TEST_HANDLES.has(args.handle) && !args.force) {
    console.error(
      `\nError: handle "${args.handle}" is not on the known-test list ` +
        `(${[...KNOWN_TEST_HANDLES].join(", ")}).\n` +
        `Pass --force to override. This is a typo guard, not a permissions guard.`,
    );
    process.exit(1);
  }

  const redis = Redis.fromEnv();

  // 1. Readback BEFORE — owner reads this to confirm we are pointed at the
  //    right environment and the handle actually exists.
  const before = await readState(redis, args.handle);
  console.log(fmtState("BEFORE", before, args.handle));

  if (
    before.entry == null &&
    before.histLen === 0 &&
    before.matchingChallenges.length === 0
  ) {
    console.log(
      `\n[noop] handle "${args.handle}" has no traces in any of the 3 keys. Exiting.`,
    );
    return;
  }

  // 2. Show the plan (dry-run by default).
  console.log("\n[plan]");
  console.log(
    `  1. HDEL ${LEADERBOARD_KEY} ${args.handle}        ` +
      (before.entry != null ? "(will remove 1 field)" : "(no-op, absent)"),
  );
  console.log(
    `  2. DEL  ${histKey(args.handle)}                  ` +
      (before.histLen > 0
        ? `(will remove ${before.histLen} weekKey(s))`
        : "(no-op, absent)"),
  );
  console.log(
    `  3. LREM ${CHALLENGES_KEY} 0 <row>                ` +
      (before.matchingChallenges.length > 0
        ? `(will remove ${before.matchingChallenges.length} row(s))`
        : "(no-op, none match)"),
  );

  if (!args.apply) {
    console.log(
      "\n[dry-run] no writes performed. Re-run with --apply to commit.",
    );
    return;
  }

  // 3. Apply. Each step is logged so a failure mid-flow leaves a clear trail
  //    of what landed vs. what is still pending.
  console.log("\n[apply]");

  if (before.entry != null) {
    const r = await redis.hdel(LEADERBOARD_KEY, args.handle);
    console.log(`  ✓ HDEL ${LEADERBOARD_KEY} ${args.handle} → removed=${r}`);
  } else {
    console.log(`  - HDEL skipped (absent)`);
  }

  if (before.histLen > 0) {
    const r = await redis.del(histKey(args.handle));
    console.log(`  ✓ DEL  ${histKey(args.handle)} → removed=${r}`);
  } else {
    console.log(`  - DEL  skipped (absent)`);
  }

  // LREM removes by EXACT element value. @upstash/redis returns the stored row
  // as an object on LRANGE but stores it as a JSON string; LREM must be the
  // same JSON-string form the LIST element was LPUSH'd as (redisStore.ts uses
  // `JSON.stringify(projectChallenge(record))`). We re-stringify each matched
  // row in projection order so the payload is byte-identical.
  if (before.matchingChallenges.length > 0) {
    let totalRemoved = 0;
    for (const row of before.matchingChallenges) {
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
      totalRemoved += Number(r) || 0;
      console.log(
        `  ✓ LREM ${CHALLENGES_KEY} 0 <${row.challenge}@${row.submittedAt}> → removed=${r}`,
      );
    }
    console.log(`  total LREM removed: ${totalRemoved}`);
  } else {
    console.log(`  - LREM skipped (no matching rows)`);
  }

  // 4. Readback AFTER — must be all-zero. If not, surface clearly so the
  //    operator can investigate (e.g. an LREM stringification mismatch).
  const after = await readState(redis, args.handle);
  console.log("\n" + fmtState("AFTER", after, args.handle));

  const clean =
    after.entry == null &&
    after.histLen === 0 &&
    after.matchingChallenges.length === 0;
  if (clean) {
    console.log(`\n[ok] handle "${args.handle}" fully purged.`);
  } else {
    console.error(
      `\n[warn] residual traces remain. Investigate before re-running. ` +
        `Most likely a CHALLENGES row LPUSH'd from a different code path with ` +
        `non-canonical key order.`,
    );
    process.exit(2);
  }
}

main().catch((err) => {
  console.error("Fatal:", err?.message ?? err);
  process.exit(1);
});
