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
  /** 서브모듈(hsol-info-blob) lockfile 때문에 워크스페이스 루트가 오인되지 않게 고정.
      파일 트레이싱·process.cwd() 기준을 이 프로젝트로 못박는다. */
  outputFileTracingRoot: rootDir,
  /** 동적 OG 이미지(satori)가 런타임에 읽는 한글 폰트를 람다 번들에 포함. */
  outputFileTracingIncludes: {
    "/news/opengraph-image": ["./src/app/fonts/WantedSans-Bold.ttf"],
    "/news/[slug]/opengraph-image": ["./src/app/fonts/WantedSans-Bold.ttf"],
  },
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
    // sitemap 응답 헤더(Content-Type·Cache-Control)는 이제 라우트 핸들러
    // (app/sitemap.xml·app/sitemap·app/news/sitemap)가 직접 설정한다.
    const fontCache = {
      key: "Cache-Control",
      value: "public, max-age=31536000, immutable",
    };
    /** RSS 피드용 XSLT 스타일시트(public/feed.xsl) — nosniff 하에서도 브라우저가 XSL 로 파싱하도록
        명시 타입 지정. 정적 파일이라 라우트 핸들러가 없어 여기서 응답 헤더를 붙인다. */
    const xslHeaders = [
      { key: "Content-Type", value: "text/xsl; charset=utf-8" },
      { key: "Cache-Control", value: "public, max-age=3600, s-maxage=3600" },
    ];
    /** 표준 권장 보안 헤더 — 응답 헤더가 메타 태그보다 강하다(HSTS·nosniff 등). */
    const securityHeaders = [
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "X-DNS-Prefetch-Control", value: "on" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
      /**
       * Report-Only CSP — 아무것도 차단하지 않고 위반만 콘솔에 보고한다.
       * 광고·분석·임베드가 많아 enforcing 전에 실제 로드 도메인을 관찰하는 단계.
       * 위반 로그를 며칠 모은 뒤 누락 도메인을 채우고 enforcing으로 승격한다.
       */
      {
        key: "Content-Security-Policy-Report-Only",
        value: [
          "default-src 'self'",
          "base-uri 'self'",
          "object-src 'none'",
          "frame-ancestors 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://pagead2.googlesyndication.com https://*.googlesyndication.com https://www.googletagmanager.com https://*.google-analytics.com https://*.doubleclick.net https://*.google.com https://va.vercel-scripts.com",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "img-src 'self' data: blob: https:",
          "font-src 'self' data: https://fonts.gstatic.com",
          "connect-src 'self' https://*.google-analytics.com https://*.googletagmanager.com https://*.googlesyndication.com https://*.doubleclick.net https://*.vercel-insights.com https://va.vercel-scripts.com",
          "frame-src https://*.googlesyndication.com https://*.doubleclick.net https://*.google.com https://calendly.com https://*.calendly.com https://www.youtube.com https://www.youtube-nocookie.com",
        ].join("; "),
      },
    ];
    return [
      { source: "/feed.xsl", headers: xslHeaders },
      {
        source: "/_next/static/media/:path*.woff2",
        headers: [fontCache],
      },
      { source: "/:path*", headers: securityHeaders },
    ];
  },
};

export default nextConfig;
