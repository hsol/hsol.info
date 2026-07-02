import { listPublishedArticles } from "@/lib/db/articles";
import { articleUrl, NEWSROOM_NAME, SITE_URL } from "@/lib/news/seo";

/**
 * 한솔닷컴 뉴스룸 RSS 2.0 피드 (`/news/feed.xml`).
 * 발행 기사 최신순. 피드 리더·신디케이션·발견 경로. DB(미러)를 읽으므로 ISR 재검증.
 */
export const revalidate = 600;

const FEED_URL = `${SITE_URL}/news/feed.xml`;
const HUB_URL = `${SITE_URL}/news`;
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

export async function GET(): Promise<Response> {
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

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
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
    `</rss>\n`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
