"use client";

import { ChallengeSection } from "@/components/ChallengeSection";
import { BuildersSection } from "@/components/BuildersSection";
import { DropsSection } from "@/components/DropsSection";

interface LegacySectionsProps {
  slot: "mid" | "final";
}

export default function LegacySections({ slot }: LegacySectionsProps) {
  if (slot === "mid") {
    return (
      <>
        <ChallengeSection />
        <BuildersSection />
        <DropsSection />
      </>
    );
  }
  return null;
}
