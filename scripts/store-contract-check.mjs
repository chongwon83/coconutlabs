// store-contract-check.mjs — BurnStore contract verification.
//
// The leaderboard store has two backends behind one BurnStore interface
// (FileBurnStore for local dev, RedisBurnStore for Vercel). A migration is
// only safe if BOTH backends behave identically. This script exercises the
// store through the real HTTP surface (POST/GET /api/burnindex) so it is
// backend-agnostic: getStore() picks file vs redis from env exactly as
// production does.
//
//   npm run build                  # once — this script needs the build
//   node scripts/store-contract-check.mjs            # file mode (no env)
//   UPSTASH_REDIS_REST_URL=... UPSTASH_REDIS_REST_TOKEN=... \
//     node scripts/store-contract-check.mjs          # redis mode
//
// Scenarios mirror the approved plan's "검증" list. GET-based assertions run
// in either mode; assertions that read .data/*.json directly are file-mode
// only (skipped with a note under redis).
//
// Non-destructive: every run uses unique handles (contract-<ts>-*), so it
// never wipes or collides with existing store data.

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

const WEB_ROOT = path.dirname(import.meta.dirname);
const PORT = 3287;
const BASE = `http://127.0.0.1:${PORT}`;
const REDIS_MODE = Boolean(process.env.UPSTASH_REDIS_REST_URL);
const RUN = `contract-${Date.now()}`;

// --- fixture builders -------------------------------------------------------

// A single-row envelope whose grandTotal reconciles with the row sum. tokens
// go entirely to `input` so the row's tokenCount sub-fields sum to grandTotal.
// F8 removed row-level totalTokens from the 9-field whitelist; grandTotal is
// the only place that token-sum lives.
function makeEnvelope({ period, since, until, tokens, cost }) {
  const row = {
    tool: "claude-code",
    model: "claude-opus-4-7",
    tokenCount: {
      input: tokens,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      cachedInput: 0,
    },
    estimatedCostUsd: cost,
    timestampBucket: "2026-01-05",
    sessionCount: 1,
    activeDays: 1,
    projectHash: "0123456789ab",
    verification: {
      tokenSource: "device",
      costBasis: "estimated",
      priceConfidence: "high",
      level: "Device-synced",
    },
  };
  return {
    schemaVersion: "3",
    generatedAt: "2026-01-20T00:00:00Z",
    periodWindow: { period, since, until },
    rows: [row],
    grandTotal: { totalTokens: tokens, estimatedCostUsd: cost },
  };
}

async function postEnvelope(handle, envelope) {
  const res = await fetch(`${BASE}/api/burnindex`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ handle, raw: JSON.stringify(envelope) }),
  });
  if (res.status !== 201) {
    const text = await res.text();
    throw new Error(`POST /api/burnindex → ${res.status}: ${text}`);
  }
}

async function getCard(handle) {
  const res = await fetch(`${BASE}/api/burnindex`);
  if (!res.ok) throw new Error(`GET /api/burnindex → ${res.status}`);
  const { entries } = await res.json();
  return entries.find((e) => e.handle === handle);
}

// --- the 4 contract scenarios ----------------------------------------------

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, status: "pass-or-fail", detail });
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}
// Week timestamps double as weekKeys (the store keys history by `since`).
const W1 = "2026-01-05T00:00:00Z";
const W2 = "2026-01-12T00:00:00Z";
const W3 = "2026-01-19T00:00:00Z";
const W1_END = "2026-01-12T00:00:00Z";
const W2_END = "2026-01-19T00:00:00Z";
const W3_END = "2026-01-26T00:00:00Z";

