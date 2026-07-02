import type { MetadataRoute } from "next";
import { headers } from "next/headers";

const SITE_URL = "https://hsol.info";
const NEWS_URL = "https://news.hsol.info";
const NEWS_HOST = "news.hsol.info";

/**
 * `/api/*`는 Ask Hansol 동적 응답·세션 데이터라 인덱싱하지 않는다.
 * `/_next/*`은 빌드 산출물이라 기본 차단.
 *
 * `host` 필드는 Yandex 전용 비표준 디렉티브라 의도적으로 비워둔다.
 * (Google은 무시하지만 SEO 감사 도구에서 경고로 잡히는 경우가 있어 제거.)
 *
 * 호스트별 sitemap — news.hsol.info 요청에는 뉴스 전용 sitemap 만, 그 외(메인 hsol.info)에는
 * 메인 sitemap 만 광고한다. headers() 를 읽어 요청별로 렌더된다.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "")
    .split(":")[0]
    .toLowerCase();
  const onNews = host === NEWS_HOST;
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/_next/"],
      },
    ],
    sitemap: onNews
      ? [`${NEWS_URL}/sitemap`]
      : [`${SITE_URL}/sitemap.xml`, `${SITE_URL}/sitemap`],
  };
}
