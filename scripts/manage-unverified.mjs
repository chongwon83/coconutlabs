#!/usr/bin/env node
// manage-unverified.mjs — production owner CLI for the Upstash Redis challenge
// queue. Companion to scripts/verify-challenge.mjs (which only knows the local
// .data/challenges.json file store).
//
// Vercel's filesystem is ephemeral, so production challenge submissions live in
// Upstash Redis under the LIST `burn:challenges` (LPUSH newest-first, LTRIM 500).
// Owner verification cannot mutate that list element — redisStore.ts keeps the
// list strictly append-only (codex Plan #1: LSET / LREM+LPUSH would break the
// "newest-first" contract and LTRIM cap math under multi-element duplicates).
//
// Instead we APPEND a new ChallengeRecord (same handle+challenge, status
// "verified" or "rejected", fresh verifiedAt). lib/server/challenge.ts's
// verifiedFixesByHandle() dedups by latest verifiedAt per (handle, challenge),
// so the new record automatically supersedes the original unverified one in the
// leaderboard sum. The original unverified row stays in the LIST as audit
// trail. Store layer untouched.
//
// USAGE
//   node scripts/manage-unverified.mjs --list [--handle H] [--challenge ID]
//   node scripts/manage-unverified.mjs --verify <handle> --challenge <id> --fixes <N> [--apply]
//   node scripts/manage-unverified.mjs --reject <handle> --challenge <id> [--apply]
//
// DEFAULT DRY-RUN: writes happen ONLY with --apply. Without it the CLI prints
// what would be appended and exits 0 without touching Redis.
//
// REQUIRES env vars: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN. Treat
// the token as a secret — never log it in plaintext. Load via .env.local or
// `vercel env pull` before invoking.

import { Redis } from "@upstash/redis";

// Mirror of redisStore.ts constants — keep in sync if either changes. The Lua
// script is copied verbatim so this CLI's append uses the same atomic
// LPUSH+LTRIM the route handler does (one round-trip, no LIST-over-cap window).
const CHALLENGES_KEY = "burn:challenges";
const CHALLENGES_CAP = 500;
const ADD_CHALLENGE_LUA = `
redis.call('LPUSH', KEYS[1], ARGV[1])
redis.call('LTRIM', KEYS[1], 0, tonumber(ARGV[2]))
return 1
`;

// Rebuild the 7 declared ChallengeRecord fields so JSON.stringify can never
// persist an extra runtime property — same defence redisStore.ts's
// projectChallenge() applies on the server path.
function projectChallenge(r) {
  return {
    handle: r.handle,
    challenge: r.challenge,
    claimedFixes: r.claimedFixes,
    status: r.status,
    verifiedFixes: r.verifiedFixes,
    submittedAt: r.submittedAt,
    verifiedAt: r.verifiedAt,
  };
}

// Strict parser (codex MED #3): reject unknown args, duplicate modes, and
// flag-looking values after value-consuming flags. Throws on any violation —
// main() catches and exits 1 with the message. Permissive parsing previously
// let typos like `--verifty` get silently dropped, which on an --apply run
// could append the wrong status. Better to refuse loudly.
function parseArgs(argv) {
  const args = {
    mode: null,
    handle: null,
    challenge: null,
    fixes: null,
    apply: false,
    force: false,
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

  function setMode(next) {
    if (args.mode != null) {
      throw new Error(
        `Duplicate mode flag: --${next} (mode already --${args.mode}).`,
      );
    }
    args.mode = next;
  }

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--list") {
      setMode("list");
    } else if (a === "--verify") {
      setMode("verify");
      args.handle = consumeValue(a, i);
      i++;
    } else if (a === "--reject") {
      setMode("reject");
      args.handle = consumeValue(a, i);
      i++;
    } else if (a === "--handle") {
      args.handle = consumeValue(a, i);
      i++;
    } else if (a === "--challenge") {
      args.challenge = consumeValue(a, i);
      i++;
    } else if (a === "--fixes") {
      const v = consumeValue(a, i);
      const n = Number(v);
      if (!Number.isFinite(n)) {
        throw new Error(`--fixes requires a numeric value (got ${v}).`);
      }
      args.fixes = n;
      i++;
    } else if (a === "--apply") {
      args.apply = true;
    } else if (a === "--force") {
      args.force = true;
    } else {
      throw new Error(`Unknown argument: ${a}`);
    }
  }

  if (args.mode === "reject" && args.fixes != null) {
    throw new Error("--reject does not accept --fixes.");
  }

  return args;
}

