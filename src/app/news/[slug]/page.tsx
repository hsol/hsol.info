import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleView } from "@/components/news/ArticleView";
import {
  getPublishedArticleBySlug,
  listPublishedArticleRefs,
} from "@/lib/db/articles";
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

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ArticleView article={article} />
    </>
  );
}
