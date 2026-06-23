"use client";

import { BlockList } from "@/components/portfolio/blocks/BlockList";
import { BlockCallbacksProvider } from "@/components/portfolio/blocks/context";

export function CuriousView({
  onBack,
  accent,
}: {
  onBack: () => void;
  accent?: string;
}) {
  return (
    <div className="view">
      <BlockCallbacksProvider value={{ onBack, accent }}>
        <BlockList page="curious" />
      </BlockCallbacksProvider>
    </div>
  );
}
