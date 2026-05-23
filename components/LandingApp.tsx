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
import { Hero } from "@/components/Hero";
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
  const [imported, setImported] = useState<ImportedEntry[]>([]);
  // 사용자가 한 번 닫으면 같은 세션의 auto-detect 재오픈을 차단 (Invariant #6).
  const userClosedRef = useRef<boolean>(false);

  // The leaderboard lives on the server now. Fetch it once on mount — every
  // browser hitting this server sees the same imports (incognito included).
  // A failed fetch leaves the list empty rather than breaking the page.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/burnindex")
      .then((res) => (res.ok ? res.json() : { entries: [] }))
      .then((data: { entries?: ImportedEntry[] }) => {
        if (!cancelled && Array.isArray(data.entries)) setImported(data.entries);
      })
      .catch(() => {
        // Server unreachable — render with an empty leaderboard.
      });
    return () => {
      cancelled = true;
    };
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
  // ordering are the store's job, so the client just adopts it wholesale.
  const handleImport = useCallback((entries: ImportedEntry[]) => {
    setImported(entries);
  }, []);

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
