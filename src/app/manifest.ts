import type { MetadataRoute } from "next";

/**
 * PWA 매니페스트. 실제 PWA 설치를 의도하지는 않지만,
 * Chrome·iOS 홈 화면 추가 시 일관된 아이콘·테마색을 보장하고
 * 검색엔진이 "이 사이트의 정체"를 인식하는 보조 신호로도 쓰인다.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "임한솔 · Hansol Lim — hsol.info",
    short_name: "hsol.info",
    description:
      "임한솔(Hansol Lim) — 프루퍼 ㈜ 대표 · PPB Studios 팀장. 온라인의 기술과 오프라인의 운영을 잇는 AI 클론 포트폴리오.",
    start_url: "/",
    display: "standalone",
    background_color: "#0e2a3d",
    theme_color: "#0e2a3d",
    lang: "ko-KR",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
