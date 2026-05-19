"use client";

import { useState } from "react";
import { Button } from "@/components/primitives";
import { BurnIndexPreviewCard } from "@/components/BurnIndexPreviewCard";
import { validateSummary, type BurnSummaryEnvelope } from "@/lib/validateSummary";
import type { ImportedEntry } from "@/lib/data";

interface JoinBurnIndexFormProps {
  onSuccess?: (msg: string) => void;
  onImport?: (entries: ImportedEntry[]) => void;
}

// Burn Index import. The user runs the CoconutLabs collector on their own
// machine, then uploads or pastes the resulting Burn Summary JSON. It is
// validated client-side for an instant preview, then POSTed to the server —
// which re-validates (the real trust boundary) and stores it so the
// leaderboard is shared across every browser.
export function JoinBurnIndexForm({ onSuccess, onImport }: JoinBurnIndexFormProps) {
  const [handle, setHandle] = useState("");
  const [raw, setRaw] = useState("");
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [envelope, setEnvelope] = useState<BurnSummaryEnvelope | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError("");
    setEnvelope(null);
    file
      .text()
      .then((text) => setRaw(text))
      .catch(() => setError("Could not read that file."));
  }

  function handleValidate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setEnvelope(null);
    if (!raw.trim()) {
      setError("Choose a Burn Summary file or paste its JSON below.");
      return;
    }
    const result = validateSummary(raw);
    if (result.ok) {
      setEnvelope(result.envelope);
    } else {
      setError(result.error);
    }
  }

  async function handleConfirm() {
    const trimmed = handle.trim();
    if (!trimmed) {
      setError("Enter a handle to join the Burn Index.");
      return;
    }
    if (!envelope || submitting) return;
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/burnindex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: trimmed, raw }),
      });
      const data: { entries?: ImportedEntry[]; error?: string } = await res
        .json()
        .catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not add to the Burn Index. Try again.");
        return;
      }
      if (data.entries) onImport?.(data.entries);
      onSuccess?.(`Burn Summary validated — ${trimmed} added to the Burn Index.`);
    } catch {
      setError("Could not reach the server. Check your connection and retry.");
    } finally {
      setSubmitting(false);
    }
  }

  if (envelope) {
    return (
      <div className="form-card">
        <BurnIndexPreviewCard envelope={envelope} />
        <div className="form-field">
          <label className="form-label" htmlFor="jbi-handle-confirm">
            GitHub / X handle
          </label>
          <input
            id="jbi-handle-confirm"
            className="form-input"
            type="text"
            placeholder="@yourhandle"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
          />
        </div>
        {error && <p className="form-error">{error}</p>}
        <Button
          variant="primary"
          size="lg"
          type="button"
          onClick={handleConfirm}
          disabled={submitting}
        >
          {submitting ? "Adding…" : "Add to Burn Index"}
        </Button>
        <button
          type="button"
          className="form-link"
          onClick={() => {
            setEnvelope(null);
            setRaw("");
            setFileName("");
            setError("");
          }}
        >
          Import a different file
        </button>
      </div>
    );
  }

  return (
    <form className="form-card" onSubmit={handleValidate}>
      <h3 className="form-title">Join Burn Index</h3>
      <p className="form-desc">
        Run the CoconutLabs collector locally, then import your Burn Summary.
        Only the aggregated token and cost totals join the shared Burn Index —
        never your prompts, code, or file paths.
      </p>

      <div className="form-field">
        <label className="form-label" htmlFor="jbi-handle">
          GitHub / X handle <span className="form-note">(required)</span>
        </label>
        <input
          id="jbi-handle"
          className="form-input"
          type="text"
          placeholder="@yourhandle"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
        />
      </div>

      <div className="form-field">
        <label className="form-label" htmlFor="jbi-file">
          Burn Summary file
        </label>
        <input
          id="jbi-file"
          className="form-input"
          type="file"
          accept=".json,application/json"
          onChange={handleFile}
        />
        {fileName && <p className="form-note">Loaded: {fileName}</p>}
      </div>

      <div className="form-field">
        <label className="form-label" htmlFor="jbi-paste">
          …or paste the JSON
        </label>
        <textarea
          id="jbi-paste"
          className="form-input"
          rows={5}
          placeholder='{ "schemaVersion": "2", "periodWindow": { … }, "rows": [ … ] }'
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            setFileName("");
          }}
        />
      </div>

      {error && <p className="form-error">{error}</p>}

      <Button variant="primary" size="lg" type="submit">
        Validate &amp; preview
      </Button>
      <p className="form-note">Invite-only beta · Aggregates only · No spam</p>
    </form>
  );
}
