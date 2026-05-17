"use client";

import { useEffect, useState } from "react";
import { lazy } from "@/lib/lazy-dynamic";

const Analytics = lazy(() =>
  import("@vercel/analytics/next").then((m) => ({ default: m.Analytics })),
);

const GoogleAnalyticsReporter = lazy(() =>
  import("@/components/GoogleAnalyticsReporter").then((m) => ({
    default: m.GoogleAnalyticsReporter,
  })),
);

/** Vercel Analytics·GA 리포터 — idle 후 마운트해 초기 Script Evaluation 부담을 줄임 */
export function DeferredThirdPartyScripts({
  gaMeasurementId,
}: {
  gaMeasurementId?: string;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const run = () => setReady(true);
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(run, { timeout: 3500 });
      return () => cancelIdleCallback(id);
    }
    const t = window.setTimeout(run, 2000);
    return () => window.clearTimeout(t);
  }, []);

  if (!ready) return null;

  return (
    <>
      <Analytics />
      {gaMeasurementId ? (
        <GoogleAnalyticsReporter measurementId={gaMeasurementId} />
      ) : null}
    </>
  );
}
