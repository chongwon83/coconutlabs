"use client";

import { useState, useCallback } from "react";
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

export default function LandingApp() {
  const [toast, setToast] = useState({ visible: false, message: "" });
  const [modal, setModal] = useState<"join" | "challenge" | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast({ visible: true, message: msg });
    setModal(null);
  }, []);

  const closeToast = useCallback(() => {
    setToast((t) => ({ ...t, visible: false }));
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
        <BurnIndexSection />
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
              <JoinBurnIndexForm onSuccess={showToast} />
            ) : (
              <ChallengeInviteForm onSuccess={showToast} />
            )}
          </div>
        </div>
      )}
    </>
  );
}
