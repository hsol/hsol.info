import type { MetadataRoute } from "next";
import { PERSONA_PATH_KEYS } from "@/components/portfolio/portfolio-types";

const SITE_URL = "https://hsol.info";

/**
 * SSR 사이트라 정확한 최종 업데이트 시각을 빌드 시점에만 알 수 있어
 * `lastModified`는 빌드 시각으로 통일한다. 페르소나 4종은 모두 `/`와 동일 셸을 공유하므로
 * 메인보다 한 단계 낮은 우선순위(0.8)로 노출한다.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const personaEntries: MetadataRoute.Sitemap = PERSONA_PATH_KEYS.map((key) => ({
    url: `${SITE_URL}/${key}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));
  return [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...personaEntries,
    {
      url: `${SITE_URL}/architecture`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];
}
