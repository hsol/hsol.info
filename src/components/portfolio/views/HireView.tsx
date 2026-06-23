"use client";

import { BlockList } from "@/components/portfolio/blocks/BlockList";
import { BlockCallbacksProvider } from "@/components/portfolio/blocks/context";

export function HireView({
  onBack,
  onAnalyzeJd,
}: {
  onBack: () => void;
  onAnalyzeJd?: () => void;
}) {
  return (
    <div className="view">
      <BlockCallbacksProvider value={{ onBack, onAnalyzeJd }}>
        <BlockList page="hire" />
      </BlockCallbacksProvider>
    </div>
  );
}
