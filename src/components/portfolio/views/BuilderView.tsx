"use client";

import { Back, CareerList, CoffeeCTA, SecHead, useSiteData } from "@/components/portfolio/Atoms";
import { PersonaTimelineIntro, renderTitleLines, ViewHead } from "@/components/portfolio/view-primitives";

/**
 * Writing 카드 한 장. href가 있으면 새 탭 링크(.pillar-link)로, 없으면 일반 카드로 렌더한다.
 * 항목에 href만 채우면 링크가 자동으로 걸린다.
 */
function WritingPillar({
  no,
  name,
  en,
  blurb,
  href,
}: {
  no: string;
  name: string;
  en: string;
  blurb: string;
  href?: string;
}) {
  const body = (
    <>
      <div className="pillar-no">{no}</div>
      <div className="pillar-name">{href ? `${name} ↗` : name}</div>
      <div className="pillar-en">{en}</div>
      <div className="pillar-blurb">{blurb}</div>
    </>
  );
  return href ? (
    <a className="pillar pillar-link" href={href} target="_blank" rel="noopener noreferrer">
      {body}
    </a>
  ) : (
    <div className="pillar">{body}</div>
  );
}

export function BuilderView({ onBack }: { onBack: () => void }) {
  const D = useSiteData();
  const builderTiers = D.career.map((c) => c.tier.builder);
  // Writing 카드 = 블로그 + 출판물 + 그 외 글. 배열 순서대로 PIECE 번호가 매겨지고,
  // 각 항목에 href가 있으면 자동으로 새 탭 링크가 된다.
  const { blog, extraWritings } = D.portfolioCopy.builder;
  const writingCards = [
    blog,
    ...D.publications.map((p) => ({ name: p.title, en: "Publication", blurb: p.desc, href: p.href })),
    ...extraWritings,
  ];
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
        <PersonaTimelineIntro text={D.portfolioCopy.builder.timelineIntro} />
        <p className="career-curation-note">
          전체 경력을 시간순으로 열람할 수 있고, 빌더 관점에서 특히 관련 있는 항목은 기본 펼침으로 두었습니다. 나머지는 접어
          두었으며 왼쪽 + 로 펼칠 수 있습니다.
        </p>
        <CareerList items={D.career} itemTiers={builderTiers} highlightTier1 />
      </div>
      <div className="sec" data-ask-section="builder/writing">
        <SecHead title="Writing" num="03" meta="publications" />
        <div className="pillars">
          {writingCards.map((card, i) => (
            <WritingPillar
              key={i}
              no={`PIECE · 0${i + 1}`}
              name={card.name}
              en={card.en}
              blurb={card.blurb}
              href={card.href}
            />
          ))}
        </div>
      </div>
      <CoffeeCTA title={D.portfolioCopy.builder.coffee.title} sub={D.portfolioCopy.builder.coffee.sub} />
    </div>
  );
}
