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
  groupRepos,
  grantCards,
  resolveGrant,
  type RepoGroup,
  type GroupReposResult,
} from "@/lib/client/burn/repoGroups";
import { countCommits, discoverAuthors, createFsaFs } from "@/lib/client/burn/gitcount";
import {
  makeAutoDetectStartedEvent,
  makeAutoDetectCompletedEvent,
  makeAutoDetectFailedEvent,
  sendTelemetryEvent,
  startDurationTimer,
  type DurationBucket,
} from "@/lib/client/burn/telemetry";
import { fetchCollectorToken } from "@/lib/client/burn/token";
import { loadOrCreateClaimToken } from "@/lib/client/burn/claimToken";

interface JoinBurnIndexFormProps {
  onSuccess?: (msg: string) => void;
  onImport?: (entries: ImportedEntry[], handle?: string) => void;
  // Closes the host modal. Wired from LandingApp so the in-modal "View Leaderboard"
  // CTA can unmount the overlay before scrolling to #burn — without
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

// Derive the half-open commit window [since, until) from the scan's envelope so
// the numerator is counted over the SAME period as the cost denominator (VES is
// "commits in period ÷ cost in period"). Period "all" has null bounds → count
// everything up to the snapshot instant.
function windowFromEnvelope(env: BurnSummaryEnvelope): { since: Date; until: Date } {
  const pw = env.periodWindow;
  if (pw.since && pw.until) return { since: new Date(pw.since), until: new Date(pw.until) };
  return { since: new Date(0), until: new Date(env.generatedAt) };
}

// Remove the VES numerator fields from an envelope (used when a recount fails so
// a stale browser count never rides along with the upload).
function stripNumerator(env: BurnSummaryEnvelope): BurnSummaryEnvelope {
  const rest = { ...env };
  delete rest.verifiedCommits;
  delete rest.verifiedCommitsSource;
  return rest;
}

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

