import type { MetadataRoute } from "next";

const SITE_URL = "https://hsol.info";

/**
 * `/api/*`는 Ask Hansol 동적 응답·세션 데이터라 인덱싱하지 않는다.
 * `/_next/*`은 빌드 산출물이라 기본 차단.
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
    host: SITE_URL,
  };
}
