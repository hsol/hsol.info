"use client";

import Link from "next/link";
import { useSiteData } from "@/components/portfolio/Atoms";

/** 홈 전용 — builtFlow 기반 경량 다이어그램(Mermaid 청크 없음). 전체 구조는 /architecture */
export function HomeBuiltFlowDiagram() {
  const steps = useSiteData().portfolioCopy.home.builtFlow;

  return (
    <div className="home-built-mermaid-wrap" aria-label="How this site works diagram">
      <div className="home-built-mermaid-head">Data flow (summary)</div>
      <div className="home-built-flow" role="img" aria-label={steps.map((s) => s.label).join(" → ")}>
        {steps.map((step, i) => (
          <div key={step.label} className="home-built-flow-step">
            <span className="home-built-flow-box">{step.label}</span>
            {i < steps.length - 1 ? <span className="home-built-flow-arrow" aria-hidden>→</span> : null}
          </div>
        ))}
      </div>
      <p className="home-built-flow-note">
        <Link className="home-built-arch-teaser-link" href="/architecture">
          전체 사이트 구조도(Mermaid)
        </Link>
        에서 저장소·배포·Ask Hansol 연결을 자세히 볼 수 있습니다.
      </p>
    </div>
  );
}
