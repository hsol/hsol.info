"use client";

/**
 * 블록 컴포넌트 모음.
 * ------------------------------------------------------------------
 * 각 블록은 기존 뷰의 JSX 를 **그대로** 옮겨 와 출력이 픽셀 동일하다.
 * 블록은 site-data(useSiteData) + 블록 컨텍스트(콜백·home 상호작용)만 읽는다.
 * layout 의 block.props 는 `props` 인자로 들어온다(섹션 제목·dataSection 등).
 */

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  Back,
  CareerList,
  CoffeeCTA,
  Pillars,
  Plate,
  PlanDiagram,
  SecHead,
  useSiteData,
} from "@/components/portfolio/Atoms";
import {
  PersonaTimelineIntro,
  renderTitleLines,
  ViewHead,
} from "@/components/portfolio/view-primitives";
import { HomeBuiltFlowDiagram } from "@/components/portfolio/HomeBuiltFlowDiagram";
import { MermaidDiagram } from "@/components/portfolio/MermaidDiagram";
import { SITE_ARCHITECTURE_MERMAID } from "@/content/site-architecture.mermaid";
import { COORDS, type PersonaKey } from "@/components/portfolio/portfolio-types";
import { GanttTimeline } from "@/components/portfolio/blocks/gantt";
import {
  useBlockCallbacks,
  useHomeInteraction,
} from "@/components/portfolio/blocks/context";
import type { SiteData } from "@/content/schema";

export interface BlockRenderProps {
  props?: Record<string, unknown>;
}

/* props 헬퍼 — 문자열 prop 을 안전하게 읽는다. */
function str(p: Record<string, unknown> | undefined, k: string, d = ""): string {
  const v = p?.[k];
  return typeof v === "string" ? v : d;
}

type PersonaCopyKey = keyof SiteData["portfolioCopy"];

/* ===== 프레임/공통 ============================================= */

export function BackBlock(_: BlockRenderProps) {
  const cb = useBlockCallbacks();
  return <Back onBack={cb.onBack ?? (() => {})} />;
}

export function PlateBlock(_: BlockRenderProps) {
  return <Plate />;
}

/**
 * viewHead — 두 형태.
 *  1) persona 페이지: props.persona → 제목·lede 를 D.viewHeaders[persona] 에서.
 *  2) about/architecture: props.titleText(+titleMeta)·lede 리터럴, props.media 로 자식.
 */
export function ViewHeadBlock({ props }: BlockRenderProps) {
  const D = useSiteData();
  const room = str(props, "room");
  const coord = str(props, "coord");
  const persona = str(props, "persona") as PersonaCopyKey | "";
  const media = str(props, "media"); // "" | "about-portrait" | "architecture-mermaid"

  let title: ReactNode;
  let lede: string;
  if (persona && persona in D.viewHeaders) {
    const vh = D.viewHeaders[persona as keyof SiteData["viewHeaders"]];
    title = renderTitleLines(vh.titleLines);
    lede = vh.lede;
  } else {
    const titleText = str(props, "titleText");
    const titleMeta = str(props, "titleMeta");
    title = titleMeta ? (
      <>
        {titleText}
        <span className="name-meta">{titleMeta}</span>
      </>
    ) : (
      <>{titleText}</>
    );
    lede = str(props, "lede");
  }

  let child: ReactNode = null;
  if (media === "about-portrait") {
    child = (
      <Image
        src="/hansol.avif"
        alt="임한솔 사진"
        width={189}
        height={172}
        className="about-portrait"
      />
    );
  } else if (media === "architecture-mermaid") {
    child = (
      <div className="architecture-mermaid-outer view-head-mermaid" aria-label="Architecture diagram">
        <MermaidDiagram chart={SITE_ARCHITECTURE_MERMAID} diagramHead={null} panZoom />
      </div>
    );
  }

  return (
    <ViewHead room={room} coord={coord} title={title} lede={lede}>
      {child}
    </ViewHead>
  );
}

