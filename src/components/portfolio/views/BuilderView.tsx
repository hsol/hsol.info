"use client";

import { Back, CareerList, CoffeeCTA, SecHead, useSiteData } from "@/components/portfolio/Atoms";
import { renderTitleLines, ViewHead } from "@/components/portfolio/view-primitives";

export function BuilderView({ onBack }: { onBack: () => void }) {
  const D = useSiteData();
  const builderTiers = D.career.map((c) => c.tier.builder);
  return (
    <div className="view">
      <Back onBack={onBack} />
      <ViewHead
        room="03 · BUILDER"
        coord="B2"
        title={renderTitleLines(D.viewHeaders.builder.titleLines)}
        lede={D.viewHeaders.builder.lede}
      />

      <div className="sec" data-ask-section="builder/stack">
        <SecHead title="Stack & domain" num="01" meta="practical" />
        <div className="facts">
          {D.portfolioCopy.builder.facts.map((fact) => (
            <div className="fact" key={fact.label}>
              <div className="fact-label">{fact.label}</div>
              <div className="fact-value">{fact.value}</div>
            </div>
          ))}
          <div className="fact">
            <div className="fact-label">{D.portfolioCopy.builder.certificationLabel}</div>
            <div className="fact-value">{D.certifications.join(" · ")}</div>
          </div>
        </div>
      </div>
      <div className="sec" data-ask-section="builder/career">
        <SecHead title="Career as builder" num="02" meta="full timeline" />
        <p className="career-curation-note">
          전체 경력을 시간순으로 열람할 수 있고, 빌더 관점에서 특히 관련 있는 항목은 기본 펼침으로 두었습니다. 나머지는 접어
          두었으며 왼쪽 + 로 펼칠 수 있습니다.
        </p>
        <CareerList items={D.career} itemTiers={builderTiers} highlightTier1 />
      </div>
      <div className="sec" data-ask-section="builder/writing">
        <SecHead title="Writing" num="03" meta="publications" />
        <div className="pillars">
          {D.publications.map((p, i) => (
            <div className="pillar" key={i}>
              <div className="pillar-no">PIECE · 0{i + 1}</div>
              <div className="pillar-name">{p.title}</div>
              <div className="pillar-en">Publication</div>
              <div className="pillar-blurb">{p.desc}</div>
            </div>
          ))}
          {D.portfolioCopy.builder.extraWritings.map((piece) => (
            <div className="pillar" key={piece.no}>
              <div className="pillar-no">{piece.no}</div>
              <div className="pillar-name">{piece.name}</div>
              <div className="pillar-en">{piece.en}</div>
              <div className="pillar-blurb">{piece.blurb}</div>
            </div>
          ))}
        </div>
      </div>
      <CoffeeCTA title={D.portfolioCopy.builder.coffee.title} sub={D.portfolioCopy.builder.coffee.sub} />
    </div>
  );
}
