import type { Metadata } from "next";
import type { ReactNode } from "react";
import { siteFontVariables } from "@/lib/site-fonts";
import { AdSenseScript } from "@/components/AdSenseScript";
import { DeferredThirdPartyScripts } from "@/components/DeferredThirdPartyScripts";
import { DeferredGoogleAnalyticsScripts } from "@/components/DeferredGoogleAnalyticsScripts";
import { PageTranslateBootstrap } from "@/components/PageTranslateBootstrap";
import { SelectionAsk } from "@/components/ask-selection/SelectionAsk";
import { getSiteData } from "@/lib/content/site-data";
import {
  asGraph,
  buildPersonNode,
  buildProoferNode,
  buildWebsiteNode,
} from "@/lib/seo/person-graph";
import "@/styles/legacy/main.css";
import "@/styles/legacy/compose.css";
import "./globals.css";

export const viewport = {
  themeColor: "#0e2a3d",
};

const SITE_URL = "https://hsol.info";
const SITE_TITLE = "임한솔 · Hansol Lim — hsol.info";
/** Naver Webmaster 권장 80자 이내 SERP/SNS 카드 노출 기준. */
const SITE_DESCRIPTION =
  "임한솔(Hansol Lim)의 AI 클론 포트폴리오. 프루퍼 대표·PPB Studios 팀장. Ask Hansol과 대화해 보세요.";
/** 본문/구조화 데이터·OpenGraph 본문 등에서는 더 풍부한 설명도 사용한다. */
const SITE_DESCRIPTION_LONG =
  "임한솔(Hansol Lim)의 AI 클론 포트폴리오 hsol.info | 온라인의 기술과 오프라인의 운영을 잇는 임한솔입니다. | 프루퍼 ㈜ 대표 · PPB Studios 팀장. Ask Hansol과 대화하며 10년+ 엔지니어 출신 메이커의 일과 생각을 살펴봅니다.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE, template: "%s — hsol.info" },
  description: SITE_DESCRIPTION,
  applicationName: "hsol.info",
  authors: [{ name: "임한솔 (Hansol Lim)", url: SITE_URL }],
  creator: "임한솔 (Hansol Lim)",
  publisher: "임한솔 (Hansol Lim)",
  category: "portfolio",
  keywords: [
    "임한솔",
    "Hansol Lim",
    "hsol",
    "hsol.info",
    "프루퍼",
    "Proofer",
    "PPB Studios",
    "AI 포트폴리오",
    "AI 클론",
    "Ask Hansol",
    "엔지니어 출신 메이커",
    "온라인 오프라인",
  ],
  alternates: {
    canonical: "/",
    languages: { "ko-KR": "/", "x-default": "/" },
  },
  formatDetection: { telephone: false, email: false, address: false },
  openGraph: {
    type: "profile",
    siteName: "hsol.info",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: `${SITE_URL}/`,
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "임한솔 — 온라인의 기술과 오프라인의 운영을 잇는",
      },
    ],
    locale: "ko_KR",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/og.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();
  /** 전체 값 예: `ca-pub-7020502027743099` — `NEXT_PUBLIC_ADSENSE_CLIENT_ID` */
  const adsenseClientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID?.trim();

  /**
   * 전역 엔티티 그래프 — Person(site-data 로 학력·경력·언어·기술 보강)·Organization·WebSite.
   * 페이지 단위 노드(ProfilePage/WebPage/BreadcrumbList)는 각 라우트가 별도로 주입한다.
   */
  const siteData = await getSiteData();
  const entityGraph = asGraph([
    buildPersonNode(siteData, SITE_DESCRIPTION_LONG),
    buildProoferNode(),
    buildWebsiteNode(SITE_DESCRIPTION_LONG),
  ]);

  return (
    <html lang="ko" className={siteFontVariables}>
      <head>
        <meta property="og:logo" content={`${SITE_URL}/icons/icon-512.png`} />
        {/* 광고·분석은 지연 로드라 preconnect 대신 가벼운 dns-prefetch만 둔다. */}
        <link rel="dns-prefetch" href="https://pagead2.googlesyndication.com" />
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
        <meta
          name="naver-site-verification"
          content="6fea90e30e52efc3f552b4b4b570cd8c48c582f5"
        />
        <script
          type="application/ld+json"
          // JSON.stringify 결과는 안전하게 직렬화된 JSON 문자열
          dangerouslySetInnerHTML={{ __html: JSON.stringify(entityGraph) }}
        />
      </head>
      <body>
        <a className="skip-link" href="#main-content">
          본문 바로가기
        </a>
        <PageTranslateBootstrap />
        <SelectionAsk />
        {children}
        {adsenseClientId ? <AdSenseScript clientId={adsenseClientId} /> : null}
        {gaMeasurementId ? (
          <DeferredGoogleAnalyticsScripts measurementId={gaMeasurementId} />
        ) : null}
        <DeferredThirdPartyScripts gaMeasurementId={gaMeasurementId} />
      </body>
    </html>
  );
}
