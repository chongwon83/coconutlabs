#!/usr/bin/env node
// verify-challenge.mjs — owner CLI to verify (or reject) a challenge submission.
//
// Automated "did the fix actually work" verification needs the submitter's
// repo + CI, which CoconutLabs does not have. So the owner confirms manually
// after inspecting the claimed work:
//
//   node scripts/verify-challenge.mjs <handle> --fixes <N>
//   node scripts/verify-challenge.mjs <handle> --reject
//
// It flips the most recent UNVERIFIED submission for <handle> to verified
// (with verifiedFixes = N) or rejected. Run from the web/ directory — the
// store lives at web/.data/challenges.json, the same file the API writes.

import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import path from "node:path";

const STORE = path.join(process.cwd(), ".data", "challenges.json");

function parseArgs(argv) {
  const [handle, ...rest] = argv;
  let fixes = null;
  let reject = false;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--fixes") fixes = Number(rest[++i]);
    else if (rest[i] === "--reject") reject = true;
  }
  return { handle, fixes, reject };
}

async function main() {
  const { handle, fixes, reject } = parseArgs(process.argv.slice(2));

  if (!handle) {
    console.error(
      "Usage: node scripts/verify-challenge.mjs <handle> --fixes <N> | --reject",
    );
    process.exit(1);
  }
  if (!reject && (fixes == null || !Number.isInteger(fixes) || fixes < 0)) {
    console.error(
      "Error: --fixes <N> requires a non-negative integer (or pass --reject).",
    );
    process.exit(1);
  }

  let records;
  try {
    records = JSON.parse(await readFile(STORE, "utf-8"));
  } catch {
    console.error(`Error: no challenge store at ${STORE}.`);
    process.exit(1);
  }

  const idx = records.findIndex(
    (r) => r.handle === handle && r.status === "unverified",
  );
  if (idx === -1) {
    console.error(`Error: no unverified submission for handle "${handle}".`);
    process.exit(1);
  }

  const rec = records[idx];
  if (reject) {
    rec.status = "rejected";
    rec.verifiedFixes = null;
  } else {
    rec.status = "verified";
    rec.verifiedFixes = fixes;
  }
  rec.verifiedAt = new Date().toISOString();

  await mkdir(path.dirname(STORE), { recursive: true });
  const tmp = `${STORE}.tmp`;
  await writeFile(tmp, JSON.stringify(records, null, 2), "utf-8");
  await rename(tmp, STORE);

  console.log(
    `${handle}: ${rec.status}${reject ? "" : ` (verifiedFixes=${fixes})`}`,
  );
}

main();
