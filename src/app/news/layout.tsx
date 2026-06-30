import type { ReactNode } from "react";
import "./news.css";

/**
 * 뉴스룸 전용 레이아웃 — 사이트 공통(레거시) 배경 대신 기사 전용 풀블리드 배경을 입힌다.
 * 루트 레이아웃의 html/body 안에서 children 을 감싸기만 한다.
 */
export default function NewsLayout({ children }: { children: ReactNode }) {
  return <div className="news-root">{children}</div>;
}
