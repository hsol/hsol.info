"use client";

/**
 * BlockList — 한 페이지의 블록 배열을 위→아래로 렌더한다.
 * 레이아웃 해석 우선순위:
 *   site-data.layout.pages[page] → (없으면) DEFAULT_LAYOUT.pages[page]
 * 알 수 없는 block.type 은 조용히 건너뛴다(가드레일: 깨진 데이터가 페이지를 무너뜨리지 않게).
 *
 * `.view` 래퍼·페이지 셸은 호출하는 페이지 컴포넌트가 제공한다(SSOT wrapperClass).
 * 여기서는 블록 시퀀스만 그린다.
 */

import { useSiteData } from "@/components/portfolio/Atoms";
import { COMPONENTS } from "@/components/portfolio/blocks/registry";
import { ComposeRenderer } from "@/components/portfolio/compose/ComposeRenderer";
import { DEFAULT_LAYOUT } from "@/content/default-layout";
import { LAYOUT_OVERRIDES } from "@/content/layout-overrides";
import type { Block } from "@/content/layout-types";
import type { PageKey } from "@/content/site-structure";

/**
 * 페이지 블록 해석 우선순위:
 *   LAYOUT_OVERRIDES(사람) > site-data.layout(빌더 생성) > DEFAULT_LAYOUT(코드 기본)
 * 깨진/빈 레이아웃은 다음 단계로 폴백하므로 페이지가 비는 일이 없다.
 */
export function resolvePageBlocks(
  page: PageKey,
  layout: { pages?: Partial<Record<PageKey, { blocks: Block[] }>> } | undefined,
): Block[] {
  const fromHuman = LAYOUT_OVERRIDES.pages?.[page]?.blocks;
  if (fromHuman && fromHuman.length > 0) return fromHuman;
  const fromData = layout?.pages?.[page]?.blocks;
  if (fromData && fromData.length > 0) return fromData;
  return DEFAULT_LAYOUT.pages[page]?.blocks ?? [];
}

export function BlockList({ page }: { page: PageKey }) {
  const data = useSiteData();

  /**
   * 해석 우선순위: LAYOUT_OVERRIDES(사람) > composition(빌더 생성, 컴포넌트 트리)
   *   > layout blocks(빌더 생성) > DEFAULT_LAYOUT(코드 기본).
   * 사람이 명시적으로 블록을 고정한 페이지가 아니면, composition 이 있을 때 그걸로 렌더한다.
   */
  const hasHumanOverride = (LAYOUT_OVERRIDES.pages?.[page]?.blocks?.length ?? 0) > 0;
  const composition = data.composition?.pages?.[page];
  if (!hasHumanOverride && composition && composition.nodes.length > 0) {
    return <ComposeRenderer nodes={composition.nodes} />;
  }

  const blocks = resolvePageBlocks(page, data.layout);

  return (
    <>
      {blocks.map((block, i) => {
        const Component = COMPONENTS[block.type];
        if (!Component) {
          if (process.env.NODE_ENV !== "production") {
            console.warn(`[blocks] 알 수 없는 block.type '${block.type}' (page=${page}) — 건너뜀`);
          }
          return null;
        }
        return <Component key={`${block.type}-${i}`} props={block.props} />;
      })}
    </>
  );
}
