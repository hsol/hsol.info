/**
 * 사람이 직접 손대는 레이아웃 오버라이드 (Human-in-the-loop)
 * ------------------------------------------------------------------
 * 빌더(CICD 생성본)나 DEFAULT 가 마음에 안 들 때, 사람이 여기에 페이지를 적으면
 * **그 페이지는 통째로 이 값으로 고정**된다(생성본·기본값보다 우선).
 *
 * 우선순위(BlockList resolve):
 *   LAYOUT_OVERRIDES(사람)  >  site-data.layout(빌더 생성)  >  DEFAULT_LAYOUT(코드 기본)
 *
 * 비워 두면 아무 영향이 없다. 한 페이지만 적으면 그 페이지만 고정되고 나머지는 그대로.
 * 잠긴 페이지 키(PAGE_KEYS)·등록된 블록 타입만 쓸 수 있다(Zod·레지스트리 가드레일).
 *
 * 예)
 *   export const LAYOUT_OVERRIDES: Partial<SiteLayout> = {
 *     pages: {
 *       hire: { blocks: [
 *         { type: "back" },
 *         { type: "viewHead", props: { room: "01 · HIRE", coord: "A1", persona: "hire" } },
 *         { type: "raw", props: { html: "<p>사람이 직접 넣은 한 줄</p>" } },
 *         { type: "coffeeCta", props: { persona: "hire" } },
 *       ] },
 *     },
 *   };
 */

import type { SiteLayout } from "@/content/layout-types";

export const LAYOUT_OVERRIDES: Partial<SiteLayout> = {
  // 기본은 비어 있음 — 필요할 때 사람이 페이지를 추가한다.
};

/** base 레이아웃 위에 override 를 **페이지 단위로 통째 교체**해 합친다. */
export function mergeLayout(base: SiteLayout, override?: Partial<SiteLayout> | null): SiteLayout {
  if (!override?.pages) return base;
  return {
    pages: {
      ...base.pages,
      ...override.pages,
    },
  };
}
