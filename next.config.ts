import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const emptyPolyfill = path.join(rootDir, "src/lib/empty-polyfill.ts");

const nextConfig: NextConfig = {
  experimental: {
    /** 외부 render-blocking CSS 링크 대신 HTML에 인라인 — 첫 방문 FCP/LCP 개선 */
    inlineCss: true,
    optimizePackageImports: ["mermaid", "react-markdown", "remark-gfm"],
  },
  images: { unoptimized: true },
  /** Claude Design `TweaksPanel` — gradually add types in `src/components/TweaksPanel.tsx` */
  typescript: { ignoreBuildErrors: true },
  webpack: (config, { isServer }) => {
    config.resolve = config.resolve ?? {};
    config.resolve.fallback = {
      ...(config.resolve.fallback ?? {}),
      fs: false,
      path: false,
    };
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        "next/dist/build/polyfills/polyfill-module": emptyPolyfill,
        "next/dist/build/polyfills/polyfill-module.js": emptyPolyfill,
      };
    }
    return config;
  },
  async headers() {
    const sitemapHeaders = [
      { key: "Content-Type", value: "application/xml" },
      { key: "Cache-Control", value: "public, max-age=3600, s-maxage=3600" },
    ];
    const fontCache = {
      key: "Cache-Control",
      value: "public, max-age=31536000, immutable",
    };
    return [
      { source: "/sitemap.xml", headers: sitemapHeaders },
      { source: "/sitemap", headers: sitemapHeaders },
      {
        source: "/_next/static/media/:path*.woff2",
        headers: [fontCache],
      },
    ];
  },
};

export default nextConfig;
