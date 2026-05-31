// app/api/burnindex/route.ts — the Burn Index leaderboard API.
//
// GET  → the full leaderboard list.
// POST → a raw Burn Summary envelope is validated and stored under a CLAIMED
//        identity (PR2). A client-minted claim token proves "same claimant of
//        @handle" across re-uploads; impostors get 409, never a silent overwrite.
//
// SECURITY: POST requires a valid collector token (Authorization: Bearer <token>)
// issued by /api/internal/issue-collector-token. This prevents external actors
// from forging Axis 1 project_hash counts without going through the browser flow.
// On top of that, the per-handle claim token (in the body, NEVER a header/URL/log)
// gates who may write a given @handle.
//
// CLAIM_MODE (server env, NEVER NEXT_PUBLIC_) switches the write path:
//   - claims_disabled_readonly (default): uploads are paused (503). The body is
//     still validated for an honest 400, but the collector nonce is NEVER spent
//     (A1) — this is the migration window where legacy rows get canonicalized.
//   - claims_enforcing: collector nonce is consumed, then the claim gate decides
//     mint (201) / match (201) / mismatch (409) / legacy-locked (409) / invalid (400).
//
// Schema validation also re-runs validateSummary server-side. Client validation
// is a UX nicety; the trust boundary is HERE.

import type { NextRequest } from "next/server";
import { validateSummary } from "@/lib/validateSummary";
import { buildImportedEntry, computeVes } from "@/lib/data";
import type { ImportedEntry } from "@/lib/data";
import { readEntries, claimAndUpsert } from "@/lib/server/store";
import { trendByHandle } from "@/lib/server/trend";
import { recordSubmission } from "@/lib/server/burn/metrics";
import { verifyAndConsumeToken } from "@/lib/server/burn/token";
import { parseHandle } from "@/lib/server/handle";
import { isValidTokenFormat } from "@/lib/server/claim";
import { logClaimEvent } from "@/lib/server/claimLog";

// The store must reflect every prior import; never prerender GET.
export const dynamic = "force-dynamic";

type ClaimMode = "claims_disabled_readonly" | "claims_enforcing";

// Default to the readonly window: writes stay paused unless the env EXPLICITLY
// flips to enforcing. Fail-safe — a missing/typo'd env never opens the gate.
function getClaimMode(): ClaimMode {
  return process.env.CLAIM_MODE === "claims_enforcing"
    ? "claims_enforcing"
    : "claims_disabled_readonly";
}

// POST responses must never be cached (claim outcomes are per-request identity
// decisions). force-dynamic stops Next's own cache; no-store covers CDN/browser.
function noStore(data: unknown, status: number): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(): Promise<Response> {
  const entries = await readEntries();
  const trends = await trendByHandle();
  // Derive ves at read time from the device-measured commit count persisted on
  // the entry (`fixes`) and the current cost. `fixes` is the single source of
  // truth: an entry without it (browser uploads, pre-v3 rows) keeps ves absent,
  // so the UI renders "—" rather than a fabricated value. Then join the 7d trend.
  const joined = entries.map((entry) => {
    const card = { ...entry };
    if (card.fixes != null) {
      const ves = computeVes(card.fixes, entry.estimatedCostUsd);
      if (ves != null) card.ves = ves;
    }
    const trend = trends.get(entry.handle);
    if (trend != null) {
      card.trendDir = trend.dir;
      card.trendPct = trend.pct;
      card.trendSeries = trend.series;
    }
    return card;
  });
  return Response.json({ entries: joined });
}

// Shared validation for both CLAIM_MODE branches — ONE source of truth so the
// readonly window and the enforcing path can never drift (Q1). Parses + validates
// JSON → object → handle → raw → claim-token FORMAT → summary → week, canonicalizes
// the handle, and returns the built entry. The claim-token check here is FORMAT
// ONLY (43-char base64url); it is NOT the collector nonce — the readonly window
// deliberately never touches the nonce, so "token → 400" in that window means a
// malformed claim token, nothing more.
type ParsedBurnIndexBody =
  | {
      ok: true;
      entry: ImportedEntry;
      claimToken: string | undefined;
      projectHashes: string[];
      handleKey: string;
    }
  | { ok: false; response: Response };

