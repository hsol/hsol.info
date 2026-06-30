import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getPublishedArticleBySlug } from "@/lib/db/articles";

/**
 * 기사별 동적 OG 이미지 (1200×630). 제목·섹션을 한솔닷컴 뉴스룸 브랜딩과 합성한다.
 * coverImage 가 있으면 metadata 가 그걸 우선 쓰고, 없을 때 이 이미지가 og/twitter 카드로 쓰인다.
 *
 * 한글 렌더를 위해 LINE Seed KR(Bold) ttf 를 satori 에 직접 주입한다(woff2 미지원).
 * DB/로컬 vault 접근 + fs 폰트 읽기 때문에 nodejs 런타임.
 */
export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "한솔닷컴 뉴스룸";

const NAVY = "#0e2a3d";
const ACCENT = "#7fb4d0";

export default async function OgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getPublishedArticleBySlug(slug);
  const headline = article?.headline ?? "한솔닷컴 뉴스룸";
  const section = article?.section ?? "뉴스";

  // 폰트는 fs 로 읽는다. Vercel 람다 포함은 next.config 의 outputFileTracingIncludes 로 보장.
  const fontData = await readFile(
    join(process.cwd(), "src/app/fonts/LINESeedKR-Bd.ttf"),
  );

  const headlineSize = headline.length > 38 ? 60 : headline.length > 24 ? 72 : 84;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: NAVY,
          color: "#ffffff",
          padding: "72px 80px",
          justifyContent: "space-between",
          fontFamily: "LINE Seed KR",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", fontSize: 30, color: ACCENT }}>
          <span>한솔닷컴 뉴스룸</span>
          <span style={{ margin: "0 16px", color: "#3d7a9c" }}>·</span>
          <span>{section}</span>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: headlineSize,
            lineHeight: 1.25,
            letterSpacing: "-0.01em",
          }}
        >
          {headline}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 28,
            color: "#9bb8c9",
            borderTop: "2px solid #2e6889",
            paddingTop: "24px",
          }}
        >
          <span>hsol.info</span>
          <span>임한솔 · Hansol Lim</span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "LINE Seed KR", data: fontData, weight: 700, style: "normal" }],
    },
  );
}
