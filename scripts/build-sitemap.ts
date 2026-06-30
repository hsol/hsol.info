import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PAGE_KEYS, SITE_STRUCTURE, type PageKey } from "../src/content/site-structure";
import { listPublishedArticleRefs } from "../src/lib/db/articles";

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

/**
 * 페이지별 SEO 가중치. **어떤 페이지를 넣을지는 SITE_STRUCTURE.inSitemap(SSOT)가 결정**하고,
 * 여기서는 노출되는 페이지의 priority/changefreq 만 정한다. 매핑이 없으면 기본값 사용.
 */
const SEO_WEIGHTS: Partial<Record<PageKey, { changefreq: ChangeFreq; priority: number }>> = {
  home: { changefreq: "weekly", priority: 1.0 },
  about: { changefreq: "weekly", priority: 0.9 },
  hire: { changefreq: "weekly", priority: 0.8 },
  collab: { changefreq: "weekly", priority: 0.8 },
  builder: { changefreq: "weekly", priority: 0.8 },
  curious: { changefreq: "weekly", priority: 0.8 },
  architecture: { changefreq: "monthly", priority: 0.5 },
};

function locFor(route: string): string {
  // 루트는 trailing slash 없이(canonical 일치), 나머지는 SITE_URL + route.
  return route === "/" ? SITE_URL : `${SITE_URL}${route}`;
}

/**
 * PAGE_KEYS(잠긴 레이아웃 페이지) 밖의 standalone 라우트. 레이아웃 빌더가 건드리지 않으므로
 * SITE_STRUCTURE 에 넣지 않고 여기서만 sitemap 에 노출한다.
 */
const EXTRA_ROUTES: Array<{ route: string; changefreq: ChangeFreq; priority: number }> = [
  { route: "/resume", changefreq: "weekly", priority: 0.7 },
];

/**
 * 뉴스룸 — DB(미러)에서 발행 기사 slug 를 읽어 `/news` 허브 + 각 `/news/<slug>` 를 주입한다.
 * DATABASE_URL 미설정/미동기화면 빈 배열이라 sitemap 은 기존 페이지만으로 정상 생성된다.
 * (이 트랙은 SITE_STRUCTURE/site-data 와 무관한 별도 콘텐츠라 여기서 합류시킨다.)
 */
async function buildNewsEntries(now: string): Promise<UrlEntry[]> {
  const refs = await listPublishedArticleRefs();
  if (refs.length === 0) return [];
  const hub: UrlEntry = {
    loc: `${SITE_URL}/news`,
    lastmod: now,
    changefreq: "daily",
    priority: 0.8,
  };
  const articles = refs.map((r): UrlEntry => {
    const lastmod = r.lastmod ? new Date(r.lastmod).toISOString() : now;
    return {
      loc: `${SITE_URL}/news/${r.slug}`,
      lastmod: Number.isNaN(Date.parse(lastmod)) ? now : lastmod,
      changefreq: "monthly",
      priority: 0.7,
    };
  });
  return [hub, ...articles];
}

function buildEntries(now: string): UrlEntry[] {
  const pageEntries = PAGE_KEYS.filter((key) => SITE_STRUCTURE[key].inSitemap).map(
    (key): UrlEntry => {
      const weight = SEO_WEIGHTS[key] ?? { changefreq: "weekly" as ChangeFreq, priority: 0.7 };
      return {
        loc: locFor(SITE_STRUCTURE[key].route),
        lastmod: now,
        changefreq: weight.changefreq,
        priority: weight.priority,
      };
    },
  );
  const extraEntries = EXTRA_ROUTES.map(
    (e): UrlEntry => ({ loc: locFor(e.route), lastmod: now, changefreq: e.changefreq, priority: e.priority }),
  );
  return [...pageEntries, ...extraEntries].sort(
    (a, b) => b.priority - a.priority || a.loc.localeCompare(b.loc),
  );
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
  const newsEntries = await buildNewsEntries(now);
  const entries = [...buildEntries(now), ...newsEntries].sort(
    (a, b) => b.priority - a.priority || a.loc.localeCompare(b.loc),
  );
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
