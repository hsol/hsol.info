"use client";

import { useRouter } from "next/navigation";
import { Foot } from "@/components/portfolio/Atoms";
import { BlockList } from "@/components/portfolio/blocks/BlockList";
import { BlockCallbacksProvider } from "@/components/portfolio/blocks/context";

/**
 * /architecture — vault·SiteData·Blob·CI·Ask 연결 구조를 Mermaid 한 장으로.
 * 셸(app-layout/shell/Foot)과 블록 시퀀스(back·plate·viewHead+mermaid)만 조립한다.
 * 레이아웃은 site-data.layout.pages.architecture(없으면 DEFAULT_LAYOUT)가 정한다.
 */
export function ArchitectureDiagramPage() {
  const router = useRouter();
  return (
    <div className="app-layout">
      <div className="shell">
        <main id="main-content">
          <div className="view">
            <BlockCallbacksProvider value={{ onBack: () => router.push("/") }}>
              <BlockList page="architecture" />
            </BlockCallbacksProvider>
          </div>
        </main>
        <Foot />
      </div>
    </div>
  );
}
