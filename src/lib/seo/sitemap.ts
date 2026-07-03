import { PAGE_KEYS, SITE_STRUCTURE, type PageKey } from "@/content/site-structure";

/**
 * 메인 sitemap(hsol.info) 빌더 — **런타임 단일 진실 원천**.
 *
 * 예전엔 `scripts/build-sitemap.ts` 가 빌드 시 `public/sitemap.xml`·`public/sitemap` 두 정적
 * 파일로 굽던 것을, 라우트 핸들러(`app/sitemap.xml`·`app/sitemap`)가 이 함수를 호출해 동적으로
 * 응답하도록 이관했다. 정적/동적 sitemap 이 서로 다른 시점에 생성돼 **버전이 어긋나는 문제**와,
 * 확장자 있는 경로가 미들웨어 라우팅을 우회하던 문제를 함께 해소한다.
 *
 * - `SITE_URL` 은 trailing slash 없음 (각 페이지 canonical 과 정확히 일치).
 * - `<lastmod>` 는 렌더 시각으로 통일 (SSR 사이트라 페이지별 정확한 변경 시각을 알기 어렵다).
 *   라우트에 `revalidate` 를 걸어 재검증 주기 동안은 값이 고정된다.
 * - 엔트리 순서는 priority 내림차순 정렬 (사람이 읽기 쉽게).
 *
 * 뉴스룸(news.hsol.info)의 개별 기사는 **별도 sitemap**(`app/news/sitemap`)이 책임진다.
 * 여기서는 서브도메인 **루트 URL**(blog/news)만 SUBDOMAIN_ENTRIES 로 실어, 메인 sitemap 을
 * 통해서도 크롤러가 서브도메인을 발견하게 한다.
 */
const SITE_URL = "https://hsol.info";

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
 * hsol.info 밖의 서브도메인 루트 URL. sitemap 프로토콜은 원칙적으로 same-host 를 요구하지만
 * Google 은 Search Console 에서 소유가 확인된 호스트 간 cross-host 엔트리를 허용한다.
 * 개별 하위 페이지는 각 서브도메인의 sitemap 이 책임지고, 여기서는 진입점만 알린다.
 */
const SUBDOMAIN_ENTRIES: Array<{ loc: string; changefreq: ChangeFreq; priority: number }> = [
  { loc: "https://blog.hsol.info", changefreq: "daily", priority: 0.8 },
  { loc: "https://news.hsol.info", changefreq: "daily", priority: 0.8 },
];

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
  const subdomainEntries = SUBDOMAIN_ENTRIES.map(
    (e): UrlEntry => ({ loc: e.loc, lastmod: now, changefreq: e.changefreq, priority: e.priority }),
  );
  return [...pageEntries, ...extraEntries, ...subdomainEntries].sort(
    (a, b) => b.priority - a.priority || a.loc.localeCompare(b.loc),
  );
}

/** 메인 sitemap XML 문자열을 생성한다. 라우트 핸들러가 이 결과를 그대로 응답한다. */
export function buildMainSitemapXml(now: string = new Date().toISOString()): string {
  const entries = buildEntries(now);
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
