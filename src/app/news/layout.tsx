import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./news.css";

/**
 * 뉴스룸 세그먼트 메타 — 기사 제목 뒤에 사이트 도메인 대신 매체명을 붙인다
 * (예: "헤드라인 — 한솔닷컴"). 신문 SERP 관례에 맞춰 발행 매체를 명시.
 */
export const metadata: Metadata = {
  title: { default: "한솔닷컴 뉴스룸", template: "%s — 한솔닷컴" },
};

/**
 * 뉴스룸 전용 레이아웃 — 사이트 공통(레거시) 배경 대신 기사 전용 풀블리드 배경을 입힌다.
 * 루트 레이아웃의 html/body 안에서 children 을 감싸기만 한다.
 */
export default function NewsLayout({ children }: { children: ReactNode }) {
  return <div className="news-root">{children}</div>;
}
