/**
 * 레이아웃 빌더용 블록 카탈로그 (프롬프트 주입용, 프레임워크 비의존)
 * ------------------------------------------------------------------
 * registry.tsx 의 MANIFESTS 는 런타임(React) 렌더용 정본이고,
 * 이 파일은 CICD 의 Claude(=레이아웃 빌더)에게 넣을 **순수 텍스트 카탈로그**다.
 * React 를 import 하지 않으므로 node 스크립트(refresh-site-data)에서 안전하게 쓸 수 있다.
 */

import { BLOCK_TYPES } from "@/content/layout-types";
import { PAGE_KEYS } from "@/content/site-structure";
import type { SiteLayout } from "@/content/layout-types";

interface CatalogEntry {
  type: string;
  role: string;
  /** props: 키 → 의미 (없으면 빈) */
  props?: Record<string, string>;
  pages: string[];
}

/** 블록 카탈로그(빌더가 읽는 요약). registry.tsx MANIFESTS 와 의미가 일치해야 한다. */
export const BLOCK_CATALOG: CatalogEntry[] = [
  { type: "back", role: "뒤로가기 바 + 언어 토글", pages: ["hire", "collab", "builder", "curious", "about", "architecture"] },
  { type: "plate", role: "신원 플레이트(이름·언어·상태)", pages: ["architecture"] },
  {
    type: "viewHead",
    role: "방번호·좌표·제목·lede. persona 면 제목/lede 자동, 아니면 titleText/lede/media",
    props: { room: "좌상단 라벨", coord: "GRID 좌표", persona: "있으면 viewHeaders[persona]", titleText: "리터럴 제목", titleMeta: "제목 옆 작은 메타", lede: "리드 문장", media: "'about-portrait' | 'architecture-mermaid'" },
    pages: ["hire", "collab", "builder", "curious", "about", "architecture"],
  },
  { type: "callout", role: "AI 기능 유도 박스(콜백 있을 때만 노출)", props: { dataSection: "값", eyebrow: "윗줄", body: "설명", buttonLabel: "버튼", action: "'jd' | 'advice'" }, pages: ["hire", "collab"] },
  { type: "coffeeCta", role: "Calendly 커피챗 CTA", props: { persona: "있으면 해당 coffee 카피" }, pages: ["hire", "collab", "builder", "curious", "about"] },
  { type: "strengthsSection", role: "강점 3 pillars(D.pillars)", props: { dataSection: "값", title: "제목", num: "§번호", meta: "메타" }, pages: ["hire"] },
  { type: "pillarGridSection", role: "필러 그리드(sourceKey 로 methods/notes)", props: { dataSection: "값", title: "제목", num: "§번호", meta: "메타", sourceKey: "'collab.methods' | 'curious.notes'" }, pages: ["collab", "curious"] },
  { type: "careerSection", role: "persona 별 경력 타임라인", props: { dataSection: "값", title: "제목", num: "§번호", persona: "hire|collab|builder", metaTemplate: "'hire'|'collab' 자동메타", meta: "고정메타", note: "큐레이션 안내" }, pages: ["hire", "collab", "builder"] },
  { type: "hireFactsSection", role: "채용 팩트 4종(연차·거점·학력·언어)", props: { dataSection: "값", title: "제목", num: "§번호", meta: "메타" }, pages: ["hire"] },
  { type: "builderFactsSection", role: "스택·도메인 + 자격증", props: { dataSection: "값", title: "제목", num: "§번호", meta: "메타" }, pages: ["builder"] },
  { type: "builderWritingSection", role: "블로그+출판물+글 카드", props: { dataSection: "값", title: "제목", num: "§번호", meta: "메타" }, pages: ["builder"] },
  { type: "ganttSection", role: "간트 타임라인", props: { dataSection: "값", title: "제목", num: "§번호", meta: "메타" }, pages: ["curious"] },
  { type: "aboutProse", role: "about 줄글 6문단", pages: ["about"] },
  { type: "aboutLinks", role: "외부 프로필 + 관점 링크", pages: ["about"] },
  { type: "homeHero", role: "히어로 + 평면도", pages: ["home"] },
  { type: "homeDoors", role: "4관점 도어", pages: ["home"] },
  { type: "homeBuilt", role: "사이트 제작 방식 소개", pages: ["home"] },
  { type: "homeCoffee", role: "홈 커피 인용 카드", pages: ["home"] },
  { type: "raw", role: "사람 전용 원시 블록(빌더는 쓰지 말 것)", props: { html: "HTML", text: "평문", className: "래퍼" }, pages: ["*"] },
];

/** 빌더가 따라야 할 조합 규칙(가드레일 요약). */
export const COMPOSITION_RULES = `
[조합 규칙 — 반드시 지킬 것]
- 페이지 키는 다음으로 고정: ${PAGE_KEYS.join(", ")}. 추가/삭제/개명 금지.
- 블록 type 은 카탈로그에 있는 것만 사용(미등록 type 은 거부됨). 'raw' 는 사람 전용이니 쓰지 말 것.
- 각 블록은 자기 페이지에서만 의미가 있다(카탈로그 pages 참고). 예: strengthsSection 은 hire 에서만.
- persona 페이지(hire/collab/builder/curious): 보통 back → viewHead(persona) → [callout?] → 섹션들 → coffeeCta(persona) 순.
- about: back → viewHead(media:about-portrait) → aboutProse → aboutLinks → coffeeCta.
- architecture: back → plate → viewHead(media:architecture-mermaid).
- home: homeHero → homeDoors → homeBuilt → homeCoffee (hero/doors 는 항상 함께).
- back 으로 시작(홈 제외), persona/about 은 coffeeCta 로 끝나는 골격은 유지.
- 섹션 num(§번호)은 보이는 순서대로. dataSection 은 의미 있는 값으로.
`.trim();

/** 카탈로그를 프롬프트용 텍스트로 직렬화. currentLayout 을 함께 실어 "현재 기준"을 보여준다. */
export function renderCatalogForPrompt(currentLayout: SiteLayout | undefined): string {
  const lines = BLOCK_CATALOG.map((b) => {
    const props = b.props ? ` | props: ${Object.entries(b.props).map(([k, v]) => `${k}(${v})`).join(", ")}` : "";
    return `- ${b.type} — ${b.role} | pages: ${b.pages.join("/")}${props}`;
  });
  const known = `등록된 block type(이것만 허용): ${BLOCK_TYPES.join(", ")}`;
  const current = currentLayout
    ? `\n[현재 레이아웃(이걸 기준=앵커로 삼아 점진 개선)]\n${JSON.stringify(currentLayout, null, 2)}`
    : "";
  return `[블록 카탈로그]\n${lines.join("\n")}\n\n${known}\n\n${COMPOSITION_RULES}${current}`;
}
