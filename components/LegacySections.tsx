"use client";

import { ChallengeSection } from "@/components/ChallengeSection";
import { BuildersSection } from "@/components/BuildersSection";
import { DropsSection } from "@/components/DropsSection";
import { FinalCTA } from "@/components/FinalCTA";

interface LegacySectionsProps {
  slot: "mid" | "final";
  onJoin: () => void;
  onChallenge: () => void;
}

export default function LegacySections({
  slot,
  onJoin,
  onChallenge,
}: LegacySectionsProps) {
  if (slot === "mid") {
    return (
      <>
        <ChallengeSection onInvite={onChallenge} />
        <BuildersSection />
        <DropsSection onRequest={onJoin} />
      </>
    );
  }
  return <FinalCTA onJoin={onJoin} onChallenge={onChallenge} />;
}
