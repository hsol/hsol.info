"use client";

import { BlockList } from "@/components/portfolio/blocks/BlockList";
import { BlockCallbacksProvider } from "@/components/portfolio/blocks/context";

export function CollabView({
  onBack,
  onAskAdvice,
}: {
  onBack: () => void;
  onAskAdvice?: () => void;
}) {
  return (
    <div className="view">
      <BlockCallbacksProvider value={{ onBack, onAskAdvice }}>
        <BlockList page="collab" />
      </BlockCallbacksProvider>
    </div>
  );
}
