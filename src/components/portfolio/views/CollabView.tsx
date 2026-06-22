"use client";

import { Back, CareerList, CoffeeCTA, SecHead, useSiteData } from "@/components/portfolio/Atoms";
import { PersonaTimelineIntro, renderTitleLines, ViewHead } from "@/components/portfolio/view-primitives";

export function CollabView({
  onBack,
  onAskAdvice,
}: {
  onBack: () => void;
  onAskAdvice?: () => void;
}) {
  const D = useSiteData();
  const collabTiers = D.career.map((c) => c.tier.collab);
  const tier1Count = collabTiers.filter((t) => t === 1).length;
  return (
    <div className="view">
      <Back onBack={onBack} />
      <ViewHead
        room="02 · COLLAB"
        coord="B1"
        title={renderTitleLines(D.viewHeaders.collab.titleLines)}
        lede={D.viewHeaders.collab.lede}
      />

      {onAskAdvice && (
        <div className="hire-jd-callout" data-ask-section="collab/advice">
          <div className="hire-jd-callout-eyebrow">저라면 어떻게 볼까 · AI 자문</div>
          <p className="hire-jd-callout-body">
            지금 풀고 있는 이슈를 적어 주시면, 제 의사결정 방식(문제 재정의 · 작은 검증 ·
            구체화)을 그 상황에 적용해 저라면 어떻게 볼지 같이 짚어 드릴게요. 정해진 정답이
            아니라 제 사고 틀을 빌린 관점이에요.
          </p>
          <button type="button" className="hire-jd-callout-btn" onClick={onAskAdvice}>
            당신의 이슈에 대한 제 관점은요 →
          </button>
        </div>
      )}

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
          meta={`${D.career.length} roles · full timeline · ${tier1Count} highlighted`}
        />
        <PersonaTimelineIntro text={D.portfolioCopy.collab.timelineIntro} />
        <p className="career-curation-note">
          전체 경력을 시간순으로 열람할 수 있고, 협업·자문·빌딩 관점에서 특히 관련 있는 항목은 기본 펼침으로 두었습니다. 나머지는
          접어 두었으며 왼쪽 + 로 펼칠 수 있습니다.
        </p>
        <CareerList items={D.career} itemTiers={collabTiers} highlightTier1 />
      </div>
      <CoffeeCTA title={D.portfolioCopy.collab.coffee.title} sub={D.portfolioCopy.collab.coffee.sub} />
    </div>
  );
}
