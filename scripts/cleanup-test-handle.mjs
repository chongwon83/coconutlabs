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
//   4. HDEL burn:claims:v1 <canonical(H)>   — the PR2 claim record, keyed by the
//                                             CANONICAL handle. Without this a
//                                             purged handle stays legacy-locked
//                                             and can never be re-claimed.
//
// NOTE: keys 1-3 use the RAW handle (the pre-migration storage form). Key 4
// (claims) is ALWAYS canonical. This script targets Upstash Redis only; the
// local FileBurnStore's .data/claims.json is handled by migrate-legacy-locks.ts.
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
const CLAIMS_KEY = "burn:claims:v1";
const histKey = (handle) => `burn:hist:${handle}`;

// Inline mirror of lib/server/handle.ts canonicalHandle — this .mjs runs under
// plain node and cannot import the TS module. Keep in sync. Strips leading @(s),
// trims, lowercases, validates the GitHub-ish charset (NO underscore); returns
// null when the handle cannot be canonicalized (→ no claim key can exist).
const CANONICAL_HANDLE_RE = /^[a-z0-9](?:[a-z0-9-]{0,38})$/;
function canonicalHandle(raw) {
  if (typeof raw !== "string") return null;
  const stripped = raw.trim().replace(/^@+/, "").toLowerCase();
  return CANONICAL_HANDLE_RE.test(stripped) ? stripped : null;
}

// Inline mirror of lib/server/handle.ts displayFormFor — case-preserving, @-stripped.
// Pre-migration leaderboard/hist could be keyed under this form (e.g. a user POSTed
// "Foo" with no @, before canonicalization existed), so a full purge must sweep it
// alongside the raw arg and the canonical key (codex finding: no-@ display residue).
function displayFormFor(raw) {
  return typeof raw === "string" ? raw.trim().replace(/^@+/, "") : "";
}

// Classify a claims value for display WITHOUT leaking it. The value is either
// "legacy-locked" or "sha256-v1:<hex>" (a one-way hash of the token, not the
// token itself — but we surface only the scheme to stay minimal-disclosure).
function describeClaim(value) {
  if (value == null) return "absent";
  if (value === "legacy-locked") return "legacy-locked (handle frozen)";
  if (typeof value === "string" && value.startsWith("sha256-")) {
    return "ACTIVE claim (hashed token present)";
  }
  return "present (unrecognized scheme)";
}

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
      "  4. HDEL burn:claims:v1 <canonical(handle)>  (PR2 claim record)",
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
  const canonicalKey = canonicalHandle(handle);
  // Sweep EVERY form the handle could be stored under: the raw arg (@Coconut-…),
  // its @-stripped display form (Coconut-…, case preserved), AND its canonical
  // key (coconut-…). Pre-migration, leaderboard/hist are keyed RAW — and "raw"
  // historically meant any of those three (a user could POST "@Foo", "Foo", or
  // "foo" before canonicalization existed). AFTER migrate-legacy-locks they are
  // keyed CANONICAL. Targeting only the typed-raw form would leave a migrated
  // canonical row (or a no-@ display row) behind while still HDEL'ing the
  // canonical claim — a half-purge that falsely reports "clean" (codex finding).
  // HDEL/DEL of an absent form is a harmless no-op, so we sweep the whole set.
  const forms = [
    ...new Set(
      [handle, displayFormFor(handle), canonicalKey].filter(
        (h) => h != null && h !== "",
      ),
    ),
  ];
  const leaderboard = {};
  const histLen = {};
  for (const f of forms) {
    // HGET returns the stored entry value (object thanks to @upstash/redis JSON
    // auto-parse) or null if the field is absent.
    leaderboard[f] = await redis.hget(LEADERBOARD_KEY, f);
    histLen[f] = await redis.hlen(histKey(f));
  }
  // Read the whole challenges list and count matches against ANY form.
  // CHALLENGES_CAP is 500; pulling all is cheap enough for a one-off CLI and
  // avoids subtle pagination bugs (LRANGE 0 -1 returns the full list).
  const allChallenges = await redis.lrange(CHALLENGES_KEY, 0, -1);
  const formSet = new Set(forms);
  const matchingChallenges = allChallenges.filter((r) => formSet.has(r?.handle));
  // PR2 claim record, ALWAYS keyed by the CANONICAL handle (null if
  // uncanonicalizable, e.g. an underscore the canonical charset rejects → no
  // claim can exist). The claim is canonical-only; never @-prefixed/raw.
  const claim =
    canonicalKey != null ? await redis.hget(CLAIMS_KEY, canonicalKey) : null;
  return {
    handle,
    canonicalKey,
    forms,
    leaderboard,
    histLen,
    allChallenges,
    matchingChallenges,
    claim,
  };
}

