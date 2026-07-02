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
/**
 * 뉴스룸 정규 오리진 — 뉴스는 news.hsol.info 서브도메인으로 노출한다(미들웨어가 /news 로 rewrite).
 * canonical·og:url·JSON-LD·sitemap 이 모두 이 URL 을 가리켜 검색엔진에 단일 정규 주소를 준다.
 *   news.hsol.info        → 허브
 *   news.hsol.info/<slug> → 기사
 * (#person·#website 등 사이트 정체성 @id 는 메인 도메인 SITE_URL 을 계속 참조한다.)
 */
export const NEWS_URL = "https://news.hsol.info";
/** 매체명(마스트헤드) — author·publisher·og:siteName 에 쓰는 매체 이름. */
export const PUBLICATION = "한솔닷컴";
/** 섹션명 — 허브/컬렉션 표기. */
export const NEWSROOM_NAME = "한솔닷컴 뉴스룸";
export const NEWSROOM_ID = `${SITE_URL}/news#publisher`;
const PERSON_ID = `${SITE_URL}/#person`;

export function articleUrl(slug: string): string {
  return `${NEWS_URL}/${slug}`;
}

function isoOrNull(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function buildArticleMetadata(article: ArticleRow): Metadata {
  const url = `${NEWS_URL}/${article.slug}`;
  const published = isoOrNull(article.publishedAt) ?? undefined;
  const modified = isoOrNull(article.updatedAt) ?? published;
  // coverImage 가 있으면 명시. 없으면 og/twitter images 를 비워 두어, 라우트의 opengraph-image
  // (동적 생성)가 자동으로 카드 이미지로 쓰이게 한다.
  const cover = article.coverImage;
  const coverImages = cover
    ? [{ url: cover, width: 1200, height: 630, alt: article.coverImageAlt ?? article.headline }]
    : undefined;

  return {
    title: article.headline,
    description: article.summary,
    keywords: article.keywords.length ? article.keywords : article.tags,
    authors: [{ name: article.byline, url: SITE_URL }],
    alternates: {
      canonical: url,
      types: { "application/rss+xml": `${NEWS_URL}/feed.xml` },
    },
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
      ...(coverImages ? { images: coverImages } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: article.headline,
      description: article.dek ?? article.summary,
      ...(cover ? { images: [cover] } : {}),
    },
  };
}

/** schema.org Article + BreadcrumbList. 사이트 루트 그래프의 #person 을 author 로 참조. */
export function buildArticleJsonLd(article: ArticleRow) {
  const url = articleUrl(article.slug);
  const published = isoOrNull(article.publishedAt);
  const modified = isoOrNull(article.updatedAt) ?? published;
  // coverImage 없으면 동적 OG 이미지. opengraph-image.tsx 가 generateImageMetadata 로 id "og"
  // 를 붙이므로 실제 경로는 `/opengraph-image/og`(bare 는 404). id 변경 시 함께 수정.
  const image = article.coverImage ?? `${url}/opengraph-image/og`;

  /** 공개 출처 → schema.org citation(CreativeWork). E-E-A-T·근거 신호. */
  const citation = article.references.map((ref) => ({
    "@type": "CreativeWork",
    name: ref.title,
    ...(ref.url ? { url: ref.url } : {}),
  }));

  // 한글 본문 단어 수 근사(공백 분절). 구글 wordCount 신호용.
  const wordCount = article.body.trim().split(/\s+/).filter(Boolean).length;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "NewsArticle",
        "@id": `${url}#article`,
        headline: article.headline,
        description: article.summary,
        image: [{ "@type": "ImageObject", url: image, width: 1200, height: 630 }],
        thumbnailUrl: image,
        url,
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
        datePublished: published,
        dateModified: modified,
        inLanguage: "ko-KR",
        isAccessibleForFree: true,
        wordCount,
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
        url: NEWS_URL,
        founder: { "@id": PERSON_ID },
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
          { "@type": "ListItem", position: 2, name: "뉴스", item: NEWS_URL },
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
    url: NEWS_URL,
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
