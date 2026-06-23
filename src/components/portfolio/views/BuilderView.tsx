"use client";

import { BlockList } from "@/components/portfolio/blocks/BlockList";
import { BlockCallbacksProvider } from "@/components/portfolio/blocks/context";

export function BuilderView({ onBack }: { onBack: () => void }) {
  return (
    <div className="view">
      <BlockCallbacksProvider value={{ onBack }}>
        <BlockList page="builder" />
      </BlockCallbacksProvider>
    </div>
  );
}
