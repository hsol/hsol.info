"use client";

/**
 * 컴포지션 컴포넌트 레지스트리.
 * ------------------------------------------------------------------
 * component 이름 → 렌더 컴포넌트 매핑. 매니페스트(content/compose/manifest.ts)와
 * 짝을 이루며, dev 에서 assertComposeRegistry() 가 어긋남(누락/잉여)을 경고한다.
 *
 * 각 컴포넌트는 `{ props, children? }` 형태로 호출된다. props 는 ComposeRenderer 가
 * 매니페스트의 propsSchema 로 검증·파싱한 값이고, children 은 컨테이너에서만 채워진다.
 */

import type { ReactNode } from "react";
import { COMPOSE_MANIFEST, type ComposeComponentName } from "@/content/compose/manifest";
import {
  BackBound,
  Callout,
  CardGrid,
  CareerTimeline,
  ChipList,
  CoffeeCTABound,
  Divider,
  FactsBound,
  Gantt,
  Grid,
  Heading,
  KeyValueList,
  LinkList,
  MetricGrid,
  PillarGridBound,
  PillarsBound,
  Prose,
  Quote,
  Section,
  SkillsBound,
  Split,
  Stack,
  ViewHeadBound,
  WritingBound,
} from "@/components/portfolio/compose/components";

export type ComposeComponent = (args: { props: any; children?: ReactNode }) => ReactNode;

export const COMPOSE_COMPONENTS: Record<ComposeComponentName, ComposeComponent> = {
  // 컨테이너
  Section,
  Stack,
  Split,
  Grid,
  // 콘텐츠
  Heading,
  Prose,
  MetricGrid,
  Callout,
  Quote,
  ChipList,
  KeyValueList,
  CardGrid,
  LinkList,
  Divider,
  // 데이터 바인딩
  ViewHead: ViewHeadBound,
  CareerTimeline,
  Gantt,
  Facts: FactsBound,
  Skills: SkillsBound,
  Writing: WritingBound,
  PillarGrid: PillarGridBound,
  Pillars: PillarsBound,
  CoffeeCTA: CoffeeCTABound,
  Back: BackBound,
};

/** dev 가드: 매니페스트 ↔ 레지스트리 키 일치 검사. */
export function assertComposeRegistry() {
  for (const name of Object.keys(COMPOSE_MANIFEST) as ComposeComponentName[]) {
    if (!COMPOSE_COMPONENTS[name]) console.warn(`[compose] COMPOSE_COMPONENTS 에 '${name}' 누락`);
  }
  for (const name of Object.keys(COMPOSE_COMPONENTS)) {
    if (!(name in COMPOSE_MANIFEST)) console.warn(`[compose] COMPOSE_MANIFEST 에 '${name}' 누락(잉여 구현)`);
  }
}

if (process.env.NODE_ENV !== "production") {
  assertComposeRegistry();
}
