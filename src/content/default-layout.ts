/**
 * DEFAULT_LAYOUT — 현재(초기 버전) 레이아웃을 데이터로 그대로 옮긴 것.
 * ------------------------------------------------------------------
 * site-data.layout 이 없거나 일부 페이지가 비면 이 값으로 폴백한다.
 * 즉 빌더가 아무것도 안 해도, 또는 잘못 만들어도 사이트는 이 모습으로 뜬다.
 *
 * 이 파일은 "현재 뷰의 JSX 순서"를 1:1 로 반영한다.
 * 뷰 구성을 영구히 바꾸려면 빌더(site-data.json)에서 바꾸는 게 정석이고,
 * 이 파일은 어디까지나 안전한 기본값으로 둔다.
 */

import type { SiteLayout } from "@/content/layout-types";

const HIRE_CAREER_NOTE =
  "전체 경력을 시간순으로 열람할 수 있고, 채용 관점에서 특히 관련 있는 항목은 기본 펼침으로 큐레이션해 두었습니다.";
const COLLAB_CAREER_NOTE =
  "전체 경력을 시간순으로 열람할 수 있고, 협업·자문·빌딩 관점에서 특히 관련 있는 항목은 기본 펼침으로 두었습니다. 나머지는 접어 두었으며 왼쪽 + 로 펼칠 수 있습니다.";
const BUILDER_CAREER_NOTE =
  "전체 경력을 시간순으로 열람할 수 있고, 빌더 관점에서 특히 관련 있는 항목은 기본 펼침으로 두었습니다. 나머지는 접어 두었으며 왼쪽 + 로 펼칠 수 있습니다.";

export const DEFAULT_LAYOUT: SiteLayout = {
  pages: {
    home: {
      blocks: [
        { type: "homeHero" },
        { type: "homeDoors" },
        { type: "homeBuilt" },
        { type: "homeCoffee" },
      ],
    },
    hire: {
      blocks: [
        { type: "back" },
        { type: "viewHead", props: { room: "01 · HIRE", coord: "A1", persona: "hire" } },
        {
          type: "callout",
          props: {
            dataSection: "hire/jd-fit",
            eyebrow: "JD 적합도 분석",
            body: "검토 중인 채용 공고(JD)를 붙여넣으면, 임한솔의 경력·강점과 얼마나 맞는지 부합하는 지점과 보완이 필요한 지점을 함께 짚어 드립니다.",
            buttonLabel: "채용 공고 붙여넣고 적합도 보기 →",
            action: "jd",
          },
        },
        {
          type: "strengthsSection",
          props: { dataSection: "hire/strengths", title: "Strengths", num: "01", meta: "3 pillars" },
        },
        {
          type: "careerSection",
          props: {
            dataSection: "hire/experience",
            title: "Career timeline",
            num: "02",
            persona: "hire",
            metaTemplate: "hire",
            note: HIRE_CAREER_NOTE,
          },
        },
        {
          type: "hireFactsSection",
          props: { dataSection: "hire/facts", title: "Facts", num: "03", meta: "basic" },
        },
        { type: "coffeeCta", props: { persona: "hire" } },
      ],
    },
    collab: {
      blocks: [
        { type: "back" },
        { type: "viewHead", props: { room: "02 · COLLAB", coord: "B1", persona: "collab" } },
        {
          type: "callout",
          props: {
            dataSection: "collab/advice",
            eyebrow: "저라면 어떻게 볼까 · AI 자문",
            body: "지금 풀고 있는 이슈를 적어 주시면, 제 의사결정 방식(문제 재정의 · 작은 검증 · 구체화)을 그 상황에 적용해 저라면 어떻게 볼지 같이 짚어 드릴게요. 정해진 정답이 아니라 제 사고 틀을 빌린 관점이에요.",
            buttonLabel: "당신의 이슈에 대한 제 관점은요 →",
            action: "advice",
          },
        },
        {
          type: "pillarGridSection",
          props: {
            dataSection: "collab/methods",
            title: "How I work",
            num: "01",
            meta: "approach",
            sourceKey: "collab.methods",
          },
        },
        {
          type: "careerSection",
          props: {
            dataSection: "collab/career",
            title: "What I'm building & advisory",
            num: "02",
            persona: "collab",
            metaTemplate: "collab",
            note: COLLAB_CAREER_NOTE,
          },
        },
        { type: "coffeeCta", props: { persona: "collab" } },
      ],
    },
    builder: {
      blocks: [
        { type: "back" },
        { type: "viewHead", props: { room: "03 · BUILDER", coord: "B2", persona: "builder" } },
        {
          type: "builderFactsSection",
          props: { dataSection: "builder/stack", title: "Stack & domain", num: "01", meta: "practical" },
        },
        {
          type: "careerSection",
          props: {
            dataSection: "builder/career",
            title: "Career as builder",
            num: "02",
            persona: "builder",
            meta: "full timeline",
            note: BUILDER_CAREER_NOTE,
          },
        },
        {
          type: "builderWritingSection",
          props: { dataSection: "builder/writing", title: "Writing", num: "03", meta: "publications" },
        },
        { type: "coffeeCta", props: { persona: "builder" } },
      ],
    },
    curious: {
      blocks: [
        { type: "back" },
        { type: "viewHead", props: { room: "04 · CURIOUS", coord: "A2", persona: "curious" } },
        {
          type: "ganttSection",
          props: {
            dataSection: "curious/timeline",
            title: "Section drawing — 2012 to now",
            num: "01",
            meta: "parallel tracks",
          },
        },
        {
          type: "pillarGridSection",
          props: {
            dataSection: "curious/personal",
            title: "A bit personal",
            num: "02",
            meta: "off-record",
            sourceKey: "curious.notes",
          },
        },
        { type: "coffeeCta", props: { persona: "curious" } },
      ],
    },
    about: {
      blocks: [
        { type: "back" },
        {
          type: "viewHead",
          props: {
            room: "META · WHO",
            coord: "Z1",
            titleText: "임한솔",
            titleMeta: "30세 · 사회 12년차",
            lede: "이력서에는 안 적는 이야기를 모아놓은 페이지입니다. 제가 어떻게 자랐고 어떻게 일하며 무엇을 거쳐 왔는지 적었습니다.",
            media: "about-portrait",
          },
        },
        { type: "aboutProse" },
        { type: "aboutLinks" },
        { type: "coffeeCta" },
      ],
    },
    architecture: {
      blocks: [
        { type: "back" },
        { type: "plate" },
        {
          type: "viewHead",
          props: {
            room: "META · ARCH",
            coord: "Z0",
            titleText: "사이트 구조",
            lede: "온톨로지 vault와 SiteData, Blob·CI, Next 런타임·Ask가 서로 어떻게 연결되는지 한 도식으로 정리했습니다.",
            media: "architecture-mermaid",
          },
        },
      ],
    },
  },
};
