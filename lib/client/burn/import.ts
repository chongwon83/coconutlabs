// import.ts — FSA-to-envelope orchestrator for the Phase 2 browser flow.
//
// Thin coordinator: calls buildEnvelope (collect.ts), then runs the
// pre-upload validateSummary guard before returning. The UI shows the
// preview and posts separately — this function never POSTs.
//
// SECURITY: follows the same invariants as collect.ts —
//   - Raw slugs, file paths, and content fields never escape this module.
//   - Only the validated BurnSummaryEnvelope (9-field whitelist per row) is
//     returned; validateSummary rejects any envelope with unexpected keys.
//   - The salt is consumed inside buildEnvelope/hashing.ts and never written
//     into the returned envelope.

import type { BurnSummaryEnvelope } from "@/lib/data";
import type { Period } from "@/lib/client/burn/collect";
import { buildEnvelope } from "@/lib/client/burn/collect";
import { validateSummary } from "@/lib/validateSummary";

export interface RunImportArgs {
  claudeHandle: FileSystemDirectoryHandle | null;
  codexHandle: FileSystemDirectoryHandle | null;
  salt: string;
  period: Period;
  // C1 (VES browser numerator) — optional LOCAL-ONLY sink for the raw
  // slugs/cwds seen during the walk, forwarded verbatim to collect.ts. The
  // form uses these to discover the operator's git repos for in-browser
  // commit counting, then discards them. They never enter the returned
  // envelope (validateSummary's `additionalProperties: false` would reject
  // them anyway) or the eventual POST body.
  onRawCwd?: (raw: string, source: "claude" | "codex") => void;
}

// Orchestrate the full FSA import flow for the browser UI.
//
// Throws when:
//   - period is unknown
//   - no sessions fall within the selected window
//   - validateSummary rejects the assembled envelope (unexpected keys,
//     missing required fields, or schema invariant violations)
//
// Does NOT post to the server — callers display a preview and let the user
// click "Upload to leaderboard" as a separate action.
export async function runImport(
  args: RunImportArgs,
): Promise<BurnSummaryEnvelope> {
  const envelope = await buildEnvelope({
    claudeProjectsHandle: args.claudeHandle,
    codexSessionsHandle: args.codexHandle,
    salt: args.salt,
    period: args.period,
    onRawCwd: args.onRawCwd,
  });

  // Serialize and re-validate via validateSummary to enforce
  // `additionalProperties: false` on root and every row before the envelope
  // reaches the UI or the upload path.
  const raw = JSON.stringify(envelope);
  const result = validateSummary(raw);
  if (!result.ok) {
    // Surface a schema error to the UI without including raw envelope content
    // in the message (envelope may theoretically carry diagnostic paths if
    // an upstream bug slipped through — keep the error opaque).
    throw new Error(`Burn Summary validation failed: ${result.error}`);
  }

  return result.envelope;
}