  // C2/C3/C4 — VES browser numerator. Count the operator's own commits across a
  // granted repo-parent folder, in-browser, and attach the tally to the
  // envelope. Everything here is LOCAL-ONLY until the integer count is attached:
  // the raw cwds (rawCwdsRef) and the selected author emails NEVER enter the
  // envelope, the POST body, or any log — only the resulting verifiedCommits
  // integer + its "browser-fsa" provenance do.
  const rawCwdsRef = useRef<{ raw: string; source: "claude" | "codex" }[]>([]);
  // Monotonic token for the in-flight count. Any invalidation (selection change,
  // re-grant, scan reset) bumps it; a count whose token is stale when it resolves
  // must NOT reattach — it was computed for a since-superseded author/repo set.
  const countGenRef = useRef(0);
  // Full scan result (groups + ungrouped), not just `.groups`: a single-repo
  // developer produces groups:[] and must still reach the grant step via the
  // synthesized single cards in `grantCards` (else their VES stays 0.0/Pending).
  const [repoScan, setRepoScan] = useState<GroupReposResult | null>(null);
  const [reposHandle, setReposHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [activeGroup, setActiveGroup] = useState<RepoGroup | null>(null);
  const [authorChips, setAuthorChips] = useState<string[]>([]); // candidate emails to offer
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]); // chosen (local only)
  const [counting, setCounting] = useState(false);
  const [verifiedCount, setVerifiedCount] = useState<number | null>(null);
  const [numeratorError, setNumeratorError] = useState("");

  // Reset all numerator state — called when (re)scanning or "Scan again", so a
  // grant/count from a previous scan never leaks into a fresh one.
  function resetNumerator() {
    rawCwdsRef.current = [];
    countGenRef.current++; // invalidate any in-flight count
    setRepoScan(null);
    setReposHandle(null);
    setActiveGroup(null);
    setAuthorChips([]);
    setSelectedEmails([]);
    setVerifiedCount(null);
    setNumeratorError("");
  }

  // Invalidate just the counted numerator (keep the grant + chips). A count is
  // valid ONLY for the exact (repo, author-set) it was taken over, so any change
  // to that selection — and every non-success recount path — must clear the
  // count AND strip it from the envelope, or a stale value rides the next POST.
  function clearCount() {
    countGenRef.current++; // supersede any in-flight count so it can't reattach
    setVerifiedCount(null);
    setFsaEnvelope((prev) => (prev ? stripNumerator(prev) : prev));
  }

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

  // Single source of truth for the 3 "View Leaderboard" CTAs in the success cards.
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
        showDirectoryPicker(opts?: { mode?: string; id?: string }): Promise<FileSystemDirectoryHandle>;
      }).showDirectoryPicker;
      h = await picker({
        mode: "read",
        id: kind === "claude" ? "coconut-claude-projects" : "coconut-codex-sessions",
      });
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
    resetNumerator();

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
      // C1: capture raw cwds/slugs locally during the walk so C2 can group them
      // into a grantable repo-parent folder. This sink is the ONLY place the raw
      // values surface, and they stay in this component (rawCwdsRef) — never the
      // envelope or POST.
      rawCwdsRef.current = [];
      const args: RunImportArgs = {
        claudeHandle: claudeHandle,
        codexHandle: codexHandle,
        salt,
        period: fsaPeriod,
        onRawCwd: (raw, source) => rawCwdsRef.current.push({ raw, source }),
      };
      const result = await runImport(args);
      setFsaEnvelope(result);
      // C2: group the captured cwds by parent folder for a single-grant prompt.
      // Keep the FULL result — grantCards() falls back to synthesized single-repo
      // cards when no parent reaches the grouping threshold (the orphan path).
      setRepoScan(groupRepos(rawCwdsRef.current));
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
      // Mint/load the per-handle claim token BEFORE the upload. If IDB is
      // unavailable (private mode, blocked storage) we must NOT POST without it:
      // a token-less upload either 400s (unclaimed) or mints a competing claim
      // that locks the user out of their own re-upload. Abort with a clear msg.
      let claimToken: string;
      try {
        claimToken = await loadOrCreateClaimToken(trimmed);
      } catch {
        setFsaError(
          "Couldn't prepare your device claim — browser storage is blocked. " +
            "Turn off private/incognito mode (or allow site storage) and retry.",
        );
        return;
      }
      const burnToken = await fetchCollectorToken("burnindex");
      const res = await fetch("/api/burnindex", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${burnToken}`,
        },
        body: JSON.stringify({ handle: trimmed, raw, claimToken }),
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

  // C2 — grant the repo-parent folder for one group. The picker returns a leaf
  // handle exposing only its name; we verify it matches the group's basename so
  // the user can't accidentally grant the wrong folder (createFsaFs then resolves
  // child repos by name). On success we discover candidate authors (C3).
  async function pickRepoFolder(group: RepoGroup) {
    setNumeratorError("");
    let h: FileSystemDirectoryHandle;
    try {
      const picker = (window as Window & typeof globalThis & {
        showDirectoryPicker(opts?: { mode?: string; id?: string }): Promise<FileSystemDirectoryHandle>;
      }).showDirectoryPicker;
      h = await picker({ mode: "read", id: "coconut-repos-parent" });
    } catch (e) {
      // AbortError = user cancelled the picker; stay silent (Invariant #4: name only).
      if (e instanceof DOMException && e.name === "AbortError") return;
      setNumeratorError(
        "Couldn't open the folder picker. Check the site's file permissions and try again.",
      );
      return;
    }
    // Verify the picked folder against the group. For a single-repo card whose
    // synthesized name was a nested subdir, resolveGrant re-roots onto a real
    // ANCESTOR of the logged cwd (recovering the nested-cwd case) — but rejects
    // an unrelated folder, which could count a different repo's commits and
    // inflate VES. Multi-repo groups keep the strict name check.
    const resolution = resolveGrant(group, h.name);
    if (!resolution.ok || !resolution.group) {
      setNumeratorError(
        resolution.message ??
          `You picked "${h.name}". Grant the folder named "${group.rootName}" (${group.root}) to count its repos.`,
      );
      return;
    }
    const grantedGroup = resolution.group;
    // A (re)grant changes the repo set under the count → invalidate any prior
    // numerator before discovering the new identity set.
    clearCount();
    setReposHandle(h);
    setActiveGroup(grantedGroup);
    // Best-effort persistence (non-fatal, mirrors pickFolder Invariant #5).
    saveHandle("repos", h).catch(() => {});
    await runDiscoverAuthors(h, grantedGroup);
  }

  // C3 — surface candidate author emails for the chip picker: locally configured
  // user.email(s) are preselected, recent HEAD authors are offered. Read-only and
  // best-effort — a discovery failure just yields no chips (count stays disabled).
  async function runDiscoverAuthors(h: FileSystemDirectoryHandle, group: RepoGroup) {
    try {
      const fs = createFsaFs(h, group.root);
      const { configured, recent } = await discoverAuthors({ fs, repoDirs: group.repos });
      // Configured first (preselected), then any recent authors not already listed.
      const chips = [...new Set([...configured, ...recent])];
      setAuthorChips(chips);
      setSelectedEmails(configured);
    } catch {
      setAuthorChips([]);
      setSelectedEmails([]);
    }
  }

  function toggleEmail(email: string) {
    setSelectedEmails((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email],
    );
    // The author set just changed → any prior count is for the wrong identity.
    // Strip it so the user must recount before the new selection can upload.
    clearCount();
  }

  // C4 — count the operator's commits in-browser over the granted repos and
  // attach the integer to the envelope (verifiedCommitsSource "browser-fsa").
  // A null count (shallow clone / no matching author / unreadable) is NOT zero:
  // we surface guidance and strip any stale numerator so VES stays "Pending"
  // rather than asserting a wrong value.
  async function handleCountCommits() {
    if (!reposHandle || !activeGroup || !fsaEnvelope) return;
    if (selectedEmails.length === 0) {
      setNumeratorError("Select at least one author email — counting needs your git identity.");
      return;
    }
    setNumeratorError("");
    setCounting(true);
    // Strip any prior count up front (clearCount also bumps the generation
    // token): the moment a (re)count begins the old value is stale, so every
    // non-success path below (denied / null / throw) leaves the numerator
    // cleared rather than letting a wrong count ride the next upload.
    clearCount();
    // This count owns the current generation. The author set and repo grant are
    // snapshotted into the closure now; if the user changes either while the
    // async count is in flight, that mutation calls clearCount() and bumps the
    // token — we then DROP this result instead of reattaching a count computed
    // for the superseded selection.
    const gen = countGenRef.current;
    try {
      const perm = await ensurePermission(reposHandle);
      if (perm !== "granted") {
        setNumeratorError("Read permission was denied for that folder. Re-grant it and try again.");
        return;
      }
      const fs = createFsaFs(reposHandle, activeGroup.root);
      const { since, until } = windowFromEnvelope(fsaEnvelope);
      const count = await countCommits({
        fs,
        repoDirs: activeGroup.repos,
        authorEmails: selectedEmails,
        since,
        until,
      });
      // Superseded mid-flight (selection changed / re-grant / scan reset) → the
      // count is for a stale author/repo set; drop it (clearCount already
      // stripped the envelope, so the numerator stays absent).
      if (countGenRef.current !== gen) return;
      if (count === null) {
        setNumeratorError(
          "Couldn't verify commits there (no git history under the folder you granted — try granting your repository root, the one with .git — or a shallow clone, or no commits by the selected author in this period). Your upload will skip the commit count and your VES stays Pending.",
        );
        return;
      }
      setVerifiedCount(count);
      setFsaEnvelope((prev) =>
        prev ? { ...prev, verifiedCommits: count, verifiedCommitsSource: "browser-fsa" } : prev,
      );
    } catch {
      setNumeratorError("Commit counting failed. You can still upload without the count.");
    } finally {
      setCounting(false);
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
      // Mint/load the per-handle claim token BEFORE the upload — same contract as
      // the FSA path: never POST token-less (would 400 or mint a competing claim).
      let claimToken: string;
      try {
        claimToken = await loadOrCreateClaimToken(trimmed);
      } catch {
        setError(
          "Couldn't prepare your device claim — browser storage is blocked. " +
            "Turn off private/incognito mode (or allow site storage) and retry.",
        );
        return;
      }
      const burnToken = await fetchCollectorToken("burnindex");
      const res = await fetch("/api/burnindex", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${burnToken}`,
        },
        body: JSON.stringify({ handle: trimmed, raw: canonicalRaw, claimToken }),
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
            <h3 className="upload-success-card__title">You're on the Leaderboard!</h3>
            <p className="upload-success-card__handle">@{successHandle}</p>
            <button
              type="button"
              onClick={goToLeaderboard}
              className="upload-success-card__cta"
            >
              View Leaderboard
            </button>
          </div>
        )}
        <PostUploadSurvey
          setupTimeBucket={uploadTimeBucket}
          handle={fsaHandle.trim()}
          onDone={() => {
            setShowSurvey(false);
            onSuccess?.(`Burn Summary validated — ${fsaHandle.trim()} added to the Burn Index.`);
          }}
        />
      </>
    );
  }

  // Grant cards for the VES count step: the scan's groups, or — when no parent
  // reached the grouping threshold (the single-repo developer) — one synthesized
  // card per discovered repo, so the count step is reachable rather than hidden.
  const repoCards = repoScan ? grantCards(repoScan) : [];

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
            <details className="path-hint-details">
              <summary>Can&apos;t find the folder?</summary>
              <div className="path-hint-body">
                <p><strong>macOS</strong>: In Finder, press <kbd>⌘⇧.</kbd> (period) to reveal hidden folders, then navigate to your home folder → <code>.claude/projects</code> or <code>.codex/sessions</code>.</p>
                <p><strong>Windows</strong>: In File Explorer, paste <code>%USERPROFILE%\.claude\projects</code> into the address bar and press Enter.</p>
              </div>
            </details>
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

            {/* Step 3 (optional) — VES browser numerator. Shown whenever the scan
                surfaced any grantable repo — a multi-repo parent group OR a
                single discovered repo. Counting is entirely local; only the
                resulting integer count joins the upload. */}
            {repoCards.length > 0 && !showSuccess && (
              <div className="form-step form-fsa-numerator">
                <div className="form-step-label">
                  Step 3 · Count verified commits{" "}
                  <span className="form-note">(optional — sharpens your VES)</span>
                </div>
                <p className="form-step-desc">
                  Grant read access to your project or repository root folder
                  (the one holding your <code>.git</code>) so we can count your
                  own commits in this period — entirely in your browser. If we
                  can&apos;t find git history under what you grant, your VES just
                  stays Pending — we never guess a number. Nothing about your
                  code or file paths leaves this page; only the commit count is
                  added to your upload.
                </p>

                {!activeGroup ? (
                  <div className="form-fsa-repo-grants">
                    {repoCards.slice(0, 3).map((g) => (
                      <div key={g.root} className="form-fsa-repo-grant">
                        <button
                          type="button"
                          className="form-fsa-picker"
                          onClick={() => pickRepoFolder(g)}
                        >
                          Grant <code>{g.rootName}/</code> — count {g.repos.length}{" "}
                          repo{g.repos.length === 1 ? "" : "s"}
                        </button>
                        <span className="form-note">{g.root}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <p className="form-note">
                      ✓ Granted <code>{activeGroup.rootName}/</code> (
                      {activeGroup.repos.length} repo
                      {activeGroup.repos.length === 1 ? "" : "s"})
                    </p>

                    {authorChips.length > 0 ? (
                      <>
                        <div className="form-step-desc">
                          Which commit authors are you? (preselected from your
                          local git config)
                        </div>
                        <div className="form-fsa-author-chips">
                          {authorChips.map((email) => {
                            const on = selectedEmails.includes(email);
                            return (
                              <button
                                key={email}
                                type="button"
                                aria-pressed={on}
                                // Locked while a count is in flight: the count is
                                // taken over this exact author set, so mutating it
                                // mid-count would desync the result (the generation
                                // guard in handleCountCommits is the backstop).
                                disabled={counting}
                                className={`form-fsa-chip${on ? " form-fsa-chip--selected" : ""}`}
                                onClick={() => toggleEmail(email)}
                              >
                                {on ? "✓ " : ""}
                                {email}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <p className="form-note">
                        No author identity found in those repos — counting needs
                        at least one email from your git history.
                      </p>
                    )}

                    {verifiedCount !== null && (
                      <p className="form-fsa-count-result">
                        ✓ {verifiedCount} verified commit
                        {verifiedCount === 1 ? "" : "s"} in this period — added to
                        your upload
                      </p>
                    )}

                    {authorChips.length > 0 && (
                      <Button
                        variant="secondary"
                        size="sm"
                        type="button"
                        onClick={handleCountCommits}
                        disabled={counting || selectedEmails.length === 0}
                        aria-busy={counting}
                      >
                        {counting
                          ? "Counting…"
                          : verifiedCount === null
                            ? "Count my commits"
                            : "Recount"}
                      </Button>
                    )}
                  </>
                )}

                {numeratorError && <p className="form-error">{numeratorError}</p>}
              </div>
            )}

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
                <h3 className="upload-success-card__title">You're on the Leaderboard!</h3>
                <p className="upload-success-card__handle">@{successHandle}</p>
                <button
                  type="button"
                  onClick={goToLeaderboard}
                  className="upload-success-card__cta"
                >
                  View Leaderboard
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
                onClick={() => { setFsaEnvelope(null); setFsaError(""); resetNumerator(); }}
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
            <h3 className="upload-success-card__title">You're on the Leaderboard!</h3>
            <p className="upload-success-card__handle">@{successHandle}</p>
            <button
              type="button"
              onClick={goToLeaderboard}
              className="upload-success-card__cta"
            >
              View Leaderboard
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
          placeholder='{ "schemaVersion": "3", "periodWindow": { … }, "rows": [ … ] }'
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
