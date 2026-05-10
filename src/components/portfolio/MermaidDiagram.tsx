"use client";

import { useMemo } from "react";
import { useMermaid } from "react-x-mermaid";

export function MermaidDiagram({ chart }: { chart: string }) {
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
      fontFamily: "JetBrains Mono, LINE Seed KR, sans-serif",
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
        useMaxWidth: true,
      },
    }),
    [],
  );
  const { ref, error } = useMermaid(chartText, mermaidConfig);

  return (
    <div className="home-built-mermaid-wrap" aria-label="How this site works diagram">
      <div className="home-built-mermaid-head">Mermaid Diagram</div>
      <div className="home-built-mermaid" ref={ref} />
      {error ? <pre className="home-built-mermaid-fallback">{error}</pre> : null}
    </div>
  );
}
