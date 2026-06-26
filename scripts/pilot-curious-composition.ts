/**
 * 컴포지션 빌더 파일럿 — curious 페이지 1개만 로컬에서 생성한다.
 * ------------------------------------------------------------------
 * 전체 리프레시(콘텐츠/레이아웃/원페이저)는 건드리지 않는다. curious 의 컴포넌트-트리만
 * vault 근거로 생성 → 트리 Zod + 노드별 propsSchema 검증 → 골격 강제 → 로컬
 * site-data.json 의 composition.pages.curious 에 주입한다(dev 에서 바로 확인 가능).
 *
 * 실행: node --env-file=.env.local --import tsx scripts/pilot-curious-composition.ts
 */

import { readFile, writeFile } from "node:fs/promises";
import {
  pageCompositionSchema,
  siteCompositionSchema,
  type ComposeNode,
  type PageComposition,
} from "../src/content/compose/schema";
import { COMPOSE_MANIFEST } from "../src/content/compose/manifest";
import { renderComposeCatalog } from "../src/content/compose/catalog";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
const SITE_DATA_PATH = "hsol-info-blob/vault/object-views/site-data.json";
const VAULT = "hsol-info-blob/vault";
const CONTEXT_FILES = [
  `${VAULT}/object-views/포트폴리오-요약.md`,
  `${VAULT}/object-views/타임라인.md`,
  `${VAULT}/objects/people/임한솔.md`,
  `${VAULT}/object-views/작문-가이드.md`,
];
const TOOL = "emit_composition";

async function loadContext(): Promise<string> {
  const parts: string[] = [];
  for (const f of CONTEXT_FILES) {
    try {
      const raw = await readFile(f, "utf8");
      parts.push(`### ${f}\n${raw.slice(0, 9000)}`);
    } catch {
      /* 없으면 건너뜀 */
    }
  }
  return parts.join("\n\n");
}

function validateNodes(nodes: ComposeNode[], prefix = ""): string[] {
  const errors: string[] = [];
  nodes.forEach((node, i) => {
    const at = `${prefix}[${i}]${node?.component ? `(${node.component})` : ""}`;
    const entry = COMPOSE_MANIFEST[node.component as keyof typeof COMPOSE_MANIFEST];
    if (!entry) {
      errors.push(`${at}: 미등록 component '${node.component}'`);
      return;
    }
    const parsed = entry.propsSchema.safeParse(node.props ?? {});
    if (!parsed.success) {
      errors.push(`${at}: props — ${parsed.error.issues.map((s) => `${s.path.join(".") || "<root>"} ${s.message}`).join("; ")}`);
    }
    if (node.children?.length) {
      if (!entry.container) errors.push(`${at}: container 아님 — children 불가`);
      else errors.push(...validateNodes(node.children, `${at}.children`));
    }
  });
  return errors;
}

function enforceSkeleton(comp: PageComposition): PageComposition {
  // persona 페이지 골격: [Back → ViewHead(curious) → ...본문... → CoffeeCTA]
  const SK = new Set(["Back", "ViewHead", "CoffeeCTA"]);
  const coffee = comp.nodes.find((n) => n.component === "CoffeeCTA") ?? { component: "CoffeeCTA" };
  const body = comp.nodes.filter((n) => !SK.has(n.component));
  return {
    nodes: [
      { component: "Back" },
      { component: "ViewHead", props: { persona: "curious" } },
      ...body,
      coffee,
    ],
  };
}

