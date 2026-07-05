"use client";

import Link from "next/link";
import { trackEvent } from "@/lib/analytics";

/** 뉴스 카드 링크 — 클릭 시 Vercel custom event 를 발생시키는 클라이언트 래퍼. */
export function NewsCardLink({
  href,
  slug,
  section,
  className,
  children,
}: {
  href: string;
  slug: string;
  section: string | null;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => trackEvent("news_article_click", { slug, section })}
    >
      {children}
    </Link>
  );
}
