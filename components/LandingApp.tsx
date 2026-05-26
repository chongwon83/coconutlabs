"use client";

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  Suspense,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Nav } from "@/components/Nav";
import { StatusBar } from "@/components/StatusBar";
import { Hero, type HeroStats } from "@/components/Hero";
import { Ticker } from "@/components/Ticker";
import { BurnIndexSection } from "@/components/BurnIndexSection";
import { Footer } from "@/components/Footer";
import { Toast } from "@/components/Toast";
import { JoinBurnIndexForm } from "@/components/forms/JoinBurnIndexForm";
import { ChallengeInviteForm } from "@/components/forms/ChallengeInviteForm";
import type { ImportedEntry } from "@/lib/data";

const SHOW_LEGACY = process.env.NEXT_PUBLIC_SHOW_LEGACY_SECTIONS === "true";

// Legacy sections are excluded from the bundle entirely when the flag is
// false. The ternary collapses to `null` at build time because the
// NEXT_PUBLIC_* env var is inlined, so the dynamic() import never reaches
// the production chunk graph in the launch configuration.
const LegacySections = SHOW_LEGACY
  ? dynamic(() => import("@/components/LegacySections"))
  : null;

type ModalKind = "join" | "challenge" | null;

const BURN_INDEX_REFRESH_MS = 30_000;

const EMPTY_BURN_INDEX_STATS: HeroStats = {
  builderCount: 0,
  totalTokens: 0,
  totalCost: 0,
};

async function fetchBurnIndexEntries(url: string): Promise<ImportedEntry[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not load Burn Index.");
  const data: { entries?: ImportedEntry[] } = await res.json().catch(() => ({}));
  return Array.isArray(data.entries) ? data.entries : [];
}

function statsFromEntries(entries: ImportedEntry[]): HeroStats {
  return {
    builderCount: entries.length,
    totalTokens: entries.reduce((sum, entry) => sum + entry.totalTokens, 0),
    totalCost: entries.reduce((sum, entry) => sum + entry.estimatedCostUsd, 0),
  };
}

async function fetchBurnIndexStats(url: string): Promise<HeroStats> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not load Burn Index stats.");
  const data: Partial<HeroStats> = await res.json().catch(() => ({}));
  return {
    builderCount:
      typeof data.builderCount === "number" ? data.builderCount : 0,
    totalTokens:
      typeof data.totalTokens === "number" ? data.totalTokens : 0,
    totalCost:
      typeof data.totalCost === "number" ? data.totalCost : 0,
  };
}

// useSearchParams은 production build에서 Suspense boundary 의무 (Next.js 16.2.6
// docs L179). 자식 컴포넌트로 분리해 CSR bailout 범위를 listener만으로 제한.
function AutoDetectListener({
  modal,
  setModal,
  userClosedRef,
}: {
  modal: ModalKind;
  setModal: Dispatch<SetStateAction<ModalKind>>;
  userClosedRef: MutableRefObject<boolean>;
}) {
  const searchParams = useSearchParams();
  useEffect(() => {
    if (
      searchParams?.get("auto-detect") === "1" &&
      modal === null &&
      !userClosedRef.current
    ) {
      setModal("join");
    }
  }, [searchParams, modal, setModal, userClosedRef]);
  return null;
}

export default function LandingApp() {
  const [toast, setToast] = useState({ visible: false, message: "" });
  const [modal, setModal] = useState<ModalKind>(null);
  // 사용자가 한 번 닫으면 같은 세션의 auto-detect 재오픈을 차단 (Invariant #6).
  const userClosedRef = useRef<boolean>(false);

  // useSWR was silently failing to fire its initial fetch on this Next.js 16 +
  // React 19 build (see decision-log 2026-05-26). Plain useEffect+setInterval
  // polling is enough — we only need 30s refresh and an immediate mutate path
  // for POST responses. Errors keep the previous payload so a one-off refresh
  // failure does not blank the leaderboard.
  const [imported, setImported] = useState<ImportedEntry[]>([]);
  const [stats, setStats] = useState<HeroStats>(EMPTY_BURN_INDEX_STATS);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      try {
        const [entries, nextStats] = await Promise.all([
          fetchBurnIndexEntries("/api/burnindex"),
          fetchBurnIndexStats("/api/burnindex/stats"),
        ]);
        if (cancelled) return;
        setImported(entries);
        setStats(nextStats);
      } catch {
        // Swallow — leaderboard keeps last good payload, next tick retries.
      }
    };

    void refresh();
    const id = window.setInterval(refresh, BURN_INDEX_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const mutateImported = useCallback((entries: ImportedEntry[]) => {
    setImported(entries);
  }, []);
  const mutateStats = useCallback((next: HeroStats) => {
    setStats(next);
  }, []);

  // 모든 modal close 경로가 거치는 단일 path — latch set + setModal(null) 결합.
  const closeModal = useCallback(() => {
    userClosedRef.current = true;
    setModal(null);
  }, []);

  const showToast = useCallback(
    (msg: string) => {
      setToast({ visible: true, message: msg });
      closeModal();
    },
    [closeModal],
  );

  const closeToast = useCallback(() => {
    setToast((t) => ({ ...t, visible: false }));
  }, []);

  // The POST response carries the full server-sorted list — dedupe and
  // ordering are the store's job, so update local state immediately and let
  // the next 30s poll reconcile with the shared server state.
  const handleImport = useCallback((entries: ImportedEntry[]) => {
    mutateImported(entries);
    mutateStats(statsFromEntries(entries));
  }, [mutateImported, mutateStats]);

  return (
    <>
      <Suspense fallback={null}>
        <AutoDetectListener
          modal={modal}
          setModal={setModal}
          userClosedRef={userClosedRef}
        />
      </Suspense>
      <StatusBar />
      <Nav
        onJoin={() => setModal("join")}
      />
      <main>
        <Hero
          onJoin={() => setModal("join")}
          stats={stats}
          {...(SHOW_LEGACY ? { onChallenge: () => setModal("challenge") } : {})}
        />
        <Ticker size={SHOW_LEGACY ? "default" : "compact"} />
        <BurnIndexSection imported={imported} />
        {LegacySections && (
          <LegacySections
            slot="mid"
            onJoin={() => setModal("join")}
            onChallenge={() => setModal("challenge")}
          />
        )}
      </main>
      <Footer />

      <Toast
        visible={toast.visible}
        message={toast.message}
        onClose={closeToast}
      />

      {modal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={closeModal}
              aria-label="Close"
            >
              ×
            </button>
            {modal === "join" ? (
              <JoinBurnIndexForm
                onSuccess={showToast}
                onImport={handleImport}
                onClose={closeModal}
              />
            ) : (
              <ChallengeInviteForm onSuccess={showToast} />
            )}
          </div>
        </div>
      )}
    </>
  );
}
