"use client";

import { Back, CareerList, CoffeeCTA, SecHead, useSiteData } from "@/components/portfolio/Atoms";
import { filterCareerForPersona } from "@/components/portfolio/career-utils";
import { renderTitleLines, ViewHead } from "@/components/portfolio/view-primitives";

export function CollabView({ onBack }: { onBack: () => void }) {
  const D = useSiteData();
  const collabCareer = filterCareerForPersona(
    D.career,
    "collab",
    (c) =>
      c.period.includes("현재") ||
      (c.tags || []).includes("자문") ||
      c.org === "Antler",
  );
  return (
    <div className="view">
      <Back onBack={onBack} />
      <ViewHead
        room="02 · COLLAB"
        coord="B1"
        title={renderTitleLines(D.viewHeaders.collab.titleLines)}
        lede={D.viewHeaders.collab.lede}
      />

      <div className="sec" data-ask-section="collab/methods">
        <SecHead title="How I work" num="01" meta="approach" />
        <div className="pillars">
          {D.portfolioCopy.collab.methods.map((method) => (
            <div className="pillar" key={method.no}>
              <div className="pillar-no">{method.no}</div>
              <div className="pillar-name">{method.name}</div>
              <div className="pillar-en">{method.en}</div>
              <div className="pillar-blurb">{method.blurb}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="sec" data-ask-section="collab/career">
        <SecHead
          title="What I'm building & advisory"
          num="02"
          meta={`${collabCareer.items.length} roles · active + reference`}
        />
        <p className="career-curation-note">
          현재 진행 중인 역할과 자문·인큐베이션 경험을 한 목록에 시간순으로 모았습니다. 협업 관점에서 특히 관련 있는 항목은
          기본으로 펼쳐 두었고, 나머지는 접어 한 줄로 보입니다. 왼쪽 + 로 펼칠 수 있습니다.
        </p>
        <CareerList items={collabCareer.items} itemTiers={collabCareer.itemTiers} highlightTier1 />
      </div>
      <CoffeeCTA title={D.portfolioCopy.collab.coffee.title} sub={D.portfolioCopy.collab.coffee.sub} />
    </div>
  );
}