/** callout — JD 적합도(hire) / 자문(collab). 해당 콜백이 있을 때만 렌더. */
export function CalloutBlock({ props }: BlockRenderProps) {
  const cb = useBlockCallbacks();
  const action = str(props, "action"); // "jd" | "advice"
  const handler = action === "jd" ? cb.onAnalyzeJd : action === "advice" ? cb.onAskAdvice : undefined;
  if (!handler) return null;
  return (
    <div className="hire-jd-callout" data-ask-section={str(props, "dataSection")}>
      <div className="hire-jd-callout-eyebrow">{str(props, "eyebrow")}</div>
      <p className="hire-jd-callout-body">{str(props, "body")}</p>
      <button type="button" className="hire-jd-callout-btn" onClick={handler}>
        {str(props, "buttonLabel")}
      </button>
    </div>
  );
}

/** coffeeCta — persona 가 있으면 해당 coffee 카피, 없으면 기본(about). */
export function CoffeeCtaBlock({ props }: BlockRenderProps) {
  const D = useSiteData();
  const persona = str(props, "persona") as PersonaCopyKey | "";
  if (persona && persona in D.portfolioCopy) {
    const copy = D.portfolioCopy[persona] as { coffee?: { title: string; sub: string } };
    if (copy.coffee) return <CoffeeCTA title={copy.coffee.title} sub={copy.coffee.sub} />;
  }
  return <CoffeeCTA />;
}

/* ===== persona 섹션 =========================================== */

/** strengthsSection — Strengths(3 pillars). */
export function StrengthsSectionBlock({ props }: BlockRenderProps) {
  return (
    <div className="sec" data-ask-section={str(props, "dataSection")}>
      <SecHead title={str(props, "title")} num={str(props, "num") || undefined} meta={str(props, "meta") || undefined} />
      <Pillars />
    </div>
  );
}

