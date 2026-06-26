/**
 * 디자인시스템 컴포넌트 매니페스트.
 * ------------------------------------------------------------------
 * 빌더(LLM)와 렌더러가 공유하는 단일 진실: 각 컴포넌트의 용도·시각 형태·콘텐츠 스키마(Zod).
 * - content-bearing: 내용을 props 로 받는다(LLM 이 vault 근거로 작성).
 * - data-bound(dataBound:true): site-data 슬라이스를 컴포넌트가 직접 읽는다(LLM 은 배치만).
 *
 * 새 컴포넌트 추가 시: 여기 + compose/components.tsx + compose/registry.ts 세 곳을 맞춘다
 * (registry 의 assert 가 어긋남을 dev 에서 잡는다).
 */

import { z } from "zod";

export interface ComposeManifestEntry {
  /** 사람이 읽는 이름 */
  name: string;
  /** 언제 쓰는가 */
  purpose: string;
  /** 시각 형태 한 줄(LLM 이 모양을 예상하도록) */
  shape: string;
  /** children 을 받는 컨테이너인가 */
  container: boolean;
  /** site-data 를 직접 읽는 데이터 바인딩 컴포넌트인가(내용은 LLM 이 작성 안 함) */
  dataBound?: boolean;
  /** 빌더(프롬프트)용 props 한 줄 설명. 키·형태·제약을 사람이 읽게. */
  propsHint: string;
  /** 노드 props 검증 스키마 */
  propsSchema: z.ZodTypeAny;
}

const metricItem = z
  .object({ value: z.string().min(1), label: z.string().min(1), note: z.string().optional() })
  .strict();
const kvItem = z.object({ k: z.string().min(1), v: z.string().min(1) }).strict();
const cardItem = z
  .object({ title: z.string().min(1), body: z.string().min(1), href: z.string().url().optional() })
  .strict();
const linkItem = z.object({ label: z.string().min(1), href: z.string().url() }).strict();
const cols = z.union([z.literal(2), z.literal(3), z.literal(4)]);