function usage() {
  console.error(
    [
      "Usage:",
      "  node scripts/manage-unverified.mjs --list [--handle H] [--challenge ID]",
      "  node scripts/manage-unverified.mjs --verify <handle> --challenge <id> --fixes <N> [--apply] [--force]",
      "  node scripts/manage-unverified.mjs --reject <handle> --challenge <id> [--apply] [--force]",
      "",
      "Env required: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN",
      "Default: dry-run (no writes). Pass --apply to commit.",
      "Use --force to override the 'prior decision exists' guard (rare).",
    ].join("\n"),
  );
}

// Authoritative timestamp from Redis server clock (codex HIGH fix). Operator
// clocks can drift behind/ahead of records written by the route handler, which
// would make verifiedFixesByHandle()'s 'latest verifiedAt' pick the wrong
// record. redis.time() returns [secs, micros] from the same instance the data
// lives on, so write-order corresponds to timestamp-order regardless of where
// this CLI is invoked from. Upstash is a single Redis instance, so no
// multi-node clock skew between TIME and the LPUSH that follows.
async function getServerTimeIso(redis) {
  const t = await redis.time();
  const secs = Number(t[0]);
  const micros = Number(t[1]);
  const ms = secs * 1000 + Math.floor(micros / 1000);
  return new Date(ms).toISOString();
}

// codex MED #2: a submission identified by (handle, challenge, submittedAt) is
// "effectively pending" only if it is unverified AND no later record has
// already decided it. We key on submittedAt (not just handle+challenge)
// because the same user can legitimately re-submit the same challenge later —
// those are separate submissions, each needing their own decision.
function findDecisionsFor(all, handle, challenge, submittedAt) {
  return all.filter(
    (r) =>
      r.handle === handle &&
      r.challenge === challenge &&
      r.submittedAt === submittedAt &&
      r.status !== "unverified",
  );
}

