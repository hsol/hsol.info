"use client";

import {
  Back,
  CareerList,
  CoffeeCTA,
  Pillars,
  SecHead,
  useSiteData,
} from "@/components/portfolio/Atoms";
import { PersonaTimelineIntro, renderTitleLines, ViewHead } from "@/components/portfolio/view-primitives";

export function HireView({
  onBack,
  onAnalyzeJd,
}: {
  onBack: () => void;
  onAnalyzeJd?: () => void;
}) {
  const D = useSiteData();
  const tier1Count = D.career.filter((c) => c.tier.hire === 1).length;
  const hireTiers = D.career.map((c) => c.tier.hire);
  return (
    <div className="view">
      <Back onBack={onBack} />
      <ViewHead
        room="01 · HIRE"
        coord="A1"
        title={renderTitleLines(D.viewHeaders.hire.titleLines)}
        lede={D.viewHeaders.hire.lede}
      />

      {onAnalyzeJd && (
        <div className="hire-jd-callout" data-ask-section="hire/jd-fit">
          <div className="hire-jd-callout-eyebrow">JD 적합도 분석</div>
          <p className="hire-jd-callout-body">
            검토 중인 채용 공고(JD)를 붙여넣으면, 임한솔의 경력·강점과 얼마나 맞는지 부합하는
            지점과 보완이 필요한 지점을 함께 짚어 드립니다.
          </p>
          <button type="button" className="hire-jd-callout-btn" onClick={onAnalyzeJd}>
            채용 공고 붙여넣고 적합도 보기 →
          </button>
        </div>
      )}

      <div className="sec" data-ask-section="hire/strengths">
        <SecHead title="Strengths" num="01" meta="3 pillars" />
        <Pillars />
      </div>
      <div className="sec" data-ask-section="hire/experience">
        <SecHead title="Career timeline" num="02" meta={`${D.career.length} roles · ${tier1Count} selected`} />
        <PersonaTimelineIntro text={D.portfolioCopy.hire.timelineIntro} />
        <p className="career-curation-note">
          전체 경력을 시간순으로 열람할 수 있고, 채용 관점에서 특히 관련 있는 항목은 기본 펼침으로 큐레이션해 두었습니다.
        </p>
        <CareerList items={D.career} itemTiers={hireTiers} highlightTier1 />
      </div>
      <div className="sec" data-ask-section="hire/facts">
        <SecHead title="Facts" num="03" meta="basic" />
        <div className="facts">
          <div className="fact">
            <div className="fact-label">{D.portfolioCopy.hire.factsYearsLabel}</div>
            <div className="fact-value">{D.portfolioCopy.hire.factsYearsValue}</div>
          </div>
          <div className="fact">
            <div className="fact-label">{D.portfolioCopy.hire.factsBaseLabel}</div>
            <div className="fact-value">{D.identity.location}</div>
          </div>
          <div className="fact">
            <div className="fact-label">{D.portfolioCopy.hire.factsEducationLabel}</div>
            <div className="fact-value">
              {D.education[0].school} · {D.education[0].degree}
            </div>
          </div>
          <div className="fact">
            <div className="fact-label">{D.portfolioCopy.hire.factsLanguagesLabel}</div>
            <div className="fact-value">
              {D.languages.map((l) => `${l.name}(${l.level.split(" ")[0]})`).join(" · ")}
            </div>
          </div>
        </div>
      </div>
      <CoffeeCTA title={D.portfolioCopy.hire.coffee.title} sub={D.portfolioCopy.hire.coffee.sub} />
    </div>
  );
}
