import { listPublishedArticles } from "@/lib/db/articles";
import { articleUrl, NEWS_URL, NEWSROOM_NAME } from "@/lib/news/seo";

/**
 * 한솔닷컴 뉴스룸 RSS 2.0 피드 본문 생성.
 * 발행 기사 최신순. 피드 리더·신디케이션·발견 경로. `/news/feed.xml` 과 `/news/rss`(= news.hsol.info/rss) 가 공유한다.
 */

const FEED_URL = `${NEWS_URL}/feed.xml`;
const HUB_URL = `${NEWS_URL}`;
const FEED_DESCRIPTION =
  "한솔닷컴 뉴스룸이 임한솔의 일과 사건을 취재해 기록하는 뉴스 피드.";

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function rfc822(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date(0).toUTCString() : d.toUTCString();
}

/** RSS 2.0 XML 문자열을 생성한다. */
export async function buildNewsFeedXml(): Promise<string> {
  const articles = await listPublishedArticles(50);
  const lastBuild = articles[0]
    ? rfc822(articles[0].updatedAt ?? articles[0].publishedAt)
    : new Date(0).toUTCString();

  const items = articles
    .map((a) => {
      const link = articleUrl(a.slug);
      // coverImage 없으면 동적 OG 이미지 폴백(기사 페이지·og 카드와 동일 이미지).
      const image = a.coverImage ?? `${link}/opengraph-image/og`;
      return [
        "    <item>",
        `      <title>${xmlEscape(a.headline)}</title>`,
        `      <link>${link}</link>`,
        `      <guid isPermaLink="true">${link}</guid>`,
        `      <pubDate>${rfc822(a.publishedAt)}</pubDate>`,
        `      <category>${xmlEscape(a.section)}</category>`,
        `      <description><![CDATA[${a.dek ?? a.summary}]]></description>`,
        `      <media:thumbnail url="${xmlEscape(image)}" width="1200" height="630" />`,
        "    </item>",
      ].join("\n");
    })
    .join("\n");

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    // 브라우저로 열면 XSL 변환으로 사람이 읽을 페이지가 뜬다(피드 리더는 이 PI 를 무시).
    // href 는 루트 절대경로 — hsol.info·news.hsol.info 어느 오리진에서 열려도 same-origin 으로 로드된다.
    `<?xml-stylesheet type="text/xsl" href="/feed.xsl"?>\n` +
    `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">\n` +
    `  <channel>\n` +
    `    <title>${xmlEscape(NEWSROOM_NAME)}</title>\n` +
    `    <link>${HUB_URL}</link>\n` +
    `    <atom:link href="${FEED_URL}" rel="self" type="application/rss+xml" />\n` +
    `    <description>${xmlEscape(FEED_DESCRIPTION)}</description>\n` +
    `    <language>ko-kr</language>\n` +
    `    <lastBuildDate>${lastBuild}</lastBuildDate>\n` +
    `${items}\n` +
    `  </channel>\n` +
    `</rss>\n`
  );
}

/**
 * 피드를 HTTP 응답으로 반환한다.
 * Content-Type 은 RSS 에 가장 정확한 `application/rss+xml` — 피드 리더의 자동발견·컨텐츠 협상에 부합한다.
 * 사람이 브라우저로 열면 XML 상단의 `<?xml-stylesheet?>` PI 가 `/feed.xsl` 을 적용해 읽을 수 있는 페이지로 변환된다.
 */
export async function buildNewsFeedResponse(): Promise<Response> {
  const xml = await buildNewsFeedXml();
  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
