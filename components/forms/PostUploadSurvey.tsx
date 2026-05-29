"use client";

// PostUploadSurvey — two optional steps shown after a successful FSA upload.
//
// Step 1 (survey): single-question "which step was hardest?" — Axis 3 evidence
//   ("terminal_setup" response rate ≥ 50% of respondents). Fires a
//   survey_responded telemetry event carrying only enums (no raw text).
// Step 2 (email opt-in): the OUTBOUND-comms channel. The user may optionally
//   leave an email to be notified about rank changes / product news. This is the
//   lone piece of individuated PII the product collects, and only ever with an
//   explicit, checkbox-confirmed opt-in (the carve-out — see app/api/emails).
//
// Both steps are skippable and non-blocking: onDone is always called eventually,
// whether the user responds, opts in, or skips.

import { useState } from "react";
import type { DurationBucket, HardestStep } from "@/lib/client/burn/telemetry";
import {
  makeSurveyRespondedEvent,
  sendTelemetryEvent,
} from "@/lib/client/burn/telemetry";
import { subscribeEmail } from "@/lib/client/burn/subscribeEmail";
import { isValidEmail } from "@/lib/email";

const STEP_LABELS: { value: HardestStep; label: string }[] = [
  { value: "terminal_setup", label: "Setting up the terminal / running the collector" },
  { value: "folder_selection", label: "Selecting the right folder in the browser" },
  { value: "browser_permission", label: "Granting read permission in the browser" },
  { value: "upload", label: "Uploading to the leaderboard" },
  { value: "understanding_results", label: "Understanding what the numbers mean" },
  { value: "other_predefined", label: "Something else" },
];

interface PostUploadSurveyProps {
  setupTimeBucket: DurationBucket;
  // The leaderboard handle just validated, so an opt-in email can target the row.
  handle?: string | null;
  onDone: () => void;
}

export function PostUploadSurvey({ setupTimeBucket, handle, onDone }: PostUploadSurveyProps) {
  const [step, setStep] = useState<"survey" | "email">("survey");
  const [selected, setSelected] = useState<HardestStep | null>(null);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);

  function handleSurveySubmit() {
    if (!selected) return;
    const event = makeSurveyRespondedEvent(selected, setupTimeBucket);
    sendTelemetryEvent(event);
    setStep("email");
  }

  function handleSurveySkip() {
    setStep("email");
  }

  const canSubmitEmail = isValidEmail(email) && consent;

  function handleEmailSubmit() {
    if (!canSubmitEmail) return;
    subscribeEmail(email, handle ?? null);
    onDone();
  }

  function handleEmailSkip() {
    onDone();
  }

  if (step === "survey") {
    return (
      <div className="form-card">
        <p className="form-step-label">Quick question (optional)</p>
        <p className="form-desc">Which step was hardest?</p>

        <div className="form-fsa-pickers" style={{ flexDirection: "column", gap: "0.5rem" }}>
          {STEP_LABELS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              className={`form-fsa-picker${selected === value ? " form-fsa-picker--selected" : ""}`}
              onClick={() => setSelected(value)}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
          <button
            type="button"
            className="form-link"
            onClick={handleSurveySubmit}
            disabled={!selected}
            style={{ opacity: selected ? 1 : 0.4 }}
          >
            Submit
          </button>
          <button type="button" className="form-link" onClick={handleSurveySkip}>
            Skip
          </button>
        </div>
      </div>
    );
  }

  // step === "email"
  return (
    <div className="form-card">
      <p className="form-step-label">Stay in the loop (optional)</p>
      <p className="form-desc">
        📬 Want a heads-up when your rank changes? Leave an email — we store it
        with your handle (so we can find your row), kept separate from the public
        leaderboard and never shared or sold.
      </p>

      <div className="form-field">
        <label className="form-label" htmlFor="opt-in-email">
          Email
        </label>
        <input
          id="opt-in-email"
          type="email"
          className="form-input"
          placeholder="you@example.com"
          value={email}
          autoComplete="email"
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <label
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "8px",
          fontSize: "13px",
          color: "var(--fg2)",
          cursor: "pointer",
          lineHeight: 1.4,
        }}
      >
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          style={{ marginTop: "2px", flexShrink: 0 }}
        />
        <span>Email me about rank changes and product news. Unsubscribe anytime.</span>
      </label>

      <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
        <button
          type="button"
          className="form-link"
          onClick={handleEmailSubmit}
          disabled={!canSubmitEmail}
          style={{ opacity: canSubmitEmail ? 1 : 0.4 }}
        >
          Notify me
        </button>
        <button type="button" className="form-link" onClick={handleEmailSkip}>
          No thanks
        </button>
      </div>
    </div>
  );
}
