import type { Metadata } from "next";
import { SiteDataProvider } from "@/components/portfolio/Atoms";
import { EntityProfilePage } from "@/components/portfolio/EntityProfilePage";
import { getSiteData } from "@/lib/content/site-data";

const SITE_URL = "https://hsol.info";

const PAGE_TITLE = "임한솔 (Lim Hansol) — 엔지니어·메이커 | hsol.info";
const PAGE_DESCRIPTION =
  "씨엔티테크·리디북스·토스를 거쳐 프루퍼를 창업한 12년 차 소프트웨어 엔지니어 임한솔. 같은 이름의 정치인·변호사·교수·뮤지컬 배우와 구별되는 엔지니어 임한솔의 경력·활동·연결된 계정을 한곳에 정리한 정본 소개.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/imhansol" },
  openGraph: {
    type: "profile",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: "/imhansol",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: ["/og.png"],
  },
};

/**
 * 이 URL을 "임한솔"이라는 사람(#person)을 다루는 ProfilePage로 명시한다.
 * #person·#website는 루트 레이아웃의 전역 그래프에서 정의되므로 @id로만 참조한다.
 */
const PROFILE_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "ProfilePage",
  "@id": `${SITE_URL}/imhansol#profilepage`,
  url: `${SITE_URL}/imhansol`,
  name: PAGE_TITLE,
  inLanguage: "ko-KR",
  dateModified: new Date().toISOString(),
  isPartOf: { "@id": `${SITE_URL}/#website` },
  about: { "@id": `${SITE_URL}/#person` },
  mainEntity: { "@id": `${SITE_URL}/#person` },
};

export default async function ImhansolRoutePage() {
  const siteData = await getSiteData();
  return (
    <>
      <script
        type="application/ld+json"
        // JSON.stringify 결과는 안전하게 직렬화된 JSON 문자열
        dangerouslySetInnerHTML={{ __html: JSON.stringify(PROFILE_JSON_LD) }}
      />
      <SiteDataProvider data={siteData}>
        <EntityProfilePage />
      </SiteDataProvider>
    </>
  );
}
