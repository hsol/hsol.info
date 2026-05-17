"use client";

import { useEffect, useState } from "react";
import { GoogleAnalyticsScripts } from "@/components/GoogleAnalyticsScripts";

/**
 * gtag — 스크롤·클릭·키 입력 또는 8s 후 로드(AdSense와 동일 패턴).
 * NEXT_PUBLIC_GA_LOAD=lazyOnload 이면 즉시 로드.
 */
export function DeferredGoogleAnalyticsScripts({
  measurementId,
}: {
  measurementId: string;
}) {
  const eager = process.env.NEXT_PUBLIC_GA_LOAD === "lazyOnload";
  const [load, setLoad] = useState(eager);

  useEffect(() => {
    if (eager || load) return;
    const onReady = () => setLoad(true);
    const events = ["scroll", "pointerdown", "keydown"] as const;
    events.forEach((e) => window.addEventListener(e, onReady, { once: true, passive: true }));
    const t = window.setTimeout(onReady, 8000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, onReady));
      window.clearTimeout(t);
    };
  }, [eager, load]);

  if (!load) return null;
  return <GoogleAnalyticsScripts measurementId={measurementId} />;
}
