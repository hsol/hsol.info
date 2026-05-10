import type { Metadata } from "next";
import { SiteDataProvider } from "@/components/portfolio/Atoms";
import { ArchitectureDiagramPage } from "@/components/portfolio/ArchitectureDiagramPage";
import { getSiteData } from "@/lib/content/site-data";

export const metadata: Metadata = {
  title: "사이트 구조 — hsol.info",
  description: "hsol.info 저장소·콘텐츠·배포 관계를 한 장에 정리한 구조도입니다.",
  alternates: { canonical: "/architecture" },
};

export default async function ArchitectureRoutePage() {
  const siteData = await getSiteData();
  return (
    <SiteDataProvider data={siteData}>
      <ArchitectureDiagramPage />
    </SiteDataProvider>
  );
}
