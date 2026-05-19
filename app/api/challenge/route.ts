// app/api/challenge/route.ts — challenge submission API.
//
// POST → a builder claims N fixes for a challenge. After shape validation the
// endpoint runs two gates: a per-handle rate-limit (isRateLimited → 429) and
// then triage (triageChallenge), which auto-verifies small claims and leaves
// larger ones unverified for scripts/verify-challenge.mjs. The persisted
// record carries triage's status/verifiedFixes/verifiedAt.

import {
  addChallenge,
  isRateLimited,
  triageChallenge,
  type ChallengeRecord,
} from "@/lib/server/challenge";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be JSON." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return Response.json({ error: "Request body must be a JSON object." }, { status: 400 });
  }

  const { handle, challenge, claimedFixes } = body as Record<string, unknown>;
  if (typeof handle !== "string" || !handle.trim()) {
    return Response.json({ error: "A handle is required to submit." }, { status: 400 });
  }
  if (typeof challenge !== "string" || !challenge.trim()) {
    return Response.json({ error: "Select a challenge." }, { status: 400 });
  }
  if (
    typeof claimedFixes !== "number" ||
    !Number.isInteger(claimedFixes) ||
    claimedFixes < 1
  ) {
    return Response.json(
      { error: "Claimed fixes must be a whole number of at least 1." },
      { status: 400 },
    );
  }

  const cleanHandle = handle.trim();
  const now = new Date().toISOString();

  try {
    if (await isRateLimited(cleanHandle, now)) {
      return Response.json(
        { error: "Too many submissions. Try again later." },
        { status: 429 },
      );
    }

    const triage = triageChallenge(claimedFixes, now);
    const record: ChallengeRecord = {
      handle: cleanHandle,
      challenge: challenge.trim(),
      claimedFixes,
      status: triage.status,
      verifiedFixes: triage.verifiedFixes,
      submittedAt: now,
      verifiedAt: triage.verifiedAt,
    };

    await addChallenge(record);
    return Response.json({ record }, { status: 201 });
  } catch {
    return Response.json(
      { error: "Could not save your submission. Try again." },
      { status: 500 },
    );
  }
}
