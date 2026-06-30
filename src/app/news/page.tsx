import type { Metadata } from "next";
import { NewsHub } from "@/components/news/NewsHub";
import { listPublishedArticles } from "@/lib/db/articles";
import { buildNewsHubJsonLd, PUBLICATION } from "@/lib/news/seo";
import "./news.css";

export const revalidate = 600;

const PAGE_TITLE = `${PUBLICATION} 뉴스룸 — 임한솔 취재기록`;
const PAGE_DESCRIPTION =
  "한솔닷컴 뉴스룸이 엔지니어 출신 메이커 임한솔(Hansol Lim)의 일·사건·성과를 취재해 기록하는 뉴스 아카이브.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/news" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: "/news",
    siteName: PUBLICATION,
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: ["/og.png"],
  },
};

export default async function NewsHubPage() {
  const articles = await listPublishedArticles();
  const jsonLd = buildNewsHubJsonLd(articles);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <NewsHub articles={articles} />
    </>
  );
}
