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
import { fetchCollectorToken } from "@/lib/client/burn/token";

interface JoinBurnIndexFormProps {
  onSuccess?: (msg: string) => void;
  onImport?: (entries: ImportedEntry[], handle?: string) => void;
  // Closes the host modal. Wired from LandingApp so the in-modal "리더보드
  // 보기" CTA can unmount the overlay before scrolling to #burn — without
  // this, the modal sat on top of the leaderboard the user just asked to see.
  onClose?: () => void;
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
export function JoinBurnIndexForm({ onSuccess, onImport, onClose }: JoinBurnIndexFormProps) {
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
  // Kill-switch precedence: env=false blocks ALL paths (including ?auto-detect=1).
  // env unset → query=1 still works (beta testers). env=true → everyone sees FSA.
  const _envFlag = process.env.NEXT_PUBLIC_AUTO_DETECT_DEFAULT;
  const autoDetect =
    (_envFlag === "false"
      ? false
      : _envFlag === "true" || params.get("auto-detect") === "1") &&
    typeof window !== "undefined" &&
    "showDirectoryPicker" in window;

  const [claudeHandle, setClaudeHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [codexHandle, setCodexHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [salt, setSalt] = useState<string>("");
  const [fsaPeriod, setFsaPeriod] = useState<Period>("week");
  const [fsaEnvelope, setFsaEnvelope] = useState<BurnSummaryEnvelope | null>(null);
  const [fsaError, setFsaError] = useState("");
  // Non-fatal warning channel (e.g., IDB persistence failure: folder selected
  // for this session but could not be remembered). Distinct from fsaError so
  // the picker flow continues — Codex Phase 1 PARTIAL mitigation (Invariant #5).
  const [fsaWarning, setFsaWarning] = useState("");
  const [fsaLoading, setFsaLoading] = useState(false);
  const [fsaHandle, setFsaHandle] = useState("");
  const [fsaSubmitting, setFsaSubmitting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saltInput, setSaltInput] = useState("");
  const [saltMsg, setSaltMsg] = useState("");

  // Telemetry state (Axes 2–3)
  const durationTimerRef = useRef<(() => DurationBucket) | null>(null);
  // Chrome dispatches home-folder block as AbortError (Cell #2 verified
  // 2026-05-22: e.name="AbortError", code=20), indistinguishable from
  // intentional cancel. Surface actionable guidance only after the second
  // AbortError — single cancels are common UX exploration; repeated cancels
  // signal real confusion. Invariant #4 preserved: e.name only.
  const abortCountRef = useRef<number>(0);
  const [uploadTimeBucket, setUploadTimeBucket] = useState<DurationBucket | null>(null);
  const [showSurvey, setShowSurvey] = useState(false);
  // A.12: persistent success state — survives the upload handler's `finally`
  // block so the success card stays visible after POST 2xx (gated strictly on
  // response.ok). Cleared in catch so failures restore the CTA + error path.
  const [showSuccess, setShowSuccess] = useState(false);
  const [successHandle, setSuccessHandle] = useState("");
  const successCardRef = useRef<HTMLDivElement>(null);

  // Scroll target for the Upload CTA. Scan completes off-screen on shorter
  // modal viewports — without this, the user lands on the preview card and
  // doesn't see the button that takes them forward. Effect fires once per
  // envelope transition (null → object); "Scan again" resets the latch.
  const uploadCtaRef = useRef<HTMLButtonElement>(null);
  const hasScrolledForEnvelopeRef = useRef(false);
  useEffect(() => {
    if (!fsaEnvelope) {
      hasScrolledForEnvelopeRef.current = false;
      return;
    }
    if (hasScrolledForEnvelopeRef.current) return;
    if (!uploadCtaRef.current) return;
    hasScrolledForEnvelopeRef.current = true;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    uploadCtaRef.current.scrollIntoView({
      block: "nearest",
      behavior: reduce ? "instant" : "smooth",
    });
  }, [fsaEnvelope]);

  // Single source of truth for the 3 "리더보드 보기" CTAs in the success cards.
  // Order matters: close the modal first so React unmounts the overlay (which
  // owns body scroll lock), then on the next frame replace the hash and scroll
  // explicitly. replaceState is used instead of `location.hash =` because the
  // latter triggers the browser's native anchor jump that fights with our
  // smooth scroll. The hash itself is kept so the URL still reflects state for
  // sharing/back-button. prefers-reduced-motion downgrades to "instant".
  const goToLeaderboard = () => {
    onClose?.();
    requestAnimationFrame(() => {
      if (typeof window !== "undefined") {
        history.replaceState(null, "", "#burn");
      }
      const reduce =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document
        .getElementById("burn")
        ?.scrollIntoView({
          block: "start",
          behavior: reduce ? "instant" : "smooth",
        });
    });
  };

  // A.12: scroll success card into the modal viewport + move focus to the
  // status region so screen readers announce it. `block:'nearest'` keeps the
  // scroll inside `.modal-content` rather than jumping the whole page.
  useEffect(() => {
    if (!showSuccess || !successCardRef.current) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    successCardRef.current.scrollIntoView({
      block: "nearest",
      behavior: reduce ? "instant" : "smooth",
    });
    successCardRef.current.focus();
  }, [showSuccess]);

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
    // Step 1 — Picker call. Errors classified by error.name only (Invariant #4:
    // locale-independent). Branches: AbortError silent / SecurityError system
    // folder block / NotAllowedError permission denied / fallback.
    let h: FileSystemDirectoryHandle;
    try {
      const picker = (window as Window & typeof globalThis & {
        showDirectoryPicker(opts?: { mode?: string }): Promise<FileSystemDirectoryHandle>;
      }).showDirectoryPicker;
      h = await picker({ mode: "read" });
    } catch (e) {
      if (e instanceof DOMException) {
        if (e.name === "AbortError") {
          abortCountRef.current += 1;
          if (abortCountRef.current >= 2) {
            setFsaWarning(
              "Trouble picking the folder? Chrome blocks system folders like your home directory — drill into ~/.claude/projects (or ~/.codex/sessions) specifically.",
            );
          }
          return;
        }
        if (e.name === "SecurityError") {
          setFsaError(
            "Chrome blocked that folder because it contains system files. Drill down to your .claude/projects (or .codex/sessions) directory specifically — not your home folder.",
          );
          return;
        }
        if (e.name === "NotAllowedError") {
          setFsaError(
            "Read access wasn't granted. Try again and approve the picker when Chrome prompts.",
          );
          return;
        }
      }
      setFsaError(
        "Couldn't open the folder picker. Try a different browser or check site permissions.",
      );
      return;
    }

    // Step 2 — Name validation. Dynamic h.name + expectedName for actionable
    // error message (Phase 6 cell #3 contract).
    const expectedName = kind === "claude" ? "projects" : "sessions";
    if (h.name !== expectedName) {
      setFsaError(
        `You picked "${h.name}". We need the directory literally named "${expectedName}" (inside ~/.claude/ or ~/.codex/). Try again.`,
      );
      return;
    }

    // Step 3 — Handle React state set IMMEDIATELY (before saveHandle).
    // Invariant #5: picker success ≠ IDB persistence success. The folder is
    // usable for this session regardless of IDB save outcome.
    setFsaError("");
    setFsaWarning("");
    abortCountRef.current = 0;
    if (kind === "claude") setClaudeHandle(h);
    else setCodexHandle(h);

    // Step 4 — IDB persistence is best-effort (non-fatal). Failure surfaces as
    // fsaWarning (distinct channel); fsaError stays empty so Scan button is
    // enabled. Re-selection required on next session if save failed.
    try {
      await saveHandle(kind, h);
    } catch {
      setFsaWarning(
        "Folder selected for this session, but it could not be remembered. You'll need to pick it again next time.",
      );
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
    if (!fsaEnvelope || fsaSubmitting || showSuccess) return;
    setFsaError("");
    setFsaSubmitting(true);
    try {
      const raw = JSON.stringify(fsaEnvelope);
      const burnToken = await fetchCollectorToken("burnindex");
      const res = await fetch("/api/burnindex", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${burnToken}`,
        },
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
      // B.4 MAJOR #1: pass trimmed handle so page-level banner survives modal close.
      if (data.entries) onImport?.(data.entries, trimmed);
      setUploadTimeBucket(bucket);
      setShowSurvey(true);
      setSuccessHandle(trimmed.replace(/^@+/, ""));
      setShowSuccess(true);
    } catch {
      const bucket = durationTimerRef.current?.() ?? "0-1m";
      sendTelemetryEvent(makeAutoDetectFailedEvent(bucket, "upload_failed", "upload"));
      setFsaError("Could not reach the server. Check your connection and retry.");
      setShowSuccess(false);
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
    if (!envelope || submitting || showSuccess) return;
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
      const burnToken = await fetchCollectorToken("burnindex");
      const res = await fetch("/api/burnindex", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${burnToken}`,
        },
        body: JSON.stringify({ handle: trimmed, raw: canonicalRaw }),
      });
      const data: { entries?: ImportedEntry[]; error?: string } = await res
        .json()
        .catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not add to the Burn Index. Try again.");
        return;
      }
      // B.4 MAJOR #1: pass trimmed handle so page-level banner survives modal close.
      if (data.entries) onImport?.(data.entries, trimmed);
      setSuccessHandle(trimmed.replace(/^@+/, ""));
      setShowSuccess(true);
    } catch {
      setError("Could not reach the server. Check your connection and retry.");
      setShowSuccess(false);
    } finally {
      setSubmitting(false);
    }
  }