// True when ANY form still holds a leaderboard field / hist key. Used by both
// the noop early-exit and the AFTER "clean" assertion.
function anyEntry(state) {
  return state.forms.some((f) => state.leaderboard[f] != null);
}
function anyHist(state) {
  return state.forms.some((f) => state.histLen[f] > 0);
}

function fmtState(label, state) {
  const lines = [`[${label}]`];
  for (const f of state.forms) {
    const present = state.leaderboard[f] != null ? "PRESENT" : "absent";
    lines.push(`  burn:leaderboard[${f}]: ${present}`);
    lines.push(`  burn:hist:${f}: ${state.histLen[f]} weekKey(s)`);
  }
  lines.push(
    `  burn:challenges matches:    ${state.matchingChallenges.length} / ${state.allChallenges.length} total`,
  );
  const claimKey =
    state.canonicalKey != null
      ? `burn:claims:v1[${state.canonicalKey}]`
      : "burn:claims:v1[n/a — non-canonical]";
  lines.push(`  ${claimKey}: ${describeClaim(state.claim)}`);
  return lines.join("\n");
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
  console.log(fmtState("BEFORE", before));

  if (
    !anyEntry(before) &&
    !anyHist(before) &&
    before.matchingChallenges.length === 0 &&
    before.claim == null
  ) {
    console.log(
      `\n[noop] handle "${args.handle}" has no traces in any of the 4 keys. Exiting.`,
    );
    return;
  }

  // 2. Show the plan (dry-run by default). Leaderboard + hist are swept for
  //    EVERY form (raw + canonical) so a migrated canonical row is removed, not
  //    just the raw alias (codex finding 1).
  console.log("\n[plan]");
  let step = 1;
  for (const f of before.forms) {
    console.log(
      `  ${step++}. HDEL ${LEADERBOARD_KEY} ${f}        ` +
        (before.leaderboard[f] != null
          ? "(will remove 1 field)"
          : "(no-op, absent)"),
    );
    console.log(
      `  ${step++}. DEL  ${histKey(f)}                  ` +
        (before.histLen[f] > 0
          ? `(will remove ${before.histLen[f]} weekKey(s))`
          : "(no-op, absent)"),
    );
  }
  console.log(
    `  ${step++}. LREM ${CHALLENGES_KEY} 0 <row>                ` +
      (before.matchingChallenges.length > 0
        ? `(will remove ${before.matchingChallenges.length} row(s))`
        : "(no-op, none match)"),
  );
  console.log(
    `  ${step++}. HDEL ${CLAIMS_KEY} ${before.canonicalKey ?? "(n/a)"}        ` +
      (before.claim != null
        ? `(will remove claim: ${describeClaim(before.claim)})`
        : before.canonicalKey == null
          ? "(no-op, handle not canonicalizable)"
          : "(no-op, absent)"),
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

  for (const f of before.forms) {
    if (before.leaderboard[f] != null) {
      const r = await redis.hdel(LEADERBOARD_KEY, f);
      console.log(`  ✓ HDEL ${LEADERBOARD_KEY} ${f} → removed=${r}`);
    } else {
      console.log(`  - HDEL ${LEADERBOARD_KEY} ${f} skipped (absent)`);
    }
    if (before.histLen[f] > 0) {
      const r = await redis.del(histKey(f));
      console.log(`  ✓ DEL  ${histKey(f)} → removed=${r}`);
    } else {
      console.log(`  - DEL  ${histKey(f)} skipped (absent)`);
    }
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

  if (before.claim != null && before.canonicalKey != null) {
    const r = await redis.hdel(CLAIMS_KEY, before.canonicalKey);
    console.log(`  ✓ HDEL ${CLAIMS_KEY} ${before.canonicalKey} → removed=${r}`);
  } else {
    console.log(`  - HDEL claims skipped (absent or non-canonical handle)`);
  }

  // 4. Readback AFTER — must be all-zero. If not, surface clearly so the
  //    operator can investigate (e.g. an LREM stringification mismatch).
  const after = await readState(redis, args.handle);
  console.log("\n" + fmtState("AFTER", after));

  const clean =
    !anyEntry(after) &&
    !anyHist(after) &&
    after.matchingChallenges.length === 0 &&
    after.claim == null;
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
