/**
 * 레이아웃(블록 조합) 타입 + Zod 스키마.
 * ------------------------------------------------------------------
 * layout 은 site-data.json 의 **선택적** 필드다. 없거나 깨지면
 * 코드의 DEFAULT_LAYOUT 으로 폴백하므로 사이트는 절대 안 깨진다.
 *
 * 블록 = 페이지를 위→아래로 채우는 한 조각.
 *   { type: <레지스트리에 등록된 블록 키>, props?: {...} }
 *
 * 콘텐츠 값은 여전히 site-data 의 기존 위치(career, portfolioCopy 등)에 있고,
 * 블록은 그 슬라이스를 읽어 그린다. layout 은 "무엇을 어떤 순서로"만 기술한다.
 */

import { z } from "zod";
import { PAGE_KEYS } from "@/content/site-structure";

/**
 * 등록된 블록 타입. 새 블록을 만들면 여기 + registry 양쪽에 추가한다.
 * (registry 와 이 enum 의 일치는 dev 런타임에서 assert 한다.)
 */
export const BLOCK_TYPES = [
  // 프레임/공통
  "back",
  "plate",
  "viewHead",
  "callout",
  "coffeeCta",
  // persona 섹션
  "strengthsSection",
  "pillarGridSection",
  "careerSection",
  "hireFactsSection",
  "builderFactsSection",
  "builderWritingSection",
  "ganttSection",
  // about
  "aboutProse",
  "aboutLinks",
  // home
  "homeHero",
  "homeDoors",
  "homeBuilt",
  "homeCoffee",
  // 탈출구(사람이 직접 마크업/HTML 을 꽂을 때)
  "raw",
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];

/** 단일 블록. props 는 블록 타입별로 다르지만, Zod 단계에서는 통과(passthrough)시키고 각 블록 컴포넌트가 자기 props 를 해석한다. */
export const blockSchema = z
  .object({
    type: z.enum(BLOCK_TYPES),
    /** 블록별 파라미터(섹션 제목·dataSection·소스 키 등). */
    props: z.record(z.string(), z.unknown()).optional(),
    /** 사람이 메모를 남길 수 있는 자리(렌더에는 영향 없음). */
    note: z.string().optional(),
  })
  .strict();

export type Block = z.infer<typeof blockSchema>;

export const pageLayoutSchema = z
  .object({
    blocks: z.array(blockSchema),
  })
  .strict();

export type PageLayout = z.infer<typeof pageLayoutSchema>;

/**
 * 사이트 전체 레이아웃. pages 의 키는 PAGE_KEYS(SSOT)로 제한된다 —
 * 빌더가 알 수 없는 페이지를 추가하면 Zod 가 거부한다(가드레일).
 * 일부 페이지만 채워도 되고, 빠진 페이지는 DEFAULT_LAYOUT 으로 폴백한다.
 */
export const layoutSchema = z
  .object({
    pages: z
      .object(
        Object.fromEntries(PAGE_KEYS.map((k) => [k, pageLayoutSchema.optional()])) as Record<
          (typeof PAGE_KEYS)[number],
          z.ZodOptional<typeof pageLayoutSchema>
        >,
      )
      .strict(),
  })
  .strict();

export type SiteLayout = z.infer<typeof layoutSchema>;
