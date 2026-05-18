"use client";

import { useState } from "react";
import { Button } from "@/components/primitives";

interface ChallengeInviteFormProps {
  onSuccess?: (msg: string) => void;
}

export function ChallengeInviteForm({ onSuccess }: ChallengeInviteFormProps) {
  const [email, setEmail] = useState("");
  const [challenge, setChallenge] = useState("lighthouse");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Placeholder — no backend
    onSuccess?.(`Challenge invite requested! Check ${email} for your invite.`);
    setEmail("");
  }

  return (
    <form className="form-card" onSubmit={handleSubmit}>
      <h3 className="form-title">Get Challenge Invite</h3>
      <p className="form-desc">
        Compete on verified efficiency. Judged by VES — no vanity metrics.
      </p>
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
        <label className="form-label" htmlFor="ci-email">
          Email
        </label>
        <input
          id="ci-email"
          className="form-input"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <Button variant="primary" size="lg" type="submit">
        Request invite
      </Button>
      <p className="form-note">Limited spots per challenge round</p>
    </form>
  );
}
