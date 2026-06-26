"use client";

/**
 * 블록 레지스트리 + 매니페스트(카탈로그).
 * ------------------------------------------------------------------
 * - COMPONENTS : block.type → 렌더 컴포넌트
 * - MANIFESTS  : 사이트 빌더(사람·AI)가 "무슨 블록을 언제 쓰는지" 읽는 카탈로그
 *
 * 새 블록을 추가하려면:
 *   1) layout-types.ts BLOCK_TYPES 에 키 추가
 *   2) components.tsx 에 컴포넌트 작성
 *   3) 여기 COMPONENTS + MANIFESTS 에 등록
 * 세 군데가 어긋나면 dev 에서 assertRegistryComplete() 가 경고한다.
 */

import type { ComponentType } from "react";
import {
  CANONICAL_BLOCK_TYPES,
  DEPRECATED_BLOCK_TYPES,
  type BlockType,
  type CanonicalBlockType,
} from "@/content/layout-types";
import {
  AboutLinksBlock,
  AboutProseBlock,
  BackBlock,
  BuilderFactsSectionBlock,
  BuilderWritingSectionBlock,
  CalloutBlock,
  CareerSectionBlock,
  CoffeeCtaBlock,
  GanttSectionBlock,
  HireFactsSectionBlock,
  HomeBuiltBlock,
  HomeCoffeeBlock,
  HomeDoorsBlock,
  HomeHeroBlock,
  PillarGridSectionBlock,
  PlateBlock,
  RawBlock,
  StrengthsSectionBlock,
  ViewHeadBlock,
  type BlockRenderProps,
} from "@/components/portfolio/blocks/components";

export type BlockComponent = ComponentType<BlockRenderProps>;

export const COMPONENTS: Record<BlockType, BlockComponent> = {
  back: BackBlock,
  plate: PlateBlock,
  viewHead: ViewHeadBlock,
  callout: CalloutBlock,
  coffeeCta: CoffeeCtaBlock,
  // persona 섹션(공용)
  pillarsSection: StrengthsSectionBlock,
  pillarGridSection: PillarGridSectionBlock,
  careerSection: CareerSectionBlock,
  factsSection: HireFactsSectionBlock,
  skillsSection: BuilderFactsSectionBlock,
  writingSection: BuilderWritingSectionBlock,
  ganttSection: GanttSectionBlock,
  aboutProse: AboutProseBlock,
  aboutLinks: AboutLinksBlock,
  homeHero: HomeHeroBlock,
  homeDoors: HomeDoorsBlock,
  homeBuilt: HomeBuiltBlock,
  homeCoffee: HomeCoffeeBlock,
  raw: RawBlock,
  // 폐기 예정 별칭(기존 레이아웃 호환) — 정본과 같은 컴포넌트로 렌더.
  strengthsSection: StrengthsSectionBlock,
  hireFactsSection: HireFactsSectionBlock,
  builderFactsSection: BuilderFactsSectionBlock,
  builderWritingSection: BuilderWritingSectionBlock,
};

/** 빌더용 카탈로그 항목. */
export interface BlockManifest {
  type: BlockType;
  /** 사람이 읽는 이름 */
  name: string;
  /** 한 줄 역할 */
  role: string;
  /** 언제 쓰는가 */
  whenToUse: string;
  /** 받는 props 설명(키: 의미). 없으면 빈 객체. */
  props: Record<string, string>;
  /** 이 블록이 읽는 site-data 슬라이스 */
  reads: string[];
  /** 어느 페이지에서 주로 쓰이는가(가이드용) */
  pages: string[];
}

