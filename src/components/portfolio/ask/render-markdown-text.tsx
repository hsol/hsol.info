"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { lazy } from "@/lib/lazy-dynamic";

const MarkdownBody = lazy(() =>
  import("@/components/portfolio/ask/MarkdownBody").then((m) => ({ default: m.MarkdownBody })),
);

/** ChatDock — 첫 마크다운 렌더 시에만 remark/react-markdown 청크 로드 */
export function RenderMarkdownText({
  text,
  streaming = false,
}: {
  text: string;
  streaming?: boolean;
}) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    setActive(true);
  }, []);
  if (!active) {
    return (
      <div className={"md-body" + (streaming ? " cursor-blink" : "")}>
        <p>{text}</p>
      </div>
    );
  }
  return <MarkdownBody text={text} streaming={streaming} />;
}

/** @deprecated RenderMarkdownText 컴포넌트 사용 */
export function renderMarkdownText(text: string, streaming = false): ReactNode {
  return <RenderMarkdownText text={text} streaming={streaming} />;
}
