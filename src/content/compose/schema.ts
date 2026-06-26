/**
 * 컴포지션(생성형 컴포넌트-트리) 스키마.
 * ------------------------------------------------------------------
 * 메인 사이트의 새 레이아웃 모델: 빌더(LLM)가 디자인시스템 컴포넌트를 트리로 조합하고
 * content-bearing 컴포넌트의 내용을 vault 근거로 직접 작성한다.
 *
 * site-data.composition 은 **선택** 필드다. 페이지에 composition 이 있으면 그걸로 렌더하고,
 * 없으면 기존 layout(blocks) → DEFAULT_LAYOUT 으로 폴백한다(무중단 점진 도입).
 *
 * 여기서는 트리 "형태"만 검증한다. 각 노드의 props 는 렌더 시 컴포넌트별 propsSchema 로
 * 검증하고(통과 못 하면 그 노드만 스킵), 미등록 component 도 스킵한다.
 */

import { z } from "zod";
import { PAGE_KEYS } from "@/content/site-structure";

export type ComposeNode = {
  component: string;
  props?: Record<string, unknown>;
  children?: ComposeNode[];
};

/** 재귀 노드: { component, props?, children? }. props 는 여기선 passthrough(렌더에서 컴포넌트별 검증). */
export const composeNodeSchema: z.ZodType<ComposeNode> = z.lazy(() =>
  z
    .object({
      component: z.string().min(1),
      props: z.record(z.string(), z.unknown()).optional(),
      children: z.array(composeNodeSchema).optional(),
    })
    .strict(),
);

export const pageCompositionSchema = z
  .object({
    nodes: z.array(composeNodeSchema).min(1),
  })
  .strict();

export type PageComposition = z.infer<typeof pageCompositionSchema>;

/** 페이지 키는 PAGE_KEYS(SSOT)로 제한. 일부 페이지만 채워도 되고, 빠진 페이지는 blocks/DEFAULT 로 폴백. */
export const siteCompositionSchema = z
  .object({
    pages: z
      .object(
        Object.fromEntries(
          PAGE_KEYS.map((k) => [k, pageCompositionSchema.optional()]),
        ) as Record<(typeof PAGE_KEYS)[number], z.ZodOptional<typeof pageCompositionSchema>>,
      )
      .strict(),
  })
  .strict();

export type SiteComposition = z.infer<typeof siteCompositionSchema>;
