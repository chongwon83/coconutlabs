"use client";

import { ChallengeSection } from "@/components/ChallengeSection";
import { BuildersSection } from "@/components/BuildersSection";
import { DropsSection } from "@/components/DropsSection";

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
  return null;
}
