"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/primitives";
import { BurnIndexPreviewCard } from "@/components/BurnIndexPreviewCard";
import { PostUploadSurvey } from "@/components/forms/PostUploadSurvey";
import { validateSummary, type BurnSummaryEnvelope } from "@/lib/validateSummary";
import { COLLECTOR_REPO_URL, type ImportedEntry } from "@/lib/data";
import { saveHandle, loadHandle, ensurePermission } from "@/lib/client/burn/handles";
import { loadOrCreateSalt, importSalt } from "@/lib/client/burn/hashing";
import { runImport, type RunImportArgs } from "@/lib/client/burn/import";
import type { Period } from "@/lib/client/burn/collect";
import {
  makeAutoDetectStartedEvent,
  makeAutoDetectCompletedEvent,
  makeAutoDetectFailedEvent,
  sendTelemetryEvent,
  startDurationTimer,
  type DurationBucket,
} from "@/lib/client/burn/telemetry";

interface JoinBurnIndexFormProps {
  onSuccess?: (msg: string) => void;
  onImport?: (entries: ImportedEntry[]) => void;
}

// The quickstart commands rendered in Step 1. `git clone` uses
// COLLECTOR_REPO_URL so a future repo move stays in sync with the source link.
// Python 3.11+ is the only host requirement (the collector is stdlib-only).
const QUICKSTART_COMMANDS = [
  "# 1. Get the collector (one-time)",
  `git clone ${COLLECTOR_REPO_URL}.git`,
  "cd coconutlabs/web/tools/usage-poc",
  "",
  "# 2. Run (Python 3.11+, no dependencies)",
  "python -m coconut_collector --json > burn-summary.json",
  "",
  "# 3. Upload burn-summary.json below ↓",
].join("\n");

