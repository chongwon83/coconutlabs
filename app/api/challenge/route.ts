// app/api/challenge/route.ts — challenge submission API.
//
// POST → a builder claims N fixes for a challenge. The claim is ALWAYS stored
// unverified; it never touches the leaderboard's fixes/VES columns until the
// owner runs scripts/verify-challenge.mjs. This endpoint only validates shape
// and persists the claim — it makes no trust decision about the fixes count.

import { addChallenge, type ChallengeRecord } from "@/lib/server/challenge";

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

  const record: ChallengeRecord = {
    handle: handle.trim(),
    challenge: challenge.trim(),
    claimedFixes,
    status: "unverified",
    verifiedFixes: null,
    submittedAt: new Date().toISOString(),
    verifiedAt: null,
  };

  try {
    await addChallenge(record);
    return Response.json({ record }, { status: 201 });
  } catch {
    return Response.json(
      { error: "Could not save your submission. Try again." },
      { status: 500 },
    );
  }
}
