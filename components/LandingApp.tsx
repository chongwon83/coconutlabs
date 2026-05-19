"use client";

import { useState, useCallback, useEffect } from "react";
import { Nav } from "@/components/Nav";
import { StatusBar } from "@/components/StatusBar";
import { Hero } from "@/components/Hero";
import { Ticker } from "@/components/Ticker";
import { BurnIndexSection } from "@/components/BurnIndexSection";
import { ChallengeSection } from "@/components/ChallengeSection";
import { BuildersSection } from "@/components/BuildersSection";
import { DropsSection } from "@/components/DropsSection";
import { TrustSection } from "@/components/TrustSection";
import { FinalCTA } from "@/components/FinalCTA";
import { Footer } from "@/components/Footer";
import { Toast } from "@/components/Toast";
import { JoinBurnIndexForm } from "@/components/forms/JoinBurnIndexForm";
import { ChallengeInviteForm } from "@/components/forms/ChallengeInviteForm";
import type { ImportedEntry } from "@/lib/data";

const IMPORTED_KEY = "coconutlabs.burnindex.imported";
const PERIODS = ["day", "week", "month", "year", "all"];
const VERIF_LEVELS = ["Provider-synced", "Device-synced", "Estimated", "Self-reported"];
const ENTRY_KEYS = [
  "handle", "avatar", "verif", "totalTokens", "estimatedCostUsd",
  "period", "since", "until", "importedAt",
];
const ISO_Z_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

// Defensive read of a stored imported-entry array. localStorage is
// user-editable, so each entry is shape-checked before it reaches the UI —
// a corrupted record is dropped, not rendered. The guard mirrors
// validateSummary: exact key set, enum-checked verif, and the
// period/since/until null invariant (period "all" iff both bounds null).
function isImportedEntry(v: unknown): v is ImportedEntry {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Record<string, unknown>;
  for (const k of Object.keys(e)) {
    if (!ENTRY_KEYS.includes(k)) return false;
  }
  const isBound = (b: unknown) =>
    b === null || (typeof b === "string" && ISO_Z_RE.test(b));
  if (!isBound(e.since) || !isBound(e.until)) return false;
  // A one-sided window (one bound null, the other set) is always invalid;
  // period "all" iff both bounds are null.
  if ((e.since === null) !== (e.until === null)) return false;
  if ((e.period === "all") !== (e.since === null)) return false;
  return (
    typeof e.handle === "string" &&
    typeof e.avatar === "string" &&
    typeof e.verif === "string" &&
    VERIF_LEVELS.includes(e.verif) &&
    typeof e.totalTokens === "number" &&
    typeof e.estimatedCostUsd === "number" &&
    typeof e.period === "string" &&
    PERIODS.includes(e.period) &&
    typeof e.importedAt === "string"
  );
}

function loadImported(): ImportedEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(IMPORTED_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isImportedEntry);
  } catch {
    return [];
  }
}

export default function LandingApp() {
  const [toast, setToast] = useState({ visible: false, message: "" });
  const [modal, setModal] = useState<"join" | "challenge" | null>(null);
  const [imported, setImported] = useState<ImportedEntry[]>([]);

  // localStorage is client-only; reading it post-mount keeps SSR output
  // empty so server and first client render match (no hydration mismatch).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setImported(loadImported());
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast({ visible: true, message: msg });
    setModal(null);
  }, []);

  const closeToast = useCallback(() => {
    setToast((t) => ({ ...t, visible: false }));
  }, []);

  // Dedupe by handle (a re-import replaces the older card), newest first.
  const handleImport = useCallback((entry: ImportedEntry) => {
    setImported((prev) => {
      const next = [entry, ...prev.filter((e) => e.handle !== entry.handle)];
      next.sort((a, b) => b.importedAt.localeCompare(a.importedAt));
      try {
        window.localStorage.setItem(IMPORTED_KEY, JSON.stringify(next));
      } catch {
        // localStorage unavailable (private mode / quota) — keep in-memory.
      }
      return next;
    });
  }, []);

  return (
    <>
      <StatusBar />
      <Nav
        onJoin={() => setModal("join")}
      />
      <main>
        <Hero
          onJoin={() => setModal("join")}
          onChallenge={() => setModal("challenge")}
        />
        <Ticker />
        <BurnIndexSection imported={imported} />
        <ChallengeSection onInvite={() => setModal("challenge")} />
        <BuildersSection />
        <DropsSection onRequest={() => setModal("join")} />
        <TrustSection />
        <FinalCTA
          onJoin={() => setModal("join")}
          onChallenge={() => setModal("challenge")}
        />
      </main>
      <Footer />

      <Toast
        visible={toast.visible}
        message={toast.message}
        onClose={closeToast}
      />

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => setModal(null)}
              aria-label="Close"
            >
              ×
            </button>
            {modal === "join" ? (
              <JoinBurnIndexForm onSuccess={showToast} onImport={handleImport} />
            ) : (
              <ChallengeInviteForm onSuccess={showToast} />
            )}
          </div>
        </div>
      )}
    </>
  );
}
