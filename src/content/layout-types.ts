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
 * 정본(canonical) 블록 타입. 새 블록을 만들면 여기 + registry 양쪽에 추가한다.
 * (registry 와의 일치는 dev 런타임에서 assert 한다.)
 *
 * persona 섹션은 **페이지 비종속·범용 이름**으로 둔다(특정 페이지에 묶지 않는다).
 * 빌더/사람은 어느 persona 페이지에서든 가져다 쓸 수 있다.
 */
export const CANONICAL_BLOCK_TYPES = [
  // 프레임/공통
  "back",
  "plate",
  "viewHead",
  "callout",
  "coffeeCta",
  // persona 섹션(공용 — 페이지 비종속)
  "pillarsSection", // 3대 전략 pillars(D.pillars)
  "pillarGridSection", // 소스 카드 그리드(methods/notes 등)
  "careerSection", // persona 경력 타임라인
  "factsSection", // 기본 팩트(연차·거점·학력·언어)
  "skillsSection", // 스택·도메인 + 자격증
  "writingSection", // 블로그·출판·글
  "ganttSection", // 간트 타임라인
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

/**
 * 폐기 예정(deprecated) 별칭 — 과거 페이지명이 박힌 타입.
 * 기존 site-data.layout(Blob/커밋)이 이 이름을 참조하므로 **스키마는 계속 허용**하고
 * 렌더 시 정본 컴포넌트로 매핑한다(DEPRECATED_BLOCK_ALIASES). 카탈로그엔 노출하지 않는다.
 */
export const DEPRECATED_BLOCK_TYPES = [
  "strengthsSection",
  "hireFactsSection",
  "builderFactsSection",
  "builderWritingSection",
] as const;

/** 폐기 예정 별칭 → 정본 타입. */
export const DEPRECATED_BLOCK_ALIASES = {
  strengthsSection: "pillarsSection",
  hireFactsSection: "factsSection",
  builderFactsSection: "skillsSection",
  builderWritingSection: "writingSection",
} as const satisfies Record<(typeof DEPRECATED_BLOCK_TYPES)[number], (typeof CANONICAL_BLOCK_TYPES)[number]>;

/** 스키마용 전체 enum = 정본 + 폐기예정(기존 레이아웃 호환). */
export const BLOCK_TYPES = [...CANONICAL_BLOCK_TYPES, ...DEPRECATED_BLOCK_TYPES] as const;

export type CanonicalBlockType = (typeof CANONICAL_BLOCK_TYPES)[number];
export type BlockType = (typeof BLOCK_TYPES)[number];

/** 폐기 예정 별칭이면 정본 타입으로, 아니면 그대로. */
export function canonicalBlockType(type: BlockType): CanonicalBlockType {
  return (DEPRECATED_BLOCK_ALIASES as Record<string, CanonicalBlockType>)[type] ?? (type as CanonicalBlockType);
}

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