export const MANIFESTS: Record<CanonicalBlockType, BlockManifest> = {
  back: {
    type: "back",
    name: "뒤로가기 바",
    role: "처음으로 돌아가기 버튼 + 언어 토글.",
    whenToUse: "홈을 제외한 모든 페이지 최상단. 보통 페이지의 첫 블록.",
    props: {},
    reads: [],
    pages: ["hire", "collab", "builder", "curious", "about", "architecture"],
  },
  plate: {
    type: "plate",
    name: "신원 플레이트",
    role: "이름·언어·상태(Open for coffee) 헤더 바.",
    whenToUse: "standalone 셸 페이지에서 banner 가 필요할 때(예: /architecture).",
    props: {},
    reads: ["identity"],
    pages: ["architecture"],
  },
  viewHead: {
    type: "viewHead",
    name: "뷰 헤더",
    role: "방 번호·좌표·제목·lede. media 로 초상/다이어그램 자식을 품을 수 있음.",
    whenToUse: "back 바로 다음, 페이지의 제목 영역. persona 면 제목·lede 를 데이터에서 자동.",
    props: {
      room: "좌상단 라벨(예: '01 · HIRE')",
      coord: "우상단 GRID 좌표(예: 'A1')",
      persona: "있으면 D.viewHeaders[persona] 에서 제목·lede 를 가져옴",
      titleText: "persona 가 없을 때 제목 텍스트",
      titleMeta: "제목 옆 작은 메타(예: '30세 · 사회 12년차')",
      lede: "persona 가 없을 때 리드 문장",
      media: "'about-portrait' | 'architecture-mermaid' (자식 시각요소)",
    },
    reads: ["viewHeaders"],
    pages: ["hire", "collab", "builder", "curious", "about", "architecture"],
  },
  callout: {
    type: "callout",
    name: "액션 콜아웃",
    role: "AI 기능 유도 박스(JD 적합도/자문). 콜백이 있을 때만 노출.",
    whenToUse: "hire(=JD 분석)·collab(=자문)에서 viewHead 다음.",
    props: {
      dataSection: "data-ask-section 값",
      eyebrow: "윗줄 라벨",
      body: "설명 문단",
      buttonLabel: "버튼 문구",
      action: "'jd' | 'advice' — 어느 콜백을 부를지",
    },
    reads: [],
    pages: ["hire", "collab"],
  },
  coffeeCta: {
    type: "coffeeCta",
    name: "커피챗 CTA",
    role: "Calendly 예약 위젯. persona 면 해당 coffee 카피 사용.",
    whenToUse: "persona/about 페이지의 마지막 블록.",
    props: { persona: "있으면 D.portfolioCopy[persona].coffee 의 title/sub 사용" },
    reads: ["identity", "portfolioCopy.*.coffee"],
    pages: ["hire", "collab", "builder", "curious", "about"],
  },
  pillarsSection: {
    type: "pillarsSection",
    name: "필러 섹션(공용)",
    role: "3대 전략 pillars 그리드(D.pillars).",
    whenToUse: "강점·전략 소개. 어느 persona 페이지에서나.",
    props: {
      dataSection: "data-ask-section 값",
      title: "섹션 제목",
      num: "§ 번호",
      meta: "우측 메타",
    },
    reads: ["pillars"],
    pages: ["hire", "collab", "builder", "curious"],
  },
  pillarGridSection: {
    type: "pillarGridSection",
    name: "필러 그리드 섹션(공용)",
    role: "{no,name,en,blurb} 카드 그리드(방법론·개인 노트 등).",
    whenToUse: "방법론('How I work')·개인 노트('A bit personal') 등 카드 그리드.",
    props: {
      dataSection: "data-ask-section 값",
      title: "섹션 제목",
      num: "§ 번호",
      meta: "우측 메타",
      sourceKey: "'collab.methods' | 'curious.notes' 등 portfolioCopy 경로",
    },
    reads: ["portfolioCopy.<group>.<field>"],
    pages: ["hire", "collab", "builder", "curious"],
  },
  careerSection: {
    type: "careerSection",
    name: "경력 타임라인 섹션(공용)",
    role: "persona 별 펼침/접힘 큐레이션이 적용된 풀 경력 타임라인.",
    whenToUse: "경력 섹션. persona 인자로 큐레이션을 고른다.",
    props: {
      dataSection: "data-ask-section 값",
      title: "섹션 제목",
      num: "§ 번호",
      persona: "tier 큐레이션·intro 를 고를 키(hire|collab|builder|curious)",
      metaTemplate: "'hire' | 'collab' (메타 자동 계산) — 없으면 meta 리터럴 사용",
      meta: "metaTemplate 없을 때 고정 메타(예: 'full timeline')",
      note: "타임라인 위 큐레이션 안내 문단",
    },
    reads: ["career", "portfolioCopy.<persona>.timelineIntro"],
    pages: ["hire", "collab", "builder", "curious"],
  },
  factsSection: {
    type: "factsSection",
    name: "기본 팩트 섹션(공용)",
    role: "연차·거점·학력·언어 4팩트 그리드 + 이력서 링크.",
    whenToUse: "기본 정보 요약. 어느 persona 페이지에서나.",
    props: { dataSection: "값", title: "제목", num: "§ 번호", meta: "메타" },
    reads: ["portfolioCopy.hire", "identity.location", "education", "languages"],
    pages: ["hire", "collab", "builder", "curious"],
  },
  skillsSection: {
    type: "skillsSection",
    name: "스택·도메인 섹션(공용)",
    role: "Stack & domain 팩트(가변) + 자격증.",
    whenToUse: "스택·도메인·자격 소개. 어느 persona 페이지에서나.",
    props: { dataSection: "값", title: "제목", num: "§ 번호", meta: "메타" },
    reads: ["portfolioCopy.builder.facts", "certifications"],
    pages: ["hire", "collab", "builder", "curious"],
  },
  writingSection: {
    type: "writingSection",
    name: "글쓰기 섹션(공용)",
    role: "블로그(고정) + publications + extraWritings 카드 그리드.",
    whenToUse: "글·출판물 소개. 어느 persona 페이지에서나.",
    props: { dataSection: "값", title: "제목", num: "§ 번호", meta: "메타" },
    reads: ["publications", "portfolioCopy.builder.extraWritings"],
    pages: ["hire", "collab", "builder", "curious"],
  },
  ganttSection: {
    type: "ganttSection",
    name: "간트 타임라인 섹션(공용)",
    role: "병렬 트랙 간트 차트(연도 파싱·hover 팝업).",
    whenToUse: "인생 궤적 타임라인. 어느 persona 페이지에서나.",
    props: { dataSection: "값", title: "제목", num: "§ 번호", meta: "메타" },
    reads: ["portfolioCopy.curious.timeline", "portfolioCopy.curious.timelineIntro"],
    pages: ["hire", "collab", "builder", "curious"],
  },
  aboutProse: {
    type: "aboutProse",
    name: "about 줄글",
    role: "이력서에 안 적는 자기 서사 6문단(**굵게** 지원).",
    whenToUse: "about 본문.",
    props: {},
    reads: [],
    pages: ["about"],
  },
  aboutLinks: {
    type: "aboutLinks",
    name: "about 링크 그리드",
    role: "'더 알아보기' — 외부 프로필 + 관점별 4뷰 링크.",
    whenToUse: "about 본문 다음.",
    props: {},
    reads: ["personas"],
    pages: ["about"],
  },
  homeHero: {
    type: "homeHero",
    name: "홈 히어로",
    role: "에이어브로·제목·서브·메타 + 평면도(PlanDiagram). doors 와 활성키 공유.",
    whenToUse: "home 의 첫 화면.",
    props: {},
    reads: ["portfolioCopy.home", "identity.name", "personas"],
    pages: ["home"],
  },
  homeDoors: {
    type: "homeDoors",
    name: "홈 페르소나 도어",
    role: "4관점 진입 버튼 목록. hero 와 활성키 공유.",
    whenToUse: "home 히어로 다음.",
    props: {},
    reads: ["portfolioCopy.home", "personas"],
    pages: ["home"],
  },
  homeBuilt: {
    type: "homeBuilt",
    name: "홈 제작 방식",
    role: "이 사이트가 만들어진 방식 — 카드·데이터플로우·관점 요약.",
    whenToUse: "home 의 메타 소개.",
    props: {},
    reads: ["portfolioCopy.home.built*"],
    pages: ["home"],
  },
  homeCoffee: {
    type: "homeCoffee",
    name: "홈 커피 인용 카드",
    role: "인용부호 + 카피 + Calendly 버튼 + 프로필 사진(홈 전용 레이아웃).",
    whenToUse: "home 의 마지막 블록.",
    props: {},
    reads: ["portfolioCopy.home.coffee*", "identity"],
    pages: ["home"],
  },
  raw: {
    type: "raw",
    name: "원시 블록(사람 전용)",
    role: "사람이 직접 HTML/텍스트를 꽂는 탈출구.",
    whenToUse: "빌더가 표현 못 하는 일회성 레이아웃을 사람이 직접 넣을 때.",
    props: {
      html: "그대로 주입할 HTML 문자열(신뢰된 사람 입력만)",
      text: "html 대신 평문",
      className: "래퍼 className",
    },
    reads: [],
    pages: ["*"],
  },
};

/** dev 가드: 정본은 COMPONENTS+MANIFESTS 둘 다, 폐기예정 별칭은 COMPONENTS 만 검사. */
export function assertRegistryComplete() {
  for (const t of CANONICAL_BLOCK_TYPES) {
    if (!COMPONENTS[t]) console.warn(`[blocks] COMPONENTS 에 '${t}' 누락`);
    if (!MANIFESTS[t]) console.warn(`[blocks] MANIFESTS 에 '${t}' 누락`);
  }
  for (const t of DEPRECATED_BLOCK_TYPES) {
    if (!COMPONENTS[t]) console.warn(`[blocks] COMPONENTS 에 폐기예정 별칭 '${t}' 누락`);
  }
}
