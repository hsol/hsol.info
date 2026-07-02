"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const NEWS_HOST = "news.hsol.info";

/**
 * 뉴스 서브도메인 주소창 정규화기.
 *
 * news.hsol.info 는 미들웨어가 내부적으로 /news 트리로 rewrite 하는데, App Router 가
 * 하이드레이션 시 "렌더된 경로"(/news, /news/<slug>)로 주소창을 되돌려 놓는다. 그래서
 * news.hsol.info/ 로 들어와도 주소창이 news.hsol.info/news 로 튄다.
 *
 * 여기서 선두의 `/news` 를 벗겨 주소창만 news.hsol.info/  ·  news.hsol.info/<slug> 로
 * 되돌린다. 렌더 콘텐츠는 그대로(같은 /news 트리)라 replaceState 로 URL 만 교체한다.
 * 메인 도메인(hsol.info/news…)에서는 아무 것도 하지 않는다(`/news` 경로를 그대로 노출).
 *
 * pathname 이 바뀔 때마다(직접 진입·카드 클릭·뒤로가기) 다시 벗겨 준다.
 */
export function NewsUrlNormalizer() {
  const pathname = usePathname();

  useEffect(() => {
    if (window.location.host.split(":")[0] !== NEWS_HOST) return;

    const { pathname: p, search, hash } = window.location;
    if (p !== "/news" && !p.startsWith("/news/")) return;

    const stripped = p.slice("/news".length) || "/";
    // history.state(=Next 라우터 상태)를 보존해 뒤로/앞으로가 라우터 트리를 복원하게 둔다.
    window.history.replaceState(window.history.state, "", stripped + search + hash);
  }, [pathname]);

  return null;
}
