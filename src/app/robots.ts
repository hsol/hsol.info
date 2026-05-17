import type { MetadataRoute } from "next";

const SITE_URL = "https://hsol.info";

/**
 * `/api/*`는 Ask Hansol 동적 응답·세션 데이터라 인덱싱하지 않는다.
 * `/_next/*`은 빌드 산출물이라 기본 차단.
 *
 * `host` 필드는 Yandex 전용 비표준 디렉티브라 의도적으로 비워둔다.
 * (Google은 무시하지만 SEO 감사 도구에서 경고로 잡히는 경우가 있어 제거.)
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/_next/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
