import type { Metadata } from "next";
import type { ReactNode } from "react";
import { JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { GoogleAnalyticsReporter } from "@/components/GoogleAnalyticsReporter";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains",
  display: "swap",
});

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

/** schema.org Person + WebSite JSON-LD — 검색엔진 지식 패널·리치 스니펫 노출에 사용 */
const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Person",
      "@id": `${SITE_URL}/#person`,
      name: "임한솔",
      alternateName: ["Hansol Lim", "hsol"],
      url: SITE_URL,
      image: `${SITE_URL}/og.png`,
      jobTitle: "대표 / 메이커",
      description: SITE_DESCRIPTION_LONG,
      worksFor: [
        {
          "@type": "Organization",
          name: "프루퍼 ㈜ (Proofer)",
          url: "https://proofer.tech",
        },
        { "@type": "Organization", name: "PPB Studios" },
      ],
      sameAs: [
        "https://www.linkedin.com/in/hsolim/",
        "https://github.com/hsol",
        "https://medium.com/@hsol",
        "https://gravatar.com/hsolim",
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "hsol.info",
      alternateName: "임한솔 · Hansol Lim",
      description: SITE_DESCRIPTION_LONG,
      inLanguage: "ko-KR",
      author: { "@id": `${SITE_URL}/#person` },
      publisher: { "@id": `${SITE_URL}/#person` },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();
  /** 전체 값 예: `ca-pub-7020502027743099` — `NEXT_PUBLIC_ADSENSE_CLIENT_ID` */
  const adsenseClientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID?.trim();

  return (
    <html lang="ko" className={jetbrainsMono.variable}>
      <head>
        <meta property="og:logo" content={`${SITE_URL}/icons/icon-512.png`} />
        <meta
          name="naver-site-verification"
          content="6fea90e30e52efc3f552b4b4b570cd8c48c582f5"
        />
        <script
          type="application/ld+json"
          // JSON.stringify 결과는 안전하게 직렬화된 JSON 문자열
          dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
        />
        {adsenseClientId ? (
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(adsenseClientId)}`}
            crossOrigin="anonymous"
          />
        ) : null}
      </head>
      <body>
        {children}
        <Analytics />
        {gaMeasurementId ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${gaMeasurementId}');
              `}
            </Script>
            <GoogleAnalyticsReporter measurementId={gaMeasurementId} />
          </>
        ) : null}
      </body>
    </html>
  );
}
