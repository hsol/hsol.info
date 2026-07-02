import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleView } from "@/components/news/ArticleView";
import { SiteDataProvider } from "@/components/portfolio/Atoms";
import { DeferredChatDock } from "@/components/DeferredChatDock";
import {
  getPublishedArticleBySlug,
  listPublishedArticleRefs,
} from "@/lib/db/articles";
import { getSiteData } from "@/lib/content/site-data";
import { buildArticleJsonLd, buildArticleMetadata } from "@/lib/news/seo";
import "../news.css";

/**
 * 뉴스룸 기사 상세. DB(미러)에서 발행 기사를 읽어 SSR + ISR 로 정적 생성한다.
 * 새 slug 는 `dynamicParams` 로 첫 요청 시 생성되고 이후 캐시된다.
 */
export const revalidate = 600;
export const dynamicParams = true;

export async function generateStaticParams() {
  const refs = await listPublishedArticleRefs();
  return refs.map((r) => ({ slug: r.slug }));
}

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const article = await getPublishedArticleBySlug(slug);
  if (!article) {
    return { title: "기사를 찾을 수 없습니다", robots: { index: false, follow: true } };
  }
  return buildArticleMetadata(article);
}

export default async function NewsArticlePage({ params }: Params) {
  const { slug } = await params;
  const article = await getPublishedArticleBySlug(slug);
  if (!article) notFound();

  const jsonLd = buildArticleJsonLd(article);
  const siteData = await getSiteData();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ArticleView article={article} />
      {/* Ask Hansol — 기사 독자가 맥락을 바로 물어볼 수 있게 FAB 도크를 띄운다.
          포트폴리오 뷰가 아니라 "둘러보기(curious)" 맥락에 기사 제목을 detail 로 실어 보낸다. */}
      <SiteDataProvider data={siteData}>
        <DeferredChatDock
          pageContext={{
            view: "curious",
            section: "news",
            hash: `/news/${article.slug}`,
            detail: article.headline,
          }}
        />
      </SiteDataProvider>
    </>
  );
}