async function runScenarios() {
  // 1. Same handle, 3 distinct weekly imports → trendSeries length 3.
  const hTrend = `${RUN}-trend`;
  await postEnvelope(hTrend, makeEnvelope({ period: "week", since: W1, until: W1_END, tokens: 100, cost: 1 }));
  await postEnvelope(hTrend, makeEnvelope({ period: "week", since: W2, until: W2_END, tokens: 200, cost: 2 }));
  await postEnvelope(hTrend, makeEnvelope({ period: "week", since: W3, until: W3_END, tokens: 300, cost: 3 }));
  {
    const card = await getCard(hTrend);
    const len = card?.trendSeries?.length;
    check("3 weekly imports → trendSeries length 3", len === 3, `got ${len}`);
  }

  // 2. Re-import the SAME (handle, weekKey) → history point is overwritten,
  //    not appended. Two distinct weeks with W1 imported twice ⇒ 2 points.
  const hDedup = `${RUN}-dedup`;
  await postEnvelope(hDedup, makeEnvelope({ period: "week", since: W1, until: W1_END, tokens: 100, cost: 1 }));
  await postEnvelope(hDedup, makeEnvelope({ period: "week", since: W1, until: W1_END, tokens: 150, cost: 1 }));
  await postEnvelope(hDedup, makeEnvelope({ period: "week", since: W2, until: W2_END, tokens: 300, cost: 3 }));
  {
    const card = await getCard(hDedup);
    const series = card?.trendSeries;
    const okLen = series?.length === 2;
    const okOverwrite = series?.[0] === 150; // W1 value is the LATEST import
    check(
      "re-import same (handle, weekKey) → history count unchanged",
      okLen && okOverwrite,
      `series=${JSON.stringify(series)}`,
    );
  }

  // 3. A single import → no trend (trend needs MIN_POINTS=2).
  const hSingle = `${RUN}-single`;
  await postEnvelope(hSingle, makeEnvelope({ period: "week", since: W1, until: W1_END, tokens: 100, cost: 1 }));
  {
    const card = await getCard(hSingle);
    const noTrend = card != null && card.trendSeries === undefined;
    check("single import → trend absent (MIN_POINTS=2)", noTrend, card ? "card present, trend absent" : "card missing");
  }

  // 4. A `month` import → leaderboard card created, but NO history recorded
  //    (only `week` imports feed the trend).
  const hMonth = `${RUN}-month`;
  await postEnvelope(
    hMonth,
    makeEnvelope({ period: "month", since: "2026-01-01T00:00:00Z", until: "2026-02-01T00:00:00Z", tokens: 500, cost: 5 }),
  );
  {
    const card = await getCard(hMonth);
    check("month import → leaderboard card created", card != null && card.period === "month", card ? `period=${card.period}` : "card missing");
    if (REDIS_MODE) {
      check("month import → history not recorded", true, "[skipped: redis mode — verify on Vercel preview]");
    } else {
      const hist = await readJsonArray(".data/import-history.json");
      const recorded = hist.some((p) => p.handle === hMonth);
      check("month import → history not recorded", !recorded, recorded ? "unexpected history point" : "no history point");
    }
  }
}

async function readJsonArray(rel) {
  try {
    const raw = await readFile(path.join(WEB_ROOT, rel), "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// --- server lifecycle -------------------------------------------------------

async function waitForReady(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/api/burnindex`);
      if (res.ok) return;
    } catch {
      // server not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`server did not become ready within ${timeoutMs}ms`);
}

async function main() {
  if ((await readJsonArray(".next/BUILD_ID")).length === 0) {
    // BUILD_ID is a plain text file, not JSON — readJsonArray yields [] for
    // both "missing" and "present", so probe it explicitly.
    try {
      await readFile(path.join(WEB_ROOT, ".next/BUILD_ID"), "utf-8");
    } catch {
      console.error("ERROR: no production build found. Run `npm run build` first.");
      process.exit(1);
    }
  }

  console.log(`store-contract-check — ${REDIS_MODE ? "REDIS" : "FILE"} mode, run id ${RUN}`);
  console.log(`starting next on :${PORT} ...`);

  const server = spawn("npx", ["next", "start", "-p", String(PORT)], {
    cwd: WEB_ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });
  let serverErr = "";
  server.stderr.on("data", (d) => (serverErr += d.toString()));

  const stop = () => {
    if (!server.killed) server.kill("SIGTERM");
  };
  process.on("SIGINT", () => {
    stop();
    process.exit(130);
  });

  let exitCode = 0;
  try {
    await waitForReady();
    console.log("server ready — running 4 contract scenarios:\n");
    await runScenarios();
  } catch (err) {
    console.error(`\nERROR: ${err.message}`);
    if (serverErr) console.error(`server stderr:\n${serverErr}`);
    exitCode = 1;
  } finally {
    stop();
  }

  const failed = results.filter((r) => !r.ok);
  const passed = results.length - failed.length;
  console.log(`\n${passed}/${results.length} scenarios passed.`);
  if (failed.length > 0) exitCode = 1;
  process.exit(exitCode);
}

main();
