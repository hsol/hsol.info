import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/**
 * 뉴스룸 허브(news.hsol.info) 전용 OG 이미지 (1200×630).
 * 본 사이트 공용 /og.png(네이비 포트폴리오 카드) 대신, 뉴스룸 지면과 같은
 * 흰 배경 신문 1면 마스트헤드 스타일로 매체 정체성을 드러낸다.
 * 기사 상세는 [slug]/opengraph-image.tsx(네이비 헤드라인 카드)가 더 깊은
 * 세그먼트라 그대로 우선 적용된다.
 *
 * 한글 렌더를 위해 Wanted Sans(Bold) ttf 를 satori 에 직접 주입한다(woff2 미지원).
 * Vercel 람다에 폰트 포함은 next.config 의 outputFileTracingIncludes 로 보장.
 */
export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "한솔닷컴 뉴스룸 — 임한솔 취재기록";

const INK = "#14202b";
const INK_SOFT = "#5b6b78";
const NAVY = "#0e2a3d";

export default async function OgImage() {
  const fontData = await readFile(
    join(process.cwd(), "src/app/fonts/WantedSans-Bold.ttf"),
  );

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: "#ffffff",
          color: INK,
          padding: "56px 84px 48px",
          fontFamily: "Wanted Sans",
        }}
      >
        {/* 데이트라인 — 신문 상단의 발행 정보 행 */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 22,
            letterSpacing: "0.14em",
            color: INK_SOFT,
            paddingBottom: 18,
          }}
        >
          <span>NEWS.HSOL.INFO</span>
          <span>임한솔 취재기록</span>
        </div>

        {/* 겹줄(double rule) — 마스트헤드 위 굵은 줄 + 가는 줄 */}
        <div style={{ display: "flex", height: 5, background: INK }} />
        <div style={{ display: "flex", height: 1, background: INK, marginTop: 4 }} />

        {/* 마스트헤드 */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            flexGrow: 1,
          }}
        >
          <div style={{ display: "flex", fontSize: 148, letterSpacing: "0.02em" }}>
            한솔닷컴
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginTop: 18,
              fontSize: 34,
              letterSpacing: "0.42em",
              color: NAVY,
            }}
          >
            {/* letterSpacing 이 마지막 글자 뒤에도 붙어 시각적 중심이 왼쪽으로 쏠리므로 보정 */}
            <span style={{ marginRight: "-0.42em" }}>NEWSROOM</span>
          </div>
        </div>

        {/* 하단 — 가는 줄 + 매체 설명 */}
        <div style={{ display: "flex", height: 1, background: INK }} />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: 20,
            fontSize: 24,
            color: INK_SOFT,
          }}
        >
          <span>임한솔의 일 · 사건 · 성과를 취재해 기록하는 뉴스 아카이브</span>
          <span style={{ color: NAVY }}>hsol.info</span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Wanted Sans", data: fontData, weight: 700, style: "normal" }],
    },
  );
}
