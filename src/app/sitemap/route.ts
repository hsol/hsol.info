import { buildMainSitemapXml } from "@/lib/seo/sitemap";

/**
 * 확장자 없는 메인 sitemap — hsol.info/sitemap (robots 가 `.xml` 과 함께 광고하는 하위호환 URL).
 * 본문은 `/sitemap.xml` 과 동일하며 같은 소스(`buildMainSitemapXml`)에서 나온다.
 *
 * (news.hsol.info/sitemap 은 미들웨어가 `/news/sitemap` 으로 rewrite 하므로 이 라우트에
 * 도달하지 않는다.)
 */
export const revalidate = 3600;

export function GET(): Response {
  return new Response(buildMainSitemapXml(), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
