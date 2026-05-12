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

export const metadata: Metadata = {
  metadataBase: new URL("https://hsol.info"),
  title: "임한솔 · Hansol Lim — hsol.info",
  description:
    "임한솔(Hansol Lim) — 프루퍼 ㈜ 대표 · PPB Studios 팀장. 온라인의 기술과 오프라인의 운영을 잇는 일을 합니다. 10년+ 엔지니어 출신 메이커.",
  authors: [{ name: "임한솔 (Hansol Lim)" }],
  alternates: { canonical: "/" },
  icons: {
    icon: [{ url: "/signature.svg", type: "image/svg+xml" }],
    apple: [{ url: "/og.png" }],
  },
  openGraph: {
    type: "profile",
    siteName: "hsol.info",
    title: "임한솔 · Hansol Lim — hsol.info",
    description:
      "온라인의 기술과 오프라인의 운영을 잇는 임한솔입니다. 프루퍼 ㈜ 대표 · PPB Studios 팀장. 10년+ 엔지니어.",
    url: "https://hsol.info/",
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
    title: "임한솔 · Hansol Lim — hsol.info",
    description:
      "온라인의 기술과 오프라인의 운영을 잇는 임한솔입니다. 프루퍼 ㈜ 대표 · PPB Studios 팀장.",
    images: ["/og.png"],
  },
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
