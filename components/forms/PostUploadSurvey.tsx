"use client";

// PostUploadSurvey — single-question survey shown after a successful FSA upload.
// Axis 3 evidence: "terminal_setup" response rate ≥ 50% of respondents.
//
// Fires a survey_responded telemetry event. The event carries only the
// selected hardestStep and the setupTimeBucket (both enums) — no raw text.
// Non-blocking: onDone is called regardless of whether the user responds.

import { useState } from "react";
import type { DurationBucket, HardestStep } from "@/lib/client/burn/telemetry";
import {
  makeSurveyRespondedEvent,
  sendTelemetryEvent,
} from "@/lib/client/burn/telemetry";

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
  onDone: () => void;
}

export function PostUploadSurvey({ setupTimeBucket, onDone }: PostUploadSurveyProps) {
  const [selected, setSelected] = useState<HardestStep | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit() {
    if (!selected || submitted) return;
    setSubmitted(true);
    const event = makeSurveyRespondedEvent(selected, setupTimeBucket);
    sendTelemetryEvent(event);
    onDone();
  }

  function handleSkip() {
    onDone();
  }

  if (submitted) return null;

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
          onClick={handleSubmit}
          disabled={!selected}
          style={{ opacity: selected ? 1 : 0.4 }}
        >
          Submit
        </button>
        <button type="button" className="form-link" onClick={handleSkip}>
          Skip
        </button>
      </div>
    </div>
  );
}