export const COMPOSE_MANIFEST = {
  // ---- 컨테이너 ----
  Section: {
    name: "Section",
    purpose: "한 섹션 묶음. 옵션 헤더(제목·번호·메타) + 내부 children.",
    shape: "세로 섹션 블록(상단 작은 라벨 헤더 + 본문)",
    container: true,
    propsHint: "title?, eyebrow?, num?(번호), meta?(우측 라벨), dataSection?(Ask 스크롤 앵커). children 로 섹션 본문.",
    propsSchema: z
      .object({
        title: z.string().optional(),
        eyebrow: z.string().optional(),
        num: z.union([z.string(), z.number()]).optional(),
        meta: z.string().optional(),
        dataSection: z.string().optional(),
      })
      .strict(),
  },
  Stack: {
    name: "Stack",
    purpose: "children 을 세로로 쌓는 단순 묶음(여백 조절).",
    shape: "수직 스택",
    container: true,
    propsHint: "gap?(\"sm\"|\"md\"|\"lg\"). children 를 세로로.",
    propsSchema: z.object({ gap: z.enum(["sm", "md", "lg"]).optional() }).strict(),
  },
  Split: {
    name: "Split",
    purpose: "children 2개를 좌우 2단으로. 넓은 화면에서만 2단, 좁으면 세로.",
    shape: "2단 레이아웃",
    container: true,
    propsHint: "ratio?(\"1:1\"|\"2:1\"|\"1:2\"). children 2개를 좌우로.",
    propsSchema: z.object({ ratio: z.enum(["1:1", "2:1", "1:2"]).optional() }).strict(),
  },
  Grid: {
    name: "Grid",
    purpose: "children 을 n칼럼 그리드로 배치.",
    shape: "균등 그리드",
    container: true,
    propsHint: "cols?(2|3|4). children 를 그리드로.",
    propsSchema: z.object({ cols: cols.optional() }).strict(),
  },
  // ---- 콘텐츠(LLM 작성) ----
  Heading: {
    name: "Heading",
    purpose: "섹션 안 소제목/강조 제목. 큰 제목은 Section 헤더를 쓰고, 보조 제목에 사용.",
    shape: "굵은 제목 + 옵션 eyebrow/meta",
    container: false,
    propsHint: "text(필수), level?(2|3), eyebrow?, meta?.",
    propsSchema: z
      .object({
        text: z.string().min(1),
        level: z.union([z.literal(2), z.literal(3)]).optional(),
        eyebrow: z.string().optional(),
        meta: z.string().optional(),
      })
      .strict(),
  },
  Prose: {
    name: "Prose",
    purpose: "줄글 문단. 빈 줄(\\n\\n)로 문단 분리, **굵게** 지원. 서술형 카피에 사용.",
    shape: "본문 문단(들)",
    container: false,
    propsHint: "text(필수). 문단은 \\n\\n 으로, **굵게** 지원.",
    propsSchema: z.object({ text: z.string().min(1) }).strict(),
  },
  MetricGrid: {
    name: "MetricGrid",
    purpose: "정량 성과/숫자 카드 그리드(큰 수치 + 라벨). 사업 가치 지표 강조에.",
    shape: "큰 숫자 카드들의 그리드",
    container: false,
    propsHint: "items[{value,label,note?}] 1~8개(필수), cols?(2|3|4).",
    propsSchema: z.object({ items: z.array(metricItem).min(1).max(8), cols: cols.optional() }).strict(),
  },
  Callout: {
    name: "Callout",
    purpose: "강조 박스(짧은 핵심 메시지). 한 곳 포인트로만.",
    shape: "옅은 배경/좌측 악센트의 강조 박스",
    container: false,
    propsHint: "body(필수, **굵게** 지원), eyebrow?, tone?(\"info\"|\"accent\").",
    propsSchema: z
      .object({ eyebrow: z.string().optional(), body: z.string().min(1), tone: z.enum(["info", "accent"]).optional() })
      .strict(),
  },
  Quote: {
    name: "Quote",
    purpose: "인용/한 줄 정의.",
    shape: "좌측 라인 인용구 + 옵션 출처",
    container: false,
    propsHint: "text(필수), cite?(출처).",
    propsSchema: z.object({ text: z.string().min(1), cite: z.string().optional() }).strict(),
  },
  ChipList: {
    name: "ChipList",
    purpose: "태그/스킬/키워드 칩 나열. 스택·역량·도메인에.",
    shape: "둥근 칩들의 인라인 묶음 + 옵션 라벨",
    container: false,
    propsHint: "items[string] 1~40개(필수), label?.",
    propsSchema: z.object({ label: z.string().optional(), items: z.array(z.string().min(1)).min(1).max(40) }).strict(),
  },
  KeyValueList: {
    name: "KeyValueList",
    purpose: "키-값 팩트 목록(연차·거점·학력·언어 등).",
    shape: "라벨 + 값 2열 목록",
    container: false,
    propsHint: "items[{k,v}] 1~12개(필수).",
    propsSchema: z.object({ items: z.array(kvItem).min(1).max(12) }).strict(),
  },
  CardGrid: {
    name: "CardGrid",
    purpose: "제목+설명(+링크) 카드 그리드. 프로젝트/글/방법론 등.",
    shape: "카드들의 그리드(제목·본문·옵션 링크)",
    container: false,
    propsHint: "items[{title,body,href?}] 1~12개(필수), cols?(2|3|4). href 있으면 새 탭 링크.",
    propsSchema: z.object({ items: z.array(cardItem).min(1).max(12), cols: cols.optional() }).strict(),
  },
  LinkList: {
    name: "LinkList",
    purpose: "외부 링크 목록(프로필·작업물).",
    shape: "라벨 링크들의 목록",
    container: false,
    propsHint: "items[{label,href}] 1~20개(필수, href 는 URL).",
    propsSchema: z.object({ items: z.array(linkItem).min(1).max(20) }).strict(),
  },
  Divider: {
    name: "Divider",
    purpose: "얇은 구분선(섹션 사이 호흡).",
    shape: "헤어라인",
    container: false,
    propsHint: "없음(props 비움).",
    propsSchema: z.object({}).strict(),
  },
  // ---- 데이터 바인딩(LLM 은 배치만) ----
  ViewHead: {
    name: "ViewHead",
    purpose: "페르소나 페이지 헤더(GRID 좌표 + 제목 + lede). 모든 관점 페이지 맨 앞에 자동 고정 — 빌더가 직접 넣지 않는다.",
    shape: "상단 좌표 바 + 큰 제목 + 한두 줄 lede",
    container: false,
    dataBound: true,
    propsHint: "persona?(자동 주입). 내용은 site-data.viewHeaders[persona] 에서.",
    propsSchema: z.object({ persona: z.enum(["hire", "collab", "builder", "curious"]).optional() }).strict(),
  },
  CareerTimeline: {
    name: "CareerTimeline",
    purpose: "경력 타임라인. site-data.career 를 persona 큐레이션(tier)으로 펼침/접힘.",
    shape: "기간·조직·역할 + 접이식 불릿의 타임라인",
    container: false,
    dataBound: true,
    propsHint: "persona?(\"hire\"|\"collab\"|\"builder\"|\"curious\"). 내용은 site-data.career 에서 자동.",
    propsSchema: z.object({ persona: z.enum(["hire", "collab", "builder", "curious"]).optional() }).strict(),
  },
  Gantt: {
    name: "Gantt",
    purpose: "인간적 궤적 간트 타임라인. site-data.portfolioCopy.curious.timeline.",
    shape: "연도 축의 가로 간트",
    container: false,
    dataBound: true,
    propsHint: "없음. 내용은 site-data.portfolioCopy.curious.timeline 에서 자동.",
    propsSchema: z.object({}).strict(),
  },
  Facts: {
    name: "Facts",
    purpose: "기본 팩트(연차·거점·학력·언어) 그리드. 어느 페이지에서나 공용.",
    shape: "라벨/값 팩트 카드 묶음",
    container: false,
    dataBound: true,
    propsHint: "없음. 내용은 site-data(연차·identity.location·education·languages)에서 자동.",
    propsSchema: z.object({}).strict(),
  },
  Skills: {
    name: "Skills",
    purpose: "스택·도메인 팩트 + 자격증 그리드. 어느 페이지에서나 공용.",
    shape: "라벨/값 팩트 카드 묶음",
    container: false,
    dataBound: true,
    propsHint: "없음. 내용은 site-data.portfolioCopy.builder.facts + certifications 에서 자동.",
    propsSchema: z.object({}).strict(),
  },
  Writing: {
    name: "Writing",
    purpose: "글쓰기 카드(블로그 + 출판물 + 글). 어느 페이지에서나 공용.",
    shape: "PIECE 번호가 붙은 카드 그리드",
    container: false,
    dataBound: true,
    propsHint: "없음. 내용은 site-data(blog + publications + extraWritings)에서 자동.",
    propsSchema: z.object({}).strict(),
  },
  PillarGrid: {
    name: "PillarGrid",
    purpose: "방법론·개인 노트 등 소스 카드 그리드. source 로 어느 묶음을 그릴지 고른다.",
    shape: "{번호·이름·영문·설명} 카드 그리드",
    container: false,
    dataBound: true,
    propsHint: 'source("collab.methods"|"curious.notes"). 내용은 그 site-data 묶음에서 자동.',
    propsSchema: z
      .object({ source: z.enum(["collab.methods", "curious.notes"]) })
      .strict(),
  },
  Pillars: {
    name: "Pillars",
    purpose: "3대 전략 pillars 그리드. site-data.pillars.",
    shape: "3열 pillar 카드",
    container: false,
    dataBound: true,
    propsHint: "없음. 내용은 site-data.pillars 에서 자동.",
    propsSchema: z.object({}).strict(),
  },
  CoffeeCTA: {
    name: "CoffeeCTA",
    purpose: "커피챗 CTA(Calendly). 페이지 말미 골격.",
    shape: "커피챗 유도 카드 + 캘린더",
    container: false,
    dataBound: true,
    propsHint: "title?, sub?. 캘린더 위젯 포함.",
    propsSchema: z.object({ title: z.string().optional(), sub: z.string().optional() }).strict(),
  },
  ResumeCTA: {
    name: "ResumeCTA",
    purpose: "이력서·포트폴리오 원페이저(/resume) 진입 + PDF 다운로드 CTA. 채용·평가 독자에게 유용.",
    shape: "좌측 안내 + 우측 '한 장으로 보기'/'PDF 다운로드' 버튼 카드",
    container: false,
    dataBound: true,
    propsHint: "title?, sub?. 링크(/resume, /resume/pdf)는 고정.",
    propsSchema: z.object({ title: z.string().optional(), sub: z.string().optional() }).strict(),
  },
  Back: {
    name: "Back",
    purpose: "뒤로가기 바. 페이지 시작 골격.",
    shape: "상단 뒤로가기 + 언어 토글 행",
    container: false,
    dataBound: true,
    propsHint: "없음. 페이지 시작 뒤로가기 골격.",
    propsSchema: z.object({}).strict(),
  },
} satisfies Record<string, ComposeManifestEntry>;

export type ComposeComponentName = keyof typeof COMPOSE_MANIFEST;
export const COMPOSE_COMPONENT_NAMES = Object.keys(COMPOSE_MANIFEST) as ComposeComponentName[];
