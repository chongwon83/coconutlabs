"use client";

import { useState } from "react";
import { Button } from "@/components/primitives";

interface ChallengeInviteFormProps {
  onSuccess?: (msg: string) => void;
}

// Challenge submission. A builder claims how many verified fixes they shipped
// for a challenge. The claim is POSTed to /api/challenge and stored
// unverified — it never touches the leaderboard's Fixes/VES columns until the
// owner confirms it with scripts/verify-challenge.mjs.
export function ChallengeInviteForm({ onSuccess }: ChallengeInviteFormProps) {
  const [handle, setHandle] = useState("");
  const [challenge, setChallenge] = useState("lighthouse");
  const [fixes, setFixes] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = handle.trim();
    if (!trimmed) {
      setError("Enter the handle your fixes should count toward.");
      return;
    }
    const claimedFixes = Number(fixes);
    if (!Number.isInteger(claimedFixes) || claimedFixes < 1) {
      setError("Claimed fixes must be a whole number of at least 1.");
      return;
    }
    if (submitting) return;
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: trimmed, challenge, claimedFixes }),
      });
      const data: { error?: string; record?: { status?: string } } = await res
        .json()
        .catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not submit. Try again.");
        return;
      }
      // Triage runs server-side: small claims auto-verify, larger ones queue
      // for owner review. Trust record.status only — never the threshold.
      const fixWord = `fix${claimedFixes === 1 ? "" : "es"}`;
      const status = data.record?.status;
      onSuccess?.(
        status === "verified"
          ? `${claimedFixes} ${fixWord} verified — counted toward your VES.`
          : status === "unverified"
            ? `${claimedFixes} ${fixWord} submitted — pending owner verification.`
            : `Submission received — ${claimedFixes} ${fixWord} recorded.`,
      );
      setHandle("");
      setFixes("");
    } catch {
      setError("Could not reach the server. Check your connection and retry.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="form-card" onSubmit={handleSubmit}>
      <h3 className="form-title">Submit Challenge Fixes</h3>
      <p className="form-desc">
        Claim the fixes you shipped for a challenge. Submissions stay unverified
        until reviewed — only verified fixes count toward your VES.
      </p>
      <div className="form-field">
        <label className="form-label" htmlFor="ci-handle">
          GitHub / X handle <span className="form-note">(required)</span>
        </label>
        <input
          id="ci-handle"
          className="form-input"
          type="text"
          placeholder="@yourhandle"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
        />
      </div>
      <div className="form-field">
        <label className="form-label" htmlFor="ci-challenge">
          Challenge
        </label>
        <select
          id="ci-challenge"
          className="form-select"
          value={challenge}
          onChange={(e) => setChallenge(e.target.value)}
        >
          <option value="lighthouse">Fix a Lighthouse regression ($50)</option>
          <option value="zero-token">Zero-token refactor ($30)</option>
          <option value="bug-hunt">Bug hunt: cost &lt; $0.10 ($20)</option>
        </select>
      </div>
      <div className="form-field">
        <label className="form-label" htmlFor="ci-fixes">
          Verified fixes claimed <span className="form-note">(required)</span>
        </label>
        <input
          id="ci-fixes"
          className="form-input"
          type="number"
          min="1"
          step="1"
          placeholder="e.g. 3"
          value={fixes}
          onChange={(e) => setFixes(e.target.value)}
        />
      </div>
      {error && <p className="form-error">{error}</p>}
      <Button variant="primary" size="lg" type="submit" disabled={submitting}>
        {submitting ? "Submitting…" : "Submit for verification"}
      </Button>
      <p className="form-note">Owner-verified · No vanity metrics</p>
    </form>
  );
}
