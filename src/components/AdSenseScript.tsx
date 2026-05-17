"use client";

import Script from "next/script";
import { useEffect, useState } from "react";

const ADS_SRC = (clientId: string) =>
  `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`;

/**
 * AdSense — 기본은 첫 스크롤·클릭·키 입력 또는 8s 후 로드(FundingChoices·show_ads_impl 초기 CPU 회피).
 * NEXT_PUBLIC_ADSENSE_LOAD=lazyOnload 이면 load 이벤트 직후 로드.
 */
export function AdSenseScript({ clientId }: { clientId: string }) {
  const eager = process.env.NEXT_PUBLIC_ADSENSE_LOAD === "lazyOnload";
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

  return (
    <Script
      id="adsense-loader"
      src={ADS_SRC(clientId)}
      strategy="lazyOnload"
      crossOrigin="anonymous"
    />
  );
}
