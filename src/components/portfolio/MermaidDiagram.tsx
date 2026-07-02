"use client";

import { useMemo } from "react";
import { useMermaid } from "react-x-mermaid";
import { jetbrainsMono, lineSeedKR } from "@/lib/site-fonts";
// 정적 import — lazy(ssr:false)로 지연 로드하면 콜드 캐시 첫 방문에서 청크가 뜨기 전에
// useMermaid의 1회성 렌더 이펙트가 끝나 버려(ref 미부착) SVG가 영영 그려지지 않는다.
// 컴포넌트가 작아(~2KB) 지연 로드 이득도 없다.
import { MermaidPanZoomViewport } from "@/components/portfolio/MermaidPanZoomViewport";

export function MermaidDiagram({
  chart,
  diagramHead,
  panZoom = false,
}: {
  chart: string;
  /** 상단 라벨. 생략 시 "Mermaid Diagram", `null`·빈 문자열이면 라벨 행 숨김 */
  diagramHead?: string | null;
  /** 고정 뷰포트 안에서 휠 확대·축소, 드래그 이동 */
  panZoom?: boolean;
}) {
  const headLabel =
    diagramHead === null || diagramHead === ""
      ? null
      : (diagramHead ?? "Mermaid Diagram");
  const chartText = useMemo(() => {
    const s = chart.trim();
    if (!s) return "graph LR; EMPTY[No diagram data];";
    return s.replace(/\\n/g, " ").replace(/\r\n/g, "\n");
  }, [chart]);
  const mermaidConfig = useMemo(
    () => ({
      theme: "base" as const,
      securityLevel: "strict" as const,
      startOnLoad: false,
      suppressErrorRendering: true,
      fontFamily: `${jetbrainsMono.style.fontFamily}, ${lineSeedKR.style.fontFamily}, sans-serif`,
      themeVariables: {
        background: "#14384f",
        primaryColor: "#0e2a3d",
        primaryBorderColor: "#3d7a9c",
        primaryTextColor: "#f2f7fa",
        lineColor: "#7fb4d0",
        secondaryColor: "#123247",
        tertiaryColor: "#183f58",
        edgeLabelBackground: "#14384f",
      },
      flowchart: {
        htmlLabels: false,
        curve: "linear" as const,
        /** pan-zoom 모드에서는 자연 크기로 그려 측정·줌이 맞게 동작 */
        useMaxWidth: !panZoom,
      },
    }),
    [panZoom],
  );
  const { ref, error } = useMermaid(chartText, mermaidConfig);

  const chartEl = (
    <div className={"home-built-mermaid" + (panZoom ? " is-panzoom-inner" : "")} ref={ref} />
  );

  return (
    <div className="home-built-mermaid-wrap" aria-label="How this site works diagram">
      {headLabel != null ? <div className="home-built-mermaid-head">{headLabel}</div> : null}
      {panZoom ? <MermaidPanZoomViewport>{chartEl}</MermaidPanZoomViewport> : chartEl}
      {error ? <pre className="home-built-mermaid-fallback">{error}</pre> : null}
    </div>
  );
}
