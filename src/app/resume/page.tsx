import type { Metadata } from "next";
import { SiteDataProvider } from "@/components/portfolio/Atoms";
import { OnePagerPage } from "@/components/portfolio/OnePagerPage";
import { getSiteData } from "@/lib/content/site-data";
import { getOnePagerHtml } from "@/lib/content/onepager";

// 정적 프리렌더 대신 요청 시 렌더 — Blob의 최신 원페이저를 리빌드 없이 반영한다.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "이력서·포트폴리오 — 임한솔 | hsol.info",
  description:
    "임한솔(Hansol Lim)의 이력서와 포트폴리오를 한 장으로. vault 온톨로지에서 자동 생성되며 PDF로 내려받을 수 있습니다.",
  alternates: { canonical: "/resume" },
  openGraph: {
    type: "profile",
    title: "이력서·포트폴리오 — 임한솔",
    description: "12년 개발자에서 CEO까지. 이력서와 포트폴리오를 한 장에.",
    url: "/resume",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "이력서·포트폴리오 — 임한솔",
    description: "12년 개발자에서 CEO까지. 이력서와 포트폴리오를 한 장에.",
    images: ["/og.png"],
  },
};

export default async function ResumeRoutePage() {
  const [siteData, html] = await Promise.all([getSiteData(), getOnePagerHtml()]);
  return (
    <SiteDataProvider data={siteData}>
      <OnePagerPage html={html} />
    </SiteDataProvider>
  );
}
