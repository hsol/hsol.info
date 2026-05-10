"use client";

import { useRouter } from "next/navigation";
import { Back, Foot, Plate } from "@/components/portfolio/Atoms";
import { MermaidDiagram } from "@/components/portfolio/MermaidDiagram";
import { ViewHead } from "@/components/portfolio/view-primitives";
import { SITE_ARCHITECTURE_MERMAID } from "@/content/site-architecture.mermaid";

export function ArchitectureDiagramPage() {
  const router = useRouter();
  return (
    <div className="app-layout">
      <div className="shell">
        <div className="view">
          <Back onBack={() => router.push("/")} />
          <Plate />
          <ViewHead
            room="META · ARCH"
            coord="Z0"
            title={<>사이트 구조</>}
            lede="온톨로지 vault와 SiteData, Blob·CI, Next 런타임·Ask가 서로 어떻게 연결되는지 한 도식으로 정리했습니다."
          >
            <div className="architecture-mermaid-outer view-head-mermaid" aria-label="Architecture diagram">
              <MermaidDiagram chart={SITE_ARCHITECTURE_MERMAID} diagramHead={null} panZoom />
            </div>
          </ViewHead>
          <Foot />
        </div>
      </div>
    </div>
  );
}
