"use client";

import { ChallengeSection } from "@/components/ChallengeSection";
import { BuildersSection } from "@/components/BuildersSection";
import { DropsSection } from "@/components/DropsSection";

interface LegacySectionsProps {
  slot: "mid" | "final";
  onJoin: () => void;
}

export default function LegacySections({
  slot,
  onJoin,
}: LegacySectionsProps) {
  if (slot === "mid") {
    return (
      <>
        <ChallengeSection />
        <BuildersSection />
        <DropsSection onRequest={onJoin} />
      </>
    );
  }
  return null;
}