/** pillarGridSection — methods(collab) / notes(curious) 같은 pillar 그리드. */
export function PillarGridSectionBlock({ props }: BlockRenderProps) {
  const D = useSiteData();
  const sourceKey = str(props, "sourceKey"); // "collab.methods" | "curious.notes"
  const [group, field] = sourceKey.split(".") as [PersonaCopyKey, string];
  const copy = (D.portfolioCopy[group] ?? {}) as Record<string, unknown>;
  const items = (copy[field] as { no: string; name: string; en: string; blurb: string }[]) ?? [];
  return (
    <div className="sec" data-ask-section={str(props, "dataSection")}>
      <SecHead title={str(props, "title")} num={str(props, "num") || undefined} meta={str(props, "meta") || undefined} />
      <div className="pillars">
        {items.map((m) => (
          <div className="pillar" key={m.no}>
            <div className="pillar-no">{m.no}</div>
            <div className="pillar-name">{m.name}</div>
            <div className="pillar-en">{m.en}</div>
            <div className="pillar-blurb">{m.blurb}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** careerSection — persona 별 풀 경력 타임라인. */
export function CareerSectionBlock({ props }: BlockRenderProps) {
  const D = useSiteData();
  const persona = (str(props, "persona") || "hire") as PersonaKey;
  const tiers = D.career.map((c) => c.tier[persona] ?? 1);
  const tier1Count = tiers.filter((t) => t === 1).length;
  const metaTemplate = str(props, "metaTemplate");
  let meta = str(props, "meta") || undefined;
  if (metaTemplate === "hire") {
    meta = `${D.career.length} roles · ${tier1Count} selected`;
  } else if (metaTemplate === "collab") {
    meta = `${D.career.length} roles · full timeline · ${tier1Count} highlighted`;
  }
  const intro = (D.portfolioCopy[persona] as { timelineIntro?: string }).timelineIntro ?? "";
  return (
    <div className="sec" data-ask-section={str(props, "dataSection")}>
      <SecHead title={str(props, "title")} num={str(props, "num") || undefined} meta={meta} />
      <PersonaTimelineIntro text={intro} />
      <p className="career-curation-note">{str(props, "note")}</p>
      <CareerList items={D.career} itemTiers={tiers} highlightTier1 />
    </div>
  );
}

/** hireFactsSection — hire 전용 4 팩트(연차·거점·학력·언어). */
export function HireFactsSectionBlock({ props }: BlockRenderProps) {
  const D = useSiteData();
  return (
    <div className="sec" data-ask-section={str(props, "dataSection")}>
      <SecHead title={str(props, "title")} num={str(props, "num") || undefined} meta={str(props, "meta") || undefined} />
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
      <div className="facts-resume-cta">
        <Link className="facts-resume-link" href="/resume">
          이력서·포트폴리오 한 장으로 보기 (PDF 다운로드) →
        </Link>
      </div>
    </div>
  );
}

/** builderFactsSection — Stack & domain 팩트 + 자격증. */
export function BuilderFactsSectionBlock({ props }: BlockRenderProps) {
  const D = useSiteData();
  return (
    <div className="sec" data-ask-section={str(props, "dataSection")}>
      <SecHead title={str(props, "title")} num={str(props, "num") || undefined} meta={str(props, "meta") || undefined} />
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
  );
}

/**
 * Writing 카드 한 장. href 가 있으면 새 탭 링크(.pillar-link), 없으면 일반 카드.
 * (BuilderView 의 WritingPillar 를 그대로 옮김.)
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

/** builderWritingSection — 블로그 + publications + extraWritings(배열 순서대로 PIECE 번호). */
export function BuilderWritingSectionBlock({ props }: BlockRenderProps) {
  const D = useSiteData();
  const { blog, extraWritings } = D.portfolioCopy.builder;
  const writingCards = [
    blog,
    ...D.publications.map((p) => ({ name: p.title, en: "Publication", blurb: p.desc, href: p.href })),
    ...extraWritings,
  ];
  return (
    <div className="sec" data-ask-section={str(props, "dataSection")}>
      <SecHead title={str(props, "title")} num={str(props, "num") || undefined} meta={str(props, "meta") || undefined} />
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
  );
}

/** ganttSection — curious 간트 타임라인. */
export function GanttSectionBlock({ props }: BlockRenderProps) {
  const D = useSiteData();
  const cb = useBlockCallbacks();
  return (
    <div className="sec" data-ask-section={str(props, "dataSection")}>
      <SecHead title={str(props, "title")} num={str(props, "num") || undefined} meta={str(props, "meta") || undefined} />
      <PersonaTimelineIntro text={D.portfolioCopy.curious.timelineIntro} />
      <GanttTimeline items={D.portfolioCopy.curious.timeline} accent={cb.accent} />
    </div>
  );
}

/* ===== about ================================================== */

const ABOUT_BODY: string[] = [
  "컴퓨터와 친해진 건 초등학생 때부터입니다. 거실에 놓인 아버지의 LG 데스크톱이 제 첫 장난감이었습니다. 게임을 하기보다 그게 어떻게 짜였는지 뜯어보는 게 더 재밌었습니다. 스타크래프트 유즈맵을 만들고 친구들이 쓸 카페 채팅 프로그램을 짜고 동생을 위한 학습지 프로그램까지 만들며 자랐습니다. 영재원을 거치며 개발을 본격적으로 익혔습니다. 그 관심은 그대로 진로가 됐습니다. 특성화고인 선린인터넷고 정보통신과에 진학했습니다. C#으로 단어 학습 프로그램을, 자바로 용돈 저축 게임을, 페이스북을 흉내 낸 블로그 스킨 'Fakebook'을 만들어 블로그에 거의 매일 올렸습니다. 시작이 일렀던 덕분에 **열아홉부터 개발자로 취업해** 일했습니다. 그 무렵 대학생·사회인 연합동아리 넥스터즈에서 활동했고 선취업 후진학으로 건국대학교 경영공학과를 졸업했습니다.",
  "토스에서 5년을 일하고 나와 창업을 시작했습니다. 당당하던 직장인에서 다시 아쉬운 소리를 해야 하는 초심자로 돌아갔습니다. 그런데 이상하게도 그때가 더 재밌었습니다. 외주를 적당히 맡겼다가 일이 틀어지는 바람에 3주를 밤새워 혼자 마무리한 적도 있습니다. 코드를 남에게 맡길 때는 작정하고 챙겨야 한다는 것을 그 일로 배웠습니다. 사업 방향도 여러 번 틀었고 함께 시작한 동업자와도 결국 갈라섰습니다. 고객이 진짜로 원하지 않는 제품을 억지로 영업해 보기도 했는데 필요하지 않은 건 결국 팔리지 않더군요. 저보다 더 잘할 팀을 만났을 때는 제 아이템을 미련 없이 접었습니다. 집착보다 문제를 푸는 일이 늘 먼저였습니다. 그러면서도 매번 다시 깨닫는 사실이 하나 있습니다. **제품보다 고객이 먼저이고 고객보다 문제가 먼저**라는 것입니다.",
  "요즘은 코파운더와 함께 기업의 성장을 돕는 일을 합니다. 오프라인에 뿌리를 둔 회사가 디지털과 AI로 한 단계 도약하도록, 밖에서 조언만 하지 않고 **안에 들어가 함께 경영하며 키웁니다**. 지금 맡은 회사는 피피비스튜디오스입니다. 거기서 플랫폼팀장으로 온·오프라인을 잇는 O2O 플랫폼을 책임지고 개발팀이 일하는 방식을 바꾸고 AI를 업무에 들이고 있습니다. 따로 프루퍼라는 회사의 대표로는 with CTO 커뮤니티를 운영합니다. 원래는 데이터 기반 성과평가 SaaS를 팔려고 만든 자리였습니다. 아이템을 바꾸면서 영업이라는 목적은 사라졌습니다. 그래도 행사 자체에 존재 이유가 있다고 느껴서 지금은 제 비용과 시간을 들여 이어 가고 있습니다.",
  "판단은 빠른 편입니다. 대신 그 판단을 꼭 손에 잡히는 형태로 남겨 확인합니다. 회의 템플릿을 직접 만들고 로드맵을 색으로 칠해 팀과 진척을 맞춥니다. 블로그에는 십 년 넘게 천 편이 넘는 글을 쌓았습니다. **전부 같은 버릇입니다.** 이 사이트도 그 연장입니다. 흩어져 있던 기록을 한곳에 모아 제가 없는 자리에서도 AI 클론이 저 대신 사람들의 질문에 답하도록 만들었습니다.",
  "틈틈이 글도 씁니다. 올해 초에는 《메이커와 엔지니어》라는 전자책을 냈습니다. '개발자가 됐는데 그다음에는 무엇이 되어야 하는가'라는 질문을 12년 동안 곱씹은 끝에 제 나름의 답을 정리한 책입니다. 누가 시켜서가 아니라 제 생각을 한 번 매듭짓고 싶어서 썼습니다. 그래서 저에게는 이력서 한 줄보다 의미가 큽니다. 아침마다 같은 순서로 하루를 열고 그날 한 일과 떠오른 생각을 적어 둡니다. **그날의 저만이 그날의 저를 정확히 기록할 수 있다**고 믿기 때문입니다.",
  "제가 일할 때 끝까지 붙잡는 것은 **말과 행동을 맞추는 일**입니다. 그래서 누가 시켜서 하기보다 제가 정한 일을 끝까지 책임지려 합니다. 또 혼자 잘 해내는 것보다 곁에 있는 사람이 함께 잘되는 쪽에서 더 큰 보람을 느낍니다. 후배의 일을 돕거나 커뮤니티에 보탬이 될 때가 특히 그렇습니다. 이런 게 쌓여서 먼 훗날 누군가 저를 두고 무엇이든 믿고 맡길 수 있는 사람이었다고 말해 준다면 그걸로 충분합니다.",
];

/** 구조화 데이터 sameAs 와 일치시키는 외부 프로필(좌측). */
const EXTERNAL_PROFILES = [
  { label: "Blog", href: "https://blog.hsol.info" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/hsolim/" },
  { label: "GitHub", href: "https://github.com/hsol" },
  { label: "Gravatar", href: "https://gravatar.com/hsolim" },
];

/** 문단 문자열의 **굵게** 구간을 <strong> 으로 렌더한다(나머지는 평문). */
function renderRich(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((seg, i) =>
    seg.startsWith("**") && seg.endsWith("**") ? (
      <strong key={i}>{seg.slice(2, -2)}</strong>
    ) : (
      seg
    ),
  );
}

export function AboutProseBlock(_: BlockRenderProps) {
  return (
    <section className="entity-prose">
      {ABOUT_BODY.map((p, i) => (
        <p className="entity-p" key={i}>
          {renderRich(p)}
        </p>
      ))}
    </section>
  );
}

export function AboutLinksBlock(_: BlockRenderProps) {
  const data = useSiteData();
  return (
    <>
      <SecHead title="더 알아보기" />
      <div className="about-links">
        {/* 좌측: 외부 프로필 / 우측: 관점별 4개 뷰 */}
        <div className="about-links-col">
          <div className="about-links-head">프로필</div>
          {EXTERNAL_PROFILES.map((p) => (
            <a
              className="about-link"
              key={p.label}
              href={p.href}
              target="_blank"
              rel="me noopener noreferrer"
            >
              <span className="about-link-label">{p.label}</span>
              <span className="about-link-val">{p.href.replace(/^https?:\/\//, "")}</span>
            </a>
          ))}
        </div>
        <div className="about-links-col">
          <div className="about-links-head">관점별 보기</div>
          {data.personas.map((p) => (
            <Link className="about-link" key={p.key} href={`/${p.key}`}>
              <span className="about-link-label">{p.titleEn}</span>
              <span className="about-link-val">{p.title}</span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}

/* ===== home =================================================== */

export function HomeHeroBlock(_: BlockRenderProps) {
  const D = useSiteData();
  const { activeKey, setHovered, onPick } = useHomeInteraction();
  return (
    <section className="hero" data-ask-section="home/hero">
      <div className="hero-left">
        <div>
          <div className="hero-eyebrow">
            <span className="axis"></span>
            {D.portfolioCopy.home.heroEyebrow}
          </div>
          <h1 className="hero-title">
            {D.portfolioCopy.home.heroTitleLines.map((line, idx) => {
              const isLast = idx === D.portfolioCopy.home.heroTitleLines.length - 1;
              // 마지막 줄에서는 이름(임한솔)만 하이라이트하고 "입니다." 등 뒤따르는 말은 평문으로 둔다.
              const nameAt = isLast ? line.indexOf(D.identity.name) : -1;
              return (
                <span className="blk" key={`${line}-${idx}`}>
                  {!isLast ? (
                    line
                  ) : nameAt < 0 ? (
                    <span className="hi">{line}</span>
                  ) : (
                    <>
                      {line.slice(0, nameAt)}
                      <Link
                        href="/about"
                        className="hero-name-link"
                        aria-label={`${D.identity.name} 소개 페이지로 이동`}
                      >
                        <span className="hi">{D.identity.name}</span>
                      </Link>
                      {line.slice(nameAt + D.identity.name.length)}
                    </>
                  )}
                </span>
              );
            })}
          </h1>
          <p className="hero-sub">
            {D.portfolioCopy.home.heroSubLead}
            <span className="em"> {D.portfolioCopy.home.heroSubEmphasis}</span>{" "}
            {D.portfolioCopy.home.heroSubTail}
          </p>
        </div>
        <div className="hero-meta">
          <span>
            <b>{D.portfolioCopy.home.heroMetaSinceLabel}</b> {D.portfolioCopy.home.heroMetaSinceValue}
          </span>
          <span>
            <b>{D.portfolioCopy.home.heroMetaNowLabel}</b> {D.portfolioCopy.home.heroMetaNowValue}
          </span>
          <span>
            <b>{D.portfolioCopy.home.heroMetaBaseLabel}</b> {D.portfolioCopy.home.heroMetaBaseValue}
          </span>
        </div>
      </div>
      <PlanDiagram
        onPick={(k) => onPick(k as PersonaKey)}
        hovered={activeKey}
        onHover={(k) => setHovered(k as PersonaKey | null)}
      />
    </section>
  );
}

export function HomeDoorsBlock(_: BlockRenderProps) {
  const D = useSiteData();
  const { activeKey, setHovered, bumpInteract, onPick } = useHomeInteraction();
  return (
    <section className="doors" data-ask-section="home/doors">
      <div className="doors-head">
        <h2 className="doors-h">{D.portfolioCopy.home.doorsTitle}</h2>
        <div className="doors-meta">{D.portfolioCopy.home.doorsMeta}</div>
      </div>
      <nav className="doors-list" aria-label="페르소나 둘러보기">
        {D.personas.map((p) => (
          <button
            className={"persona" + (activeKey === p.key ? " is-hover" : "")}
            key={p.key}
            type="button"
            onClick={() => onPick(p.key as PersonaKey)}
            onMouseEnter={() => {
              setHovered(p.key as PersonaKey);
              bumpInteract();
            }}
            onMouseLeave={() => setHovered(null)}
          >
            <div className="persona-mark">
              <span className="lbl">No.</span>
              <span>{p.mark}</span>
            </div>
            <div className="persona-body">
              <div className="persona-title">{p.title}</div>
              <div className="persona-hint">{p.hint}</div>
            </div>
            <div className="persona-coord">{COORDS[p.key]}</div>
            <div className="persona-arrow">→</div>
          </button>
        ))}
      </nav>
    </section>
  );
}

export function HomeBuiltBlock(_: BlockRenderProps) {
  const D = useSiteData();
  return (
    <section className="home-built" data-ask-section="home/built">
      <div className="home-built-head">
        <h2 className="home-built-h">{D.portfolioCopy.home.builtTitle}</h2>
        <div className="home-built-meta">{D.portfolioCopy.home.builtMeta}</div>
      </div>
      <p className="home-built-body">{D.portfolioCopy.home.builtBody}</p>
      <div className="home-built-grid">
        {D.portfolioCopy.home.builtCards.map((card) => (
          <article className="home-built-card" key={card.title}>
            <h3 className="home-built-card-title">{card.title}</h3>
            <p className="home-built-card-body">{card.body}</p>
          </article>
        ))}
      </div>
      <HomeBuiltFlowDiagram />
      <div className="home-built-perspectives">
        <div className="home-built-perspectives-head">
          <h3 className="home-built-perspectives-title">{D.portfolioCopy.home.builtPerspectiveTitle}</h3>
          <div className="home-built-perspectives-meta">{D.portfolioCopy.home.builtPerspectiveMeta}</div>
        </div>
        <div className="home-built-perspectives-grid">
          {D.portfolioCopy.home.builtPerspectives.map((item) => (
            <article className="home-built-perspective" key={item.title}>
              <h4 className="home-built-perspective-title">{item.title}</h4>
              <p className="home-built-perspective-summary">{item.summary}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HomeCoffeeBlock(_: BlockRenderProps) {
  const D = useSiteData();
  return (
    <section className="coffee" data-ask-section="home/coffee">
      <div className="coffee-card">
        <div className="coffee-quote">“</div>
        <div className="coffee-body">
          <div className="coffee-eyebrow">{D.portfolioCopy.home.coffeeEyebrow}</div>
          <h3 className="coffee-h">{D.portfolioCopy.home.coffeeTitle}</h3>
          <p className="coffee-p">{D.portfolioCopy.home.coffeeBody}</p>
          <div className="coffee-cta">
            <a className="coffee-btn" href={D.identity.calendly} target="_blank" rel="noopener">
              {D.portfolioCopy.home.coffeeButtonLabel} <span className="arr">→</span>
            </a>
            <a className="coffee-link" href={"mailto:" + D.identity.email}>
              {D.identity.email}
            </a>
          </div>
        </div>
        <div className="coffee-photo">
          <picture>
            <source srcSet="/hansol.avif" type="image/avif" />
            <source srcSet="/hansol.webp" type="image/webp" />
            <Image
              src="/hansol.png"
              alt={`${D.identity.name} 프로필 사진`}
              width={189}
              height={172}
              loading="lazy"
              sizes="(max-width: 720px) 120px, 200px"
            />
          </picture>
        </div>
      </div>
    </section>
  );
}

/* ===== 탈출구 ================================================= */

/**
 * raw — 사람이 직접 마크업을 꽂는 탈출구.
 * props.html(문자열) 을 그대로 주입하거나, props.text 를 문단으로 출력.
 * 빌더가 표현 못 하는 일회성 레이아웃을 사람이 직접 넣을 때 쓴다.
 */
export function RawBlock({ props }: BlockRenderProps) {
  const html = str(props, "html");
  const className = str(props, "className") || undefined;
  if (html) {
    return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
  }
  const text = str(props, "text");
  return text ? <div className={className}>{text}</div> : null;
}
