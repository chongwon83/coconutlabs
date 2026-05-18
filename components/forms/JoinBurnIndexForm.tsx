"use client";

import { useState } from "react";
import { Button } from "@/components/primitives";

interface JoinBurnIndexFormProps {
  onSuccess?: (msg: string) => void;
}

export function JoinBurnIndexForm({ onSuccess }: JoinBurnIndexFormProps) {
  const [handle, setHandle] = useState("");
  const [email, setEmail] = useState("");
  const [tool, setTool] = useState("claude-code");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Placeholder — no backend
    onSuccess?.(`You're on the Burn Index waitlist! We'll reach out at ${email}.`);
    setHandle("");
    setEmail("");
  }

  return (
    <form className="form-card" onSubmit={handleSubmit}>
      <h3 className="form-title">Join Burn Index</h3>
      <p className="form-desc">
        Get your public builder card and start tracking your AI coding efficiency.
      </p>
      <div className="form-field">
        <label className="form-label" htmlFor="jbi-handle">
          GitHub / X handle
        </label>
        <input
          id="jbi-handle"
          className="form-input"
          type="text"
          placeholder="@yourhandle"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          required
        />
      </div>
      <div className="form-field">
        <label className="form-label" htmlFor="jbi-email">
          Email
        </label>
        <input
          id="jbi-email"
          className="form-input"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="form-field">
        <label className="form-label" htmlFor="jbi-tool">
          Primary AI coding tool
        </label>
        <select
          id="jbi-tool"
          className="form-select"
          value={tool}
          onChange={(e) => setTool(e.target.value)}
        >
          <option value="claude-code">Claude Code</option>
          <option value="codex">Codex</option>
          <option value="cursor">Cursor</option>
          <option value="other">Other</option>
        </select>
      </div>
      <Button variant="primary" size="lg" type="submit">
        Request access
      </Button>
      <p className="form-note">Invite-only beta · No spam</p>
    </form>
  );
}