// Burn Index import. The user runs the CoconutLabs collector on their own
// machine, then uploads or pastes the resulting Burn Summary JSON. It is
// validated client-side for an instant preview, then POSTed to the server —
// which re-validates (the real trust boundary) and stores it so the
// leaderboard is shared across every browser.
export function JoinBurnIndexForm({ onSuccess, onImport }: JoinBurnIndexFormProps) {
  // Phase 1 state
  const [handle, setHandle] = useState("");
  const [raw, setRaw] = useState("");
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [envelope, setEnvelope] = useState<BurnSummaryEnvelope | null>(null);
  const [copied, setCopied] = useState(false);

  // Phase 2 FSA state
  // NOTE: useSearchParams requires this component to be wrapped in <Suspense>
  // at the call site. The feature flag is active when:
  //   1. ?auto-detect=1 is present in the URL OR NEXT_PUBLIC_AUTO_DETECT_DEFAULT=true, AND
  //   2. showDirectoryPicker is available (Chrome 86+, Edge 86+).
  // Kill-switch: set NEXT_PUBLIC_AUTO_DETECT_DEFAULT=false (or unset) to turn OFF globally.
  const params = useSearchParams();
  const autoDetect =
    (params.get("auto-detect") === "1" ||
      process.env.NEXT_PUBLIC_AUTO_DETECT_DEFAULT === "true") &&
    typeof window !== "undefined" &&
    "showDirectoryPicker" in window;

  const [claudeHandle, setClaudeHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [codexHandle, setCodexHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [salt, setSalt] = useState<string>("");
  const [fsaPeriod, setFsaPeriod] = useState<Period>("week");
  const [fsaEnvelope, setFsaEnvelope] = useState<BurnSummaryEnvelope | null>(null);
  const [fsaError, setFsaError] = useState("");
  const [fsaLoading, setFsaLoading] = useState(false);
  const [fsaHandle, setFsaHandle] = useState("");
  const [fsaSubmitting, setFsaSubmitting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saltInput, setSaltInput] = useState("");
  const [saltMsg, setSaltMsg] = useState("");

  // Telemetry state (Axes 2–3)
  const durationTimerRef = useRef<(() => DurationBucket) | null>(null);
  const [uploadTimeBucket, setUploadTimeBucket] = useState<DurationBucket | null>(null);
  const [showSurvey, setShowSurvey] = useState(false);

  // Load persisted salt and handles from IndexedDB on mount (FSA path only).
  useEffect(() => {
    if (!autoDetect) return;
    loadOrCreateSalt().then(setSalt).catch(() => {});
    loadHandle("claude").then((h) => h && setClaudeHandle(h)).catch(() => {});
    loadHandle("codex").then((h) => h && setCodexHandle(h)).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoDetect]);

  // ── FSA handlers ──────────────────────────────────────────────────────────

  async function pickFolder(kind: "claude" | "codex") {
    try {
      // showDirectoryPicker is a browser API — not available in SSR/node
      const picker = (window as Window & typeof globalThis & {
        showDirectoryPicker(opts?: { mode?: string }): Promise<FileSystemDirectoryHandle>;
      }).showDirectoryPicker;
      const h = await picker({ mode: "read" });
      const expectedName = kind === "claude" ? "projects" : "sessions";
      if (h.name !== expectedName) {
        setFsaError(
          `Selected folder must be the .claude/projects (or .codex/sessions) directory itself, not your home directory. You selected "${h.name}".`,
        );
        return;
      }
      setFsaError("");
      await saveHandle(kind, h);
      if (kind === "claude") setClaudeHandle(h);
      else setCodexHandle(h);
    } catch (e) {
      // User cancelled the picker — not an error
      if (e instanceof DOMException && e.name === "AbortError") return;
      setFsaError("Could not open the folder picker. Check browser permissions.");
    }
  }

  async function handleFsaScan() {
    if (!claudeHandle && !codexHandle) {
      setFsaError("Select at least one folder before scanning.");
      return;
    }
    if (!salt) {
      setFsaError("Salt not ready — please wait a moment and try again.");
      return;
    }
    setFsaError("");
    setFsaEnvelope(null);
    setFsaLoading(true);

    // Telemetry: mark flow start and begin duration timer.
    sendTelemetryEvent(makeAutoDetectStartedEvent(true));
    durationTimerRef.current = startDurationTimer();

    try {
      // Re-verify permissions before iterating (revoked after navigation).
      const handles: [FileSystemDirectoryHandle, "claude" | "codex"][] = [];
      if (claudeHandle) handles.push([claudeHandle, "claude"]);
      if (codexHandle) handles.push([codexHandle, "codex"]);
      for (const [h] of handles) {
        const perm = await ensurePermission(h);
        if (perm !== "granted") {
          setFsaError("Read permission was denied. Re-select the folder and try again.");
          setFsaLoading(false);
          const bucket = durationTimerRef.current?.() ?? "0-1m";
          sendTelemetryEvent(makeAutoDetectFailedEvent(bucket, "permission_denied", "scan"));
          return;
        }
      }
      const args: RunImportArgs = {
        claudeHandle: claudeHandle,
        codexHandle: codexHandle,
        salt,
        period: fsaPeriod,
      };
      const result = await runImport(args);
      setFsaEnvelope(result);
    } catch (e) {
      const bucket = durationTimerRef.current?.() ?? "0-1m";
      sendTelemetryEvent(makeAutoDetectFailedEvent(bucket, "parse_failed", "parse"));
      setFsaError(
        e instanceof Error ? e.message : "Import failed — check the browser console.",
      );
    } finally {
      setFsaLoading(false);
    }
  }

  async function handleFsaUpload() {
    const trimmed = fsaHandle.trim();
    if (!trimmed) {
      setFsaError("Enter a handle to join the Burn Index.");
      return;
    }
    if (!fsaEnvelope || fsaSubmitting) return;
    setFsaError("");
    setFsaSubmitting(true);
    try {
      const raw = JSON.stringify(fsaEnvelope);
      const res = await fetch("/api/burnindex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: trimmed, raw }),
      });
      const data: { entries?: ImportedEntry[]; error?: string } = await res
        .json()
        .catch(() => ({}));
      if (!res.ok) {
        const bucket = durationTimerRef.current?.() ?? "0-1m";
        sendTelemetryEvent(makeAutoDetectFailedEvent(bucket, "upload_failed", "upload"));
        setFsaError(data.error ?? "Could not add to the Burn Index. Try again.");
        return;
      }
      const bucket = durationTimerRef.current?.() ?? "0-1m";
      sendTelemetryEvent(makeAutoDetectCompletedEvent(bucket, "upload_accepted"));
      if (data.entries) onImport?.(data.entries);
      // Show post-upload survey before calling onSuccess.
      setUploadTimeBucket(bucket);
      setShowSurvey(true);
    } catch {
      const bucket = durationTimerRef.current?.() ?? "0-1m";
      sendTelemetryEvent(makeAutoDetectFailedEvent(bucket, "upload_failed", "upload"));
      setFsaError("Could not reach the server. Check your connection and retry.");
    } finally {
      setFsaSubmitting(false);
    }
  }

  async function handleImportSalt() {
    setSaltMsg("");
    try {
      const newSalt = await importSalt(saltInput);
      setSalt(newSalt);
      setSaltInput("");
      setSaltMsg("Python salt imported. Your browser and Python collector now share the same project identity.");
    } catch (e) {
      setSaltMsg(e instanceof Error ? e.message : "Invalid salt value.");
    }
  }

  // ── Phase 1 handlers ──────────────────────────────────────────────────────

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(QUICKSTART_COMMANDS);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may be unavailable on insecure origins or older browsers —
      // fail silently and let the user select+copy manually from the visible code block.
    }
  }

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
      // Send the validated envelope, not the original `raw` string. A pasted
      // file with duplicate JSON keys can validate (JSON.parse keeps the last
      // value) while still carrying the hidden earlier value over the wire —
      // serialising from the parsed envelope strips that channel and keeps
      // the manual-upload path on the same canonical-form contract as the
      // FSA path (lib/client/burn/import.ts also POSTs JSON.stringify).
      const canonicalRaw = JSON.stringify(envelope);
      const res = await fetch("/api/burnindex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: trimmed, raw: canonicalRaw }),
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

  // ── FSA render path (auto-detect=1 + showDirectoryPicker available) ───────

  // Show post-upload survey after a successful FSA upload.
  if (autoDetect && showSurvey && uploadTimeBucket) {
    return (
      <PostUploadSurvey
        setupTimeBucket={uploadTimeBucket}
        onDone={() => {
          setShowSurvey(false);
          onSuccess?.(`Burn Summary validated — ${fsaHandle.trim()} added to the Burn Index.`);
        }}
      />
    );
  }

  if (autoDetect) {
    return (
      <div className="form-card">
        <h3 className="form-title">Auto-detect Burn Summary</h3>
        <p className="form-desc">
          Point this page at your{" "}
          <code className="form-code-inline">.claude/projects</code> and{" "}
          <code className="form-code-inline">.codex/sessions</code> folders.
          Token counts are aggregated locally — only the 9 anonymised fields
          join the Burn Index.
        </p>

        <div className="form-step">
          <div className="form-step-label">Step 1 · Select folders</div>
          <div className="form-step-desc">
            Select only the exact directory shown below — not your home folder.
          </div>
          <div className="form-fsa-pickers">
            <button
              type="button"
              className={`form-fsa-picker${claudeHandle ? " form-fsa-picker--selected" : ""}`}
              onClick={() => pickFolder("claude")}
            >
              {claudeHandle ? `✓ ${claudeHandle.name}` : "Select .claude/projects folder"}
            </button>
            <button
              type="button"
              className={`form-fsa-picker${codexHandle ? " form-fsa-picker--selected" : ""}`}
              onClick={() => pickFolder("codex")}
            >
              {codexHandle ? `✓ ${codexHandle.name}` : "Select .codex/sessions folder"}
            </button>
          </div>
        </div>

        <div className="form-step">
          <div className="form-step-label">Step 2 · Choose period</div>
          <div className="form-fsa-period-row">
            {(["day", "week", "month", "year", "all"] as const).map((p) => (
              <button
                key={p}
                type="button"
                className={`form-fsa-period-btn${fsaPeriod === p ? " form-fsa-period-btn--active" : ""}`}
                onClick={() => setFsaPeriod(p)}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {fsaError && <p className="form-error">{fsaError}</p>}

        <Button
          variant="primary"
          size="lg"
          type="button"
          onClick={handleFsaScan}
          disabled={fsaLoading || (!claudeHandle && !codexHandle)}
        >
          {fsaLoading ? "Scanning…" : "Scan & preview"}
        </Button>

        {fsaEnvelope && (
          <>
            <BurnIndexPreviewCard envelope={fsaEnvelope} />

            <div className="form-field">
              <label className="form-label" htmlFor="jbi-fsa-handle">
                GitHub / X handle <span className="form-note">(required)</span>
              </label>
              <input
                id="jbi-fsa-handle"
                className="form-input"
                type="text"
                placeholder="@yourhandle"
                value={fsaHandle}
                onChange={(e) => setFsaHandle(e.target.value)}
              />
            </div>

            <Button
              variant="primary"
              size="lg"
              type="button"
              onClick={handleFsaUpload}
              disabled={fsaSubmitting}
            >
              {fsaSubmitting ? "Uploading…" : "Upload to leaderboard"}
            </Button>

            <button
              type="button"
              className="form-link"
              onClick={() => { setFsaEnvelope(null); setFsaError(""); }}
            >
              Scan again
            </button>
          </>
        )}

        <div className="form-advanced">
          <button
            type="button"
            className="form-link"
            onClick={() => setShowAdvanced((v) => !v)}
          >
            {showAdvanced ? "▲ Hide" : "▼ Advanced"} — import Python salt
          </button>
          {showAdvanced && (
            <div className="form-advanced-body">
              <p className="form-note">
                Using a separate browser salt means projects imported here will
                appear under different projectHash values than your Python
                collector unless you import the Python salt above.
              </p>
              <p className="form-note">
                To share the same identity, open{" "}
                <code className="form-code-inline">~/.coconutlabs/salt</code> and
                paste its 64-character hex value below.
              </p>
              <div className="form-field">
                <label className="form-label" htmlFor="jbi-salt-import">
                  ~/.coconutlabs/salt contents
                </label>
                <input
                  id="jbi-salt-import"
                  className="form-input"
                  type="text"
                  placeholder="64 lowercase hex characters"
                  value={saltInput}
                  onChange={(e) => setSaltInput(e.target.value)}
                />
              </div>
              {saltMsg && (
                <p className={saltMsg.startsWith("Python salt") ? "form-note" : "form-error"}>
                  {saltMsg}
                </p>
              )}
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={handleImportSalt}
                disabled={!saltInput.trim()}
              >
                Import salt
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Phase 1 render path (file upload / JSON paste) ────────────────────────

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
        Only the aggregated token and cost totals join the shared Burn Index —
        never your prompts, code, or file paths.
      </p>

      <div className="form-step">
        <div className="form-step-label">Step 1 · Run the collector</div>
        <div className="form-step-desc">
          Python 3.11+ required · No dependencies ·{" "}
          <a
            href={COLLECTOR_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="form-link-inline"
          >
            View collector source ↗
          </a>
        </div>
        <div className="form-code-block">
          <pre>
            <code>{QUICKSTART_COMMANDS}</code>
          </pre>
          <button
            type="button"
            data-copied={copied}
            className="form-copy-btn"
            onClick={handleCopy}
            aria-label="Copy quickstart commands"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      <div className="form-step-label">Step 2 · Upload your Burn Summary</div>

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
