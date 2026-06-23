"use client";

import { BlockList } from "@/components/portfolio/blocks/BlockList";
import { HomeInteractionProvider } from "@/components/portfolio/blocks/context";
import type { PersonaKey } from "@/components/portfolio/portfolio-types";

export function HomeView({ onPick }: { onPick: (key: PersonaKey) => void }) {
  return (
    <HomeInteractionProvider onPick={onPick}>
      {(handlers) => (
        <div className="view" {...handlers}>
          <BlockList page="home" />
        </div>
      )}
    </HomeInteractionProvider>
  );
}
