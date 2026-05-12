"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/** GA4 — App Router 클라이언트 네비게이션 시 page_path만 갱신 (첫 로드는 layout 인라인 gtag config) */
export function GoogleAnalyticsReporter({ measurementId }: { measurementId: string }) {
  const pathname = usePathname();
  const isFirst = useRef(true);

  useEffect(() => {
    if (typeof window.gtag !== "function") return;
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    window.gtag("config", measurementId, { page_path: pathname });
  }, [pathname, measurementId]);

  return null;
}
