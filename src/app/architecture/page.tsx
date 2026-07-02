import type { Metadata } from "next";
import { SiteDataProvider } from "@/components/portfolio/Atoms";
import { ArchitectureDiagramPage } from "@/components/portfolio/ArchitectureDiagramPage";
import { getSiteData } from "@/lib/content/site-data";
import {
  asGraph,
  buildBreadcrumbList,
  buildWebPageNode,
  SITE_URL,
} from "@/lib/seo/person-graph";

const PAGE_URL = `${SITE_URL}/architecture`;
const PAGE_NAME = "사이트 구조 — hsol.info";
const PAGE_DESC =
  "hsol.info의 저장소·콘텐츠·배포 관계를 한 장에 정리한 구조도. AI 클론 포트폴리오가 어떻게 vault·SSR·Vercel Blob을 잇는지 보여줍니다.";

const ARCHITECTURE_JSON_LD = asGraph([
  buildWebPageNode({
    url: PAGE_URL,
    name: PAGE_NAME,
    description: PAGE_DESC,
    breadcrumbId: `${PAGE_URL}#breadcrumb`,
  }),
  buildBreadcrumbList(PAGE_URL, [
    { name: "홈", url: `${SITE_URL}/` },
    { name: "사이트 구조", url: PAGE_URL },
  ]),
]);

export const metadata: Metadata = {
  title: "사이트 구조 — hsol.info",
  description:
    "hsol.info의 저장소·콘텐츠·배포 관계를 한 장에 정리한 구조도. AI 클론 포트폴리오가 어떻게 vault·SSR·Vercel Blob을 잇는지 보여줍니다.",
  alternates: { canonical: "/architecture" },
  openGraph: {
    type: "article",
    title: "사이트 구조 — hsol.info",
    description:
      "hsol.info의 저장소·콘텐츠·배포 관계를 한 장에 정리한 구조도.",
    url: "/architecture",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "사이트 구조 — hsol.info",
    description:
      "hsol.info의 저장소·콘텐츠·배포 관계를 한 장에 정리한 구조도.",
    images: ["/og.png"],
  },
};

export default async function ArchitectureRoutePage() {
  const siteData = await getSiteData();
  return (
    <SiteDataProvider data={siteData}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ARCHITECTURE_JSON_LD) }}
      />
      <ArchitectureDiagramPage />
    </SiteDataProvider>
  );
}