  // ── FSA render path (auto-detect=1 + showDirectoryPicker available) ───────

  // Show post-upload survey after a successful FSA upload.
  if (autoDetect && showSurvey && uploadTimeBucket) {
    return (
      <>
        {showSuccess && (
          <div
            ref={successCardRef}
            tabIndex={-1}
            role="status"
            aria-live="polite"
            className="upload-success-card"
          >
            <h3 className="upload-success-card__title">리더보드에 추가되었어요</h3>
            <p className="upload-success-card__handle">@{successHandle}</p>
            <button
              type="button"
              onClick={goToLeaderboard}
              className="upload-success-card__cta"
            >
              리더보드 보기
            </button>
          </div>
        )}
        <PostUploadSurvey
          setupTimeBucket={uploadTimeBucket}
          onDone={() => {
            setShowSurvey(false);
            onSuccess?.(`Burn Summary validated — ${fsaHandle.trim()} added to the Burn Index.`);
          }}
        />
      </>
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
            Pick the exact folder previewed below.
          </div>
          <div className="path-preview-card">
            <div className="path-preview-row">
              <span className="path-segment">~</span>
              <span>/</span>
              <span className="path-segment path-segment--hidden">.claude</span>
              <span>/</span>
              <span className="path-segment">projects</span>
            </div>
            <div className="path-preview-row">
              <span className="path-segment">~</span>
              <span>/</span>
              <span className="path-segment path-segment--hidden">.codex</span>
              <span>/</span>
              <span className="path-segment">sessions</span>
            </div>
            <p className="path-preview-hint">
              From your home folder (<code>~</code>), open <code>.claude/projects</code> or <code>.codex/sessions</code>. Reveal hidden folders with{" "}
              <kbd aria-label="Command Shift Period">⌘⇧.</kbd>
              <span className="kbd-label" aria-hidden="true">(period)</span> on macOS or{" "}
              <kbd aria-label="Control H">Ctrl+H</kbd> on Linux.
            </p>
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
        {fsaWarning && <p className="form-warning">{fsaWarning}</p>}

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

            {showSuccess ? (
              <div
                ref={successCardRef}
                tabIndex={-1}
                role="status"
                aria-live="polite"
                className="upload-success-card"
              >
                <h3 className="upload-success-card__title">리더보드에 추가되었어요</h3>
                <p className="upload-success-card__handle">@{successHandle}</p>
                <button
                  type="button"
                  onClick={goToLeaderboard}
                  className="upload-success-card__cta"
                >
                  리더보드 보기
                </button>
              </div>
            ) : (
              <Button
                ref={uploadCtaRef}
                variant="primary"
                size="lg"
                type="button"
                onClick={handleFsaUpload}
                disabled={fsaSubmitting || showSuccess}
                aria-busy={fsaSubmitting}
              >
                {fsaSubmitting ? "Uploading…" : "Upload to leaderboard"}
              </Button>
            )}

            {!showSuccess && (
              <button
                type="button"
                className="form-link"
                onClick={() => { setFsaEnvelope(null); setFsaError(""); }}
              >
                Scan again
              </button>
            )}
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
        {showSuccess ? (
          <div
            ref={successCardRef}
            tabIndex={-1}
            role="status"
            aria-live="polite"
            className="upload-success-card"
          >
            <h3 className="upload-success-card__title">리더보드에 추가되었어요</h3>
            <p className="upload-success-card__handle">@{successHandle}</p>
            <button
              type="button"
              onClick={goToLeaderboard}
              className="upload-success-card__cta"
            >
              리더보드 보기
            </button>
          </div>
        ) : (
          <>
            <Button
              variant="primary"
              size="lg"
              type="button"
              onClick={handleConfirm}
              disabled={submitting || showSuccess}
              aria-busy={submitting}
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
          </>
        )}
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
