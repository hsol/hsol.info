"use client";

import { BlockList } from "@/components/portfolio/blocks/BlockList";
import { BlockCallbacksProvider } from "@/components/portfolio/blocks/context";

/**
 * /about 본문 — persona 뷰들과 동일하게 PortfolioApp 의 공유 셸(app 셸) 안에서 렌더되는
 * 얇은 컴포넌트. 셸(Foot·Dock·app-layout)은 PortfolioApp 이 제공한다.
 * 레이아웃은 site-data.layout.pages.about(없으면 DEFAULT_LAYOUT)이 정한다.
 */
export function AboutView({ onBack }: { onBack: () => void }) {
  return (
    <div className="view about-view">
      <BlockCallbacksProvider value={{ onBack }}>
        <BlockList page="about" />
      </BlockCallbacksProvider>
    </div>
  );
}
