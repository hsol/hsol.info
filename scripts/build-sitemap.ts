import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PERSONA_PATH_KEYS } from "../src/components/portfolio/portfolio-types";

/**
 * 직접 작성한 sitemap 빌더.
 *
 * next-sitemap이 자동 주입하는 deprecated `xmlns:mobile` 네임스페이스와
 * 실제로 쓰지 않는 news/image/video/xhtml 네임스페이스를 제거하기 위해 자체 생성한다.
 *
 * - `SITE_URL`은 trailing slash 없음 (각 페이지 `<link rel="canonical">`과 정확히 일치시키기 위함).
 * - `<lastmod>`는 빌드 시각으로 통일 (SSR 사이트라 페이지별 정확한 변경 시각을 알기 어렵다).
 * - 엔트리 순서는 priority 내림차순으로 정렬해 사람이 읽기 쉽게.
 * - 동일 본문을 `public/sitemap.xml`과 `public/sitemap`에 모두 쓴다(리다이렉트 없이 공존).
 */
const SITE_URL = "https://hsol.info";
const OUTPUT_PATHS = ["public/sitemap.xml", "public/sitemap"] as const;

type ChangeFreq =
  | "always"
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "never";

type UrlEntry = {
  loc: string;
  lastmod: string;
  changefreq: ChangeFreq;
  priority: number;
};

function buildEntries(now: string): UrlEntry[] {
  const personaEntries: UrlEntry[] = PERSONA_PATH_KEYS.map((slug) => ({
    loc: `${SITE_URL}/${slug}`,
    lastmod: now,
    changefreq: "weekly",
    priority: 0.8,
  }));
  return [
    {
      loc: SITE_URL,
      lastmod: now,
      changefreq: "weekly",
      priority: 1.0,
    },
    ...personaEntries,
    {
      loc: `${SITE_URL}/imhansol`,
      lastmod: now,
      changefreq: "weekly",
      priority: 0.9,
    },
    {
      loc: `${SITE_URL}/architecture`,
      lastmod: now,
      changefreq: "monthly",
      priority: 0.5,
    },
  ];
}

function renderXml(entries: UrlEntry[]): string {
  const body = entries
    .map(
      (e) =>
        `  <url>\n` +
        `    <loc>${e.loc}</loc>\n` +
        `    <lastmod>${e.lastmod}</lastmod>\n` +
        `    <changefreq>${e.changefreq}</changefreq>\n` +
        `    <priority>${e.priority.toFixed(1)}</priority>\n` +
        `  </url>`,
    )
    .join("\n");
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${body}\n` +
    `</urlset>\n`
  );
}

async function main() {
  const now = new Date().toISOString();
  const entries = buildEntries(now);
  const xml = renderXml(entries);

  for (const outputPath of OUTPUT_PATHS) {
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, xml, "utf8");
    console.log(`Generated ${outputPath} (${entries.length} urls)`);
  }
}

main().catch((error) => {
  console.error("Failed to generate sitemap");
  console.error(error);
  process.exit(1);
});