function effectivelyPending(all, r) {
  return (
    r.status === "unverified" &&
    findDecisionsFor(all, r.handle, r.challenge, r.submittedAt).length === 0
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

// Read every challenge record from the LIST (newest-first, just like the API
// echoes). @upstash/redis auto-parses the JSON elements into objects.
async function readAll(redis) {
  return redis.lrange(CHALLENGES_KEY, 0, -1);
}

function fmtRow(r, i) {
  return [
    String(i + 1).padStart(3),
    r.submittedAt ?? "?",
    `[${r.status}]`.padEnd(12),
    r.handle.padEnd(20),
    r.challenge.padEnd(16),
    `claimed=${r.claimedFixes}`,
    r.verifiedFixes != null ? `verified=${r.verifiedFixes}` : "",
    r.verifiedAt ? `verifiedAt=${r.verifiedAt}` : "",
  ].join("  ");
}

async function cmdList(redis, { handle, challenge }) {
  const all = await readAll(redis);
  // codex MED #2: only show rows that are *effectively* pending. An
  // unverified row whose (handle, challenge, submittedAt) already has a
  // verified/rejected sibling is no longer the operator's job — showing it
  // here invites a duplicate decision.
  const pending = all.filter(
    (r) =>
      effectivelyPending(all, r) &&
      (handle == null || r.handle === handle) &&
      (challenge == null || r.challenge === challenge),
  );
  console.log(
    `Total LIST length: ${all.length} / cap ${CHALLENGES_CAP}` +
      `  |  pending${handle ? ` handle=${handle}` : ""}${
        challenge ? ` challenge=${challenge}` : ""
      }: ${pending.length}`,
  );
  if (pending.length === 0) {
    console.log("(no effectively-pending submissions match)");
    return;
  }
  for (let i = 0; i < pending.length; i++) {
    console.log(fmtRow(pending[i], i));
  }
}

// Find the most-recent unverified record for (handle, challenge). LRANGE is
// newest-first, so the first match is the latest claim.
function findLatestUnverified(all, handle, challenge) {
  return all.find(
    (r) =>
      r.handle === handle &&
      r.challenge === challenge &&
      r.status === "unverified",
  );
}

async function cmdDecide(
  redis,
  { mode, handle, challenge, fixes, apply, force },
) {
  if (!handle || !challenge) {
    usage();
    process.exit(1);
  }
  if (mode === "verify") {
    if (fixes == null || !Number.isInteger(fixes) || fixes < 0) {
      console.error("Error: --verify requires --fixes <non-negative integer>.");
      process.exit(1);
    }
  }

  const all = await readAll(redis);
  const original = findLatestUnverified(all, handle, challenge);
  if (original == null) {
    console.error(
      `Error: no unverified submission for handle "${handle}" challenge "${challenge}".`,
    );
    console.error("Run --list first to see available unverified rows.");
    process.exit(1);
  }

  // codex MED #2: refuse to append if (handle, challenge, submittedAt) is
  // already decided. There is a small TOCTOU window between this check and
  // the EVAL below — acceptable for an admin CLI that's invoked rarely by a
  // single operator. --force lets the operator deliberately stack a decision
  // on top (e.g., reversing an earlier mistake) with eyes open.
  const prior = findDecisionsFor(
    all,
    handle,
    challenge,
    original.submittedAt,
  );
  if (prior.length > 0 && !force) {
    console.error(
      `Error: prior decision(s) exist for ${handle} [${challenge}] submittedAt=${original.submittedAt}:`,
    );
    for (let i = 0; i < prior.length; i++) {
      console.error("  " + fmtRow(prior[i], i));
    }
    console.error(
      "Use --force to override (a new record will be appended on top).",
    );
    process.exit(1);
  }

  const now = await getServerTimeIso(redis);
  // Append-only: build a fresh ChallengeRecord, do NOT mutate `original`. We
  // preserve the original handle/challenge/claimedFixes/submittedAt so the
  // audit trail keeps both rows (codex Plan #1's "append-only audit log").
  const newRecord = projectChallenge({
    handle: original.handle,
    challenge: original.challenge,
    claimedFixes: original.claimedFixes,
    status: mode === "verify" ? "verified" : "rejected",
    verifiedFixes: mode === "verify" ? fixes : null,
    submittedAt: original.submittedAt,
    verifiedAt: now,
  });

  console.log("Original (kept as audit row):");
  console.log("  " + fmtRow(original, 0));
  console.log("Will append:");
  console.log("  " + fmtRow(newRecord, 0));

  if (!apply) {
    console.log("\n[dry-run] no write performed. Re-run with --apply to commit.");
    return;
  }

  await redis.eval(
    ADD_CHALLENGE_LUA,
    [CHALLENGES_KEY],
    [JSON.stringify(newRecord), String(CHALLENGES_CAP - 1)],
  );
  console.log(
    `\n[applied] appended ${newRecord.status} record for ${handle} [${challenge}]` +
      (mode === "verify" ? ` (verifiedFixes=${fixes})` : ""),
  );
  console.log(
    "Leaderboard will reflect this on its next read — verifiedFixesByHandle() " +
      "dedups by latest verifiedAt per (handle, challenge).",
  );
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`Error: ${err.message}`);
    console.error("");
    usage();
    process.exit(1);
  }
  if (args.mode == null) {
    usage();
    process.exit(1);
  }
  requireEnv();
  const redis = Redis.fromEnv();

  if (args.mode === "list") {
    await cmdList(redis, args);
  } else if (args.mode === "verify" || args.mode === "reject") {
    await cmdDecide(redis, args);
  } else {
    usage();
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal:", err?.message ?? err);
  process.exit(1);
});