async function parseAndValidateBurnIndexBody(
  request: NextRequest,
): Promise<ParsedBurnIndexBody> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { ok: false, response: noStore({ error: "Request body must be JSON." }, 400) };
  }
  if (typeof body !== "object" || body === null) {
    return {
      ok: false,
      response: noStore({ error: "Request body must be a JSON object." }, 400),
    };
  }

  const { handle, raw, claimToken } = body as Record<string, unknown>;

  if (typeof handle !== "string" || !handle.trim()) {
    return {
      ok: false,
      response: noStore({ error: "A handle is required to join the Burn Index." }, 400),
    };
  }
  // Canonicalize: "@Foo" / "foo" / "FOO" collapse to one key. A non-canonical
  // handle (bad charset/length) is a 400 — never stored raw (the pre-PR2 bug).
  const parsedHandle = parseHandle(handle);
  if (parsedHandle === null) {
    return {
      ok: false,
      response: noStore(
        {
          error:
            "That handle isn't valid — use letters, numbers, and hyphens (no leading hyphen, max 39 chars).",
        },
        400,
      ),
    };
  }

  if (typeof raw !== "string") {
    return { ok: false, response: noStore({ error: "Missing Burn Summary JSON." }, 400) };
  }

  // Claim token is OPTIONAL in the body; when present it must be the exact
  // 43-char base64url shape. A missing token is allowed HERE — the store decides
  // invalid (unclaimed) vs mismatch (claimed) from the persisted claim state.
  let token: string | undefined;
  if (claimToken !== undefined) {
    if (typeof claimToken !== "string" || !isValidTokenFormat(claimToken)) {
      return { ok: false, response: noStore({ error: "Invalid claim token." }, 400) };
    }
    token = claimToken;
  }

  const result = validateSummary(raw);
  if (!result.ok) {
    return { ok: false, response: noStore({ error: result.error }, 400) };
  }

  // Only week-period envelopes belong on the leaderboard. Other periods are
  // valid for local audit but must never mix into the shared store.
  if (result.envelope.periodWindow.period !== "week") {
    return {
      ok: false,
      response: noStore(
        { error: "Only 'week' period envelopes can be submitted to the leaderboard." },
        400,
      ),
    };
  }

  const entry = buildImportedEntry(
    result.envelope,
    parsedHandle.handle,
    parsedHandle.display,
  );
  const projectHashes = result.envelope.rows.map((r) => r.projectHash);
  return {
    ok: true,
    entry,
    claimToken: token,
    projectHashes,
    handleKey: parsedHandle.handle,
  };
}

export async function POST(request: NextRequest): Promise<Response> {
  const mode = getClaimMode();

  if (mode === "claims_disabled_readonly") {
    // Readonly window (A1): validate the payload for an honest 400/503, but NEVER
    // call verifyAndConsumeToken — the collector nonce MUST survive the window
    // unspent so a real upload still works the instant we flip to enforcing.
    const parsed = await parseAndValidateBurnIndexBody(request);
    if (!parsed.ok) return parsed.response;
    logClaimEvent("readonlyReject", parsed.handleKey);
    return noStore(
      { error: "Burn Index uploads are paused for maintenance. Please try again soon." },
      503,
    );
  }

  // Enforcing mode: collector token FIRST (the sole nonce-burn), then claim gate.
  const authHeader = request.headers.get("authorization");
  const rawToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!rawToken) {
    return noStore({ error: "Missing Authorization header." }, 401);
  }
  try {
    const tokenResult = await verifyAndConsumeToken(rawToken, "burnindex");
    if (!tokenResult.ok) {
      return noStore({ error: "Invalid or expired token." }, tokenResult.status);
    }
  } catch {
    // Redis unavailable — fail closed.
    return noStore({ error: "Token verification temporarily unavailable." }, 503);
  }

  // Nonce already burned above; body is read exactly once here.
  const parsed = await parseAndValidateBurnIndexBody(request);
  if (!parsed.ok) return parsed.response;
  const { entry, claimToken, projectHashes, handleKey } = parsed;

  try {
    const result = await claimAndUpsert(entry, claimToken);

    switch (result.status) {
      case "claimed":
      case "ok": {
        // mint (first claim) vs match (returning claimant) — both write the card.
        if (result.status === "claimed") logClaimEvent("mint", handleKey);
        // Record distinct project_hash values for Axis 1 gate measurement, only
        // on a real write. Fire-and-forget: metrics failure must not break POST.
        recordSubmission(projectHashes).catch(() => {});
        return noStore({ entry, entries: result.entries }, 201);
      }
      case "mismatch": {
        logClaimEvent("mismatch", handleKey);
        return noStore(
          {
            error: `@${handleKey} is already claimed on another device. Re-upload from the device that first joined, or contact us to recover it.`,
          },
          409,
        );
      }
      case "legacyLocked": {
        logClaimEvent("legacyLocked", handleKey);
        return noStore(
          {
            error: `@${handleKey} is locked from before device claims existed. Recovery is manual in v1 — contact us to reclaim it.`,
          },
          409,
        );
      }
      case "invalid": {
        // No usable claim token on an unclaimed handle.
        logClaimEvent("invalid", handleKey);
        return noStore(
          { error: "A valid claim token is required to join or update this handle." },
          400,
        );
      }
      default: {
        // Fail CLOSED: an unexpected status (store bug / `as any`, or a future
        // ClaimUpsertResult variant) must never echo board state nor masquerade
        // as a 400. The `never` binding makes this exhaustive — adding a status
        // to the union breaks the build here until it is handled above.
        const _exhaustive: never = result;
        void _exhaustive;
        return noStore({ error: "Could not save to the leaderboard. Try again." }, 500);
      }
    }
  } catch {
    return noStore({ error: "Could not save to the leaderboard. Try again." }, 500);
  }
}