async function callAnthropic(apiKey: string, prompt: string) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 16000,
      messages: [{ role: "user", content: prompt }],
      tools: [
        {
          name: TOOL,
          description: "디자인시스템 컴포넌트 트리(composition)와 changes 를 반환한다. 일반 텍스트 금지.",
          input_schema: {
            type: "object",
            additionalProperties: true,
            properties: { composition: { type: "object" }, changes: { type: "array", items: { type: "string" } } },
            required: ["composition"],
          },
        },
      ],
      tool_choice: { type: "tool", name: TOOL },
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  return (await res.json()) as { content?: Array<{ type?: string; name?: string; input?: unknown }> };
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY (run with --env-file=.env.local)");

  const siteRaw = await readFile(SITE_DATA_PATH, "utf8");
  const site = JSON.parse(siteRaw) as Record<string, unknown> & {
    composition?: { pages?: Record<string, PageComposition> };
    portfolioCopy: { curious: { timeline: unknown[]; notes: unknown[]; timelineIntro: string } };
  };

  const current = site.composition?.pages?.curious;
  const anchor = current ? JSON.stringify(current, null, 2) : "(아직 없음 — 처음 만든다)";
  const context = await loadContext();
  const curiousData = JSON.stringify(site.portfolioCopy.curious, null, 2);
  const catalog = renderComposeCatalog();

  const prompt = `너는 hsol.info 포트폴리오의 **컴포지션 빌더**다. 'curious' 페이지를 디자인시스템 컴포넌트의 **트리**로 조합하고, content 컴포넌트의 내용을 **vault 근거로 직접 작성**한다.

페이지 성격: 그냥 궁금한 사람 관점. 인간적 궤적(Gantt)·개인적인 노트 중심, 따뜻하고 담백하게. 채용/세일즈 톤이 아니라 한 사람을 알아가는 느낌.

원칙:
1) 앵커 후 진화: "현재 composition"이 있으면 통째로 갈아엎지 말고 1~3가지 개선만. 없으면 페이지 성격에 맞게 새로 구성.
2) 카탈로그 안 component 만. container 만 children 을 가진다. data-bound(Gantt/Pillars/CareerTimeline/CoffeeCTA/Back)는 배치만 — 내용은 site-data 에서 자동, props 로 내용 지어내지 마라.
3) vault 그라운딩(필수): content 컴포넌트(Prose/Callout/CardGrid/ChipList/Quote/KeyValueList/Heading)의 내용은 아래 [참조 vault]·[curious 데이터]에 실제로 있는 사실로만. 문서 밖 추측·새 수치·과장 금지. 애매하면 항목 수를 줄여라. **"블로그" = 현행 Medium(medium.com/@hsol)**; 한솔닷컴(Tistory)은 deprecated 아카이브로만 표기하고 Medium 을 빠뜨리지 마라.
4) 골격: 맨 앞 Back, 그다음 ViewHead(페르소나 헤더), 맨 끝 CoffeeCTA 는 시스템이 자동으로 박는다 — 직접 넣지 마라. 너는 그 사이 본문만 짠다. curious 의 핵심인 Gantt(인간적 궤적)는 반드시 본문에 포함.
5) 문체(한국어): 줄글은 존댓말(~합니다/~입니다). 첫 문장을 "저는/임한솔은" 같은 1인칭·이름 고정으로 시작하지 마라. 엠대시(—)·말줄임표(…)·곡선따옴표 금지 — 하이픈·마침표·곧은따옴표만.

반드시 ${TOOL} tool_use 로만 반환:
- composition: { "nodes": [ ...노드 ] }
- changes: 무엇을·왜 그렇게 구성했는지 1~3개 한국어 한 줄.

${catalog}

[현재 composition — 앵커]
${anchor}

[curious 데이터(site-data, data-bound 컴포넌트가 실제로 보여줄 내용)]
${curiousData}

[참조 vault]
${context}`;

  console.log(`[pilot] curious composition 생성 중 (model=${MODEL})...`);
  let result: { composition: PageComposition; changes: string[] } | null = null;
  let hint = "";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const data = await callAnthropic(apiKey, hint ? `${prompt}\n\n이전 시도 오류:\n${hint}\n고쳐서 다시 생성하라.` : prompt);
    const tool = data.content?.find((b) => b.type === "tool_use" && b.name === TOOL)?.input as
      | { composition?: unknown; changes?: unknown }
      | undefined;
    const parsed = pageCompositionSchema.safeParse(tool?.composition);
    if (!parsed.success) {
      hint = parsed.error.issues.slice(0, 10).map((s) => `${s.path.join(".") || "<root>"}: ${s.message}`).join("\n");
      console.log(`  [attempt ${attempt}] 트리 형태 실패: ${hint}`);
      continue;
    }
    const nodeErrors = validateNodes(parsed.data.nodes);
    if (nodeErrors.length) {
      hint = nodeErrors.slice(0, 12).join("\n");
      console.log(`  [attempt ${attempt}] 노드 검증 실패:\n${hint}`);
      continue;
    }
    const changes = (Array.isArray(tool?.changes) ? (tool?.changes as unknown[]) : []).map((c) => String(c).trim()).filter(Boolean);
    result = { composition: parsed.data, changes };
    console.log(`  [attempt ${attempt}] OK`);
    break;
  }

  if (!result) {
    console.error("\n❌ 3회 시도 후에도 유효한 composition 을 얻지 못했습니다.");
    process.exit(1);
  }

  const finalComp = enforceSkeleton(result.composition);

  // 로컬 site-data.json 에 주입(전체 컴포지션 스키마로 재검증).
  const nextComposition = { pages: { ...(site.composition?.pages ?? {}), curious: finalComp } };
  const verified = siteCompositionSchema.safeParse(nextComposition);
  if (!verified.success) {
    console.error("❌ composition 스키마 재검증 실패:", verified.error.issues.slice(0, 5));
    process.exit(1);
  }
  site.composition = verified.data;
  await writeFile(SITE_DATA_PATH, `${JSON.stringify(site, null, 2)}\n`, "utf8");

  console.log("\n===== 빌더 changes =====");
  for (const c of result.changes) console.log(`  - ${c}`);
  console.log("\n===== 생성된 curious 트리 =====");
  console.log(JSON.stringify(finalComp, null, 2));
  console.log(`\n✅ 로컬 ${SITE_DATA_PATH} 의 composition.pages.curious 에 주입 완료.`);
  console.log("   dev 서버(localhost:9999)에서 /curious 로 확인하세요. (Blob 토큰이 있으면 BLOB 우선 — 아래 안내 참고)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
