import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * 뉴스 서브도메인 리버스 프록시.
 *
 *   news.hsol.info/          → (rewrite) /news
 *   news.hsol.info/<기사>    → (rewrite) /news/<기사>
 *   news.hsol.info/feed.xml  → (rewrite) /news/feed.xml   (RSS 자기참조 URL)
 *
 * 리다이렉트가 아니라 rewrite 라 브라우저 주소창은 news.hsol.info 로 유지되고,
 * 실제 렌더는 메인 앱의 /news 트리가 담당한다. (Vercel 프로젝트에 news.hsol.info
 * 도메인을 추가하고 DNS 를 붙여야 트래픽이 이 미들웨어까지 도달한다.)
 */
const NEWS_HOST = "news.hsol.info";

export function middleware(req: NextRequest) {
  // 포트가 붙는 로컬/프리뷰 대비해 host 는 콜론 앞부분만 본다.
  const host = req.headers.get("host")?.split(":")[0] ?? "";
  if (host !== NEWS_HOST) return NextResponse.next();

  const { pathname } = req.nextUrl;
  // 이미 /news 접두면 그대로 — 이중 접두(/news/news)·무한 재작성 방지.
  if (pathname === "/news" || pathname.startsWith("/news/")) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = pathname === "/" ? "/news" : `/news${pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  /**
   * 재작성 대상에서 제외:
   *  - `_next/`·`api/` : 빌드 산출물·API 라우트
   *  - 확장자 있는 경로(`.*\.`) : favicon·이미지·sitemap.xml 등 정적 자산.
   *    news.hsol.info 로 로드되는 절대경로 자산이 /news/_next/... 로 깨지지 않게 한다.
   *
   * 단, `/feed.xml` 만은 예외로 포함해 미들웨어가 /news/feed.xml 로 rewrite 하게 한다
   * (RSS 자기참조 URL 이 news.hsol.info/feed.xml 이라 이 경로가 실제로 응답해야 함).
   */
  matcher: ["/((?!_next/|api/|.*\\.).*)", "/feed.xml"],
};
