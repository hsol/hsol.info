import type { Metadata } from "next";
import type { ArticleRow } from "@/types/article";

/**
 * 뉴스룸 SEO 빌더 — 기사 메타데이터·JSON-LD 를 한 곳에서 생성.
 *
 * 콘셉트: 발행 매체는 임한솔의 옛 블로그명을 딴 개인 매체 `한솔닷컴`이고, `한솔닷컴 뉴스룸`이
 * 임한솔의 일과 사건을 취재해 싣는다.
 *
 * 중요 — 작성 주체(author)는 인물이 아니라 **뉴스룸 Organization** 이다. 임한솔을 author 로 두면
 * 검색엔진이 그의 직업을 "기자"로 오인할 수 있으므로, 임한솔은 author 가 아니라 **취재 대상**
 * (`about` → `#person`)으로만 연결한다. publisher 도 같은 뉴스룸이다.
 *
 * 정직성: `한솔닷컴`은 실존 언론사가 아니라 본인 이름을 딴 개인 매체이며 특정 실존 언론사를
 * 사칭하지 않는다. 타입 `NewsArticle` 은 형식·내용이 뉴스이면 쓸 수 있고 정식 언론사 등록을
 * 요구하지 않는다(등록 요건은 별도 제품 Google News 의 것). 실제 사건만 다룬다.
 */

export const SITE_URL = "https://hsol.info";
/** 매체명(마스트헤드) — author·publisher·og:siteName 에 쓰는 매체 이름. */
export const PUBLICATION = "한솔닷컴";
/** 섹션명 — 허브/컬렉션 표기. */
export const NEWSROOM_NAME = "한솔닷컴 뉴스룸";
export const NEWSROOM_ID = `${SITE_URL}/news#publisher`;
const PERSON_ID = `${SITE_URL}/#person`;
const DEFAULT_OG_IMAGE = `${SITE_URL}/og.png`;

export function articleUrl(slug: string): string {
  return `${SITE_URL}/news/${slug}`;
}

function isoOrNull(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function buildArticleMetadata(article: ArticleRow): Metadata {
  const url = `/news/${article.slug}`;
  const published = isoOrNull(article.publishedAt) ?? undefined;
  const modified = isoOrNull(article.updatedAt) ?? published;
  const image = article.coverImage ?? DEFAULT_OG_IMAGE;

  return {
    title: article.headline,
    description: article.summary,
    keywords: article.keywords.length ? article.keywords : article.tags,
    authors: [{ name: article.byline, url: SITE_URL }],
    alternates: { canonical: url },
    robots: { index: article.status === "published", follow: true },
    openGraph: {
      type: "article",
      title: article.headline,
      description: article.dek ?? article.summary,
      url,
      siteName: PUBLICATION,
      locale: "ko_KR",
      publishedTime: published,
      modifiedTime: modified,
      authors: [SITE_URL],
      section: article.section,
      tags: article.tags,
      images: [{ url: image, width: 1200, height: 630, alt: article.coverImageAlt ?? article.headline }],
    },
    twitter: {
      card: "summary_large_image",
      title: article.headline,
      description: article.dek ?? article.summary,
      images: [image],
    },
  };
}

/** schema.org Article + BreadcrumbList. 사이트 루트 그래프의 #person 을 author 로 참조. */
export function buildArticleJsonLd(article: ArticleRow) {
  const url = articleUrl(article.slug);
  const published = isoOrNull(article.publishedAt);
  const modified = isoOrNull(article.updatedAt) ?? published;
  const image = article.coverImage ?? DEFAULT_OG_IMAGE;

  /** 공개 출처 → schema.org citation(CreativeWork). E-E-A-T·근거 신호. */
  const citation = article.references.map((ref) => ({
    "@type": "CreativeWork",
    name: ref.title,
    ...(ref.url ? { url: ref.url } : {}),
  }));

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "NewsArticle",
        "@id": `${url}#article`,
        headline: article.headline,
        description: article.summary,
        image: [image],
        url,
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
        datePublished: published,
        dateModified: modified,
        inLanguage: "ko-KR",
        articleSection: article.section,
        keywords: (article.keywords.length ? article.keywords : article.tags).join(", "),
        author: { "@id": NEWSROOM_ID },
        publisher: { "@id": NEWSROOM_ID },
        about: { "@id": PERSON_ID },
        ...(citation.length ? { citation } : {}),
        isPartOf: { "@id": `${SITE_URL}/#website` },
      },
      {
        "@type": "Organization",
        "@id": NEWSROOM_ID,
        name: PUBLICATION,
        url: `${SITE_URL}/news`,
        parentOrganization: { "@id": `${SITE_URL}/#website` },
        logo: {
          "@type": "ImageObject",
          url: `${SITE_URL}/icons/icon-512.png`,
          width: 512,
          height: 512,
        },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "홈", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "뉴스", item: `${SITE_URL}/news` },
          { "@type": "ListItem", position: 3, name: article.headline, item: url },
        ],
      },
    ],
  };
}

/** 뉴스룸 허브용 CollectionPage + ItemList JSON-LD. */
export function buildNewsHubJsonLd(articles: ArticleRow[]) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${SITE_URL}/news#collection`,
    url: `${SITE_URL}/news`,
    name: NEWSROOM_NAME,
    inLanguage: "ko-KR",
    isPartOf: { "@id": `${SITE_URL}/#website` },
    about: { "@id": PERSON_ID },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: articles.map((a, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: articleUrl(a.slug),
        name: a.headline,
      })),
    },
  };
}
