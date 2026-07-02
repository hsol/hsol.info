import { listPublishedArticleRefs } from "@/lib/db/articles";
import { articleUrl, NEWS_URL } from "@/lib/news/seo";

/**
 * 뉴스룸 전용 sitemap.
 *
 *   news.hsol.info/sitemap  ← 미들웨어가 /news/sitemap 으로 rewrite
 *   hsol.info/news/sitemap  ← 메인 도메인 경로
 *
 * 메인 hsol.info sitemap 과 분리해 서브도메인 색인을 독립 관리한다(Search Console 에서
 * news.hsol.info 속성에 이 URL 을 제출). DB(미러)를 읽으므로 ISR 재검증한다.
 */
export const revalidate = 600;

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

type Entry = { loc: string; lastmod: string; changefreq: string; priority: string };

export async function GET(): Promise<Response> {
  const refs = await listPublishedArticleRefs();
  const now = new Date().toISOString();

  const entries: Entry[] = [
    // 허브(news.hsol.info) + 각 기사(news.hsol.info/<slug>).
    { loc: NEWS_URL, lastmod: now, changefreq: "daily", priority: "0.8" },
    ...refs.map((r): Entry => {
      const parsed = r.lastmod ? new Date(r.lastmod) : null;
      const lastmod =
        parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : now;
      return { loc: articleUrl(r.slug), lastmod, changefreq: "monthly", priority: "0.7" };
    }),
  ];

  const body = entries
    .map(
      (e) =>
        `  <url>\n` +
        `    <loc>${xmlEscape(e.loc)}</loc>\n` +
        `    <lastmod>${e.lastmod}</lastmod>\n` +
        `    <changefreq>${e.changefreq}</changefreq>\n` +
        `    <priority>${e.priority}</priority>\n` +
        `  </url>`,
    )
    .join("\n");

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${body}\n` +
    `</urlset>\n`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
