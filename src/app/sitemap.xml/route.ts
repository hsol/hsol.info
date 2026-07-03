import { buildMainSitemapXml } from "@/lib/seo/sitemap";

/**
 * 메인 sitemap — hsol.info/sitemap.xml.
 *
 * 예전의 정적 `public/sitemap.xml`(빌드 시 생성)을 대체하는 동적 라우트. 이제 정적/동적
 * sitemap 이 한 소스(`buildMainSitemapXml`)에서 나오므로 버전이 어긋나지 않는다.
 *
 * news.hsol.info/sitemap.xml 요청은 미들웨어가 뉴스 전용 sitemap(`/news/sitemap`)으로
 * rewrite 하므로, 이 라우트는 메인 도메인만 응답한다.
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
