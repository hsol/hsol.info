/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: "https://hsol.info",
  generateRobotsTxt: false,
  generateIndexSitemap: false,
  autoLastmod: true,
  exclude: [
    "/api/*",
    "/_next/*",
    "/404",
    "/robots.txt",
    "/apple-icon.png",
    "/icon.png",
    "/icon.svg",
    "/manifest.webmanifest",
  ],
  /** `[[...persona]]`가 프리렌더 목록에 없을 수 있어 페르소나 경로를 보강한다. `PERSONA_PATH_KEYS`와 동기화. */
  additionalPaths: async () => {
    const personas = ["hire", "collab", "builder", "curious"];
    const lastmod = new Date().toISOString();
    return [
      {
        loc: "/",
        changefreq: "weekly",
        priority: 1,
        lastmod,
      },
      ...personas.map((slug) => ({
        loc: `/${slug}`,
        changefreq: "weekly",
        priority: 0.8,
        lastmod,
      })),
    ];
  },
  transform: async (_config, path) => {
    const lastmod = new Date().toISOString();
    if (path === "/") {
      return { loc: path, changefreq: "weekly", priority: 1, lastmod };
    }
    if (path === "/architecture") {
      return { loc: path, changefreq: "monthly", priority: 0.5, lastmod };
    }
    if (["/hire", "/collab", "/builder", "/curious"].includes(path)) {
      return { loc: path, changefreq: "weekly", priority: 0.8, lastmod };
    }
    return {
      loc: path,
      changefreq: "weekly",
      priority: 0.7,
      lastmod,
    };
  },
};
