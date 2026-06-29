/**
 * 컴포지션 빌더 파일럿 — 네 관점(persona) 페이지의 컴포넌트-트리를 로컬에서 생성한다.
 * ------------------------------------------------------------------
 * 전체 리프레시(콘텐츠/레이아웃/원페이저)는 건드리지 않는다. 각 persona 의 트리만
 * vault 근거로 생성 → 트리 Zod + 노드별 propsSchema 검증 → 골격 강제 → 로컬
 * site-data.json 의 composition.pages 에 주입한다(dev 에서 바로 확인).
 *
 * 실행:
 *   node --env-file=.env.local --import tsx scripts/pilot-composition.ts            # 네 관점 전부
 *   node --env-file=.env.local --import tsx scripts/pilot-composition.ts hire collab # 일부만
 */

import { readFile, writeFile } from "node:fs/promises";
import { generateText, jsonSchema, tool } from "ai";
import {
  pageCompositionSchema,
  siteCompositionSchema,
  type ComposeNode,
  type PageComposition,
} from "../src/content/compose/schema";
import { COMPOSE_MANIFEST } from "../src/content/compose/manifest";
import { renderComposeCatalog } from "../src/content/compose/catalog";
import { SITE_STRUCTURE } from "../src/content/site-structure";
import { gatewayModel } from "../src/lib/llm";

const MODEL =
  process.env.AI_GATEWAY_MODEL ?? process.env.ANTHROPIC_MODEL ?? "anthropic/claude-opus-4.7";
const SITE_DATA_PATH = "hsol-info-blob/vault/object-views/site-data.json";
const VAULT = "hsol-info-blob/vault";
const CONTEXT_FILES = [
  `${VAULT}/object-views/포트폴리오-요약.md`,
  `${VAULT}/object-views/타임라인.md`,
  `${VAULT}/objects/people/임한솔.md`,
  `${VAULT}/object-views/작문-가이드.md`,
];
const TOOL = "emit_composition";
const PERSONAS = ["hire", "collab", "builder", "curious"] as const;
type Persona = (typeof PERSONAS)[number];

const DATABOUND_HINT: Record<Persona, string> = {
  hire: "Facts(기본 팩트), Pillars(강점), CareerTimeline(persona:hire), Skills 등이 잘 맞는다.",
  collab: "PillarGrid(source:collab.methods, 일하는 방식), CareerTimeline(persona:collab), Pillars 등이 잘 맞는다.",
  builder: "Skills(스택·도메인), CareerTimeline(persona:builder), Writing(글) 등이 잘 맞는다.",
  curious: "Gantt(인간적 궤적), PillarGrid(source:curious.notes) 등이 잘 맞는다. 따뜻하고 담백하게.",
};

async function loadContext(): Promise<string> {
  const parts: string[] = [];
  for (const f of CONTEXT_FILES) {
    try {
      parts.push(`### ${f}\n${(await readFile(f, "utf8")).slice(0, 9000)}`);
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

/** persona 골격: [Back → ViewHead(persona) → ...본문... → CoffeeCTA]. 골격 컴포넌트는 중첩 포함 전부 떼어 재배치. */
function enforceSkeleton(persona: Persona, comp: PageComposition): PageComposition {
  let coffee: ComposeNode | undefined;
  const strip = (list: ComposeNode[]): ComposeNode[] => {
    const out: ComposeNode[] = [];
    for (const n of list) {
      if (n.component === "CoffeeCTA") {
        if (!coffee) coffee = n;
        continue;
      }
      if (n.component === "Back" || n.component === "ViewHead") continue;
      out.push(n.children ? { ...n, children: strip(n.children) } : n);
    }
    return out;
  };
  const body = strip(comp.nodes);
  return { nodes: [{ component: "Back" }, { component: "ViewHead", props: { persona } }, ...body, coffee ?? { component: "CoffeeCTA" }] };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** composition 결과를 강제 tool_use 로 반환하는 툴(실행 없음 — 구조화 출력 용도). */
const compositionTool = tool({
  description: "디자인시스템 컴포넌트 트리(composition)와 changes 를 반환한다. 일반 텍스트 금지.",
  inputSchema: jsonSchema<{ composition?: unknown; changes?: unknown }>({
    type: "object",
    additionalProperties: true,
    properties: { composition: { type: "object" }, changes: { type: "array", items: { type: "string" } } },
    required: ["composition"],
  }),
});

/** AI Gateway 호출(강제 tool_use) + 일시적 오류(네트워크/429/5xx) 지수 백오프 재시도. */
async function callComposition(
  prompt: string,
  maxRetries = 4,
): Promise<{ composition?: unknown; changes?: unknown } | undefined> {
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const result = await generateText({
        model: gatewayModel(MODEL),
        maxOutputTokens: 16000,
        messages: [{ role: "user", content: prompt }],
        tools: { [TOOL]: compositionTool },
        toolChoice: { type: "tool", toolName: TOOL },
      });
      const call = result.toolCalls.find((c) => c.toolName === TOOL);
      return call?.input as { composition?: unknown; changes?: unknown } | undefined;
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      if (attempt === maxRetries) throw lastErr;
    }
    const delay = Math.min(2000 * 2 ** attempt, 30000);
    console.log(`    (재시도 ${attempt + 1}/${maxRetries}: ${lastErr.message.slice(0, 80)} — ${delay}ms 후)`);
    await sleep(delay);
  }
  throw lastErr ?? new Error("composition request failed");
}

/** 트리의 모든 노드 컴포넌트 이름(중첩 포함). */
function allComponents(nodes: ComposeNode[]): string[] {
  const out: string[] = [];
  const rec = (list: ComposeNode[]) => {
    for (const n of list) {
      out.push(n.component);
      if (n.children) rec(n.children);
    }
  };
  rec(nodes);
  return [...new Set(out)];
}

/** 형제 관점들의 현재 구성 요약(헤더 + 컴포넌트 팔레트). 빌더가 "서로의 존재를 알고" 맞추게 한다. */
function siblingDigest(pages: Record<string, PageComposition>, exclude: Persona): string {
  const others = PERSONAS.filter((p) => p !== exclude && pages[p]?.nodes?.length);
  if (!others.length) {
    return "(아직 형제 관점이 없다 — 네가 첫 번째다. 뒤따를 형제들이 맞출 수 있게 명확하고 일관된 헤더 표준을 세워라.)";
  }
  return others
    .map((p) => {
      const comp = pages[p];
      const heads = comp.nodes
        .filter((n) => n.component === "Section")
        .map((n) => {
          const x = (n.props ?? {}) as { num?: unknown; title?: unknown; eyebrow?: unknown; meta?: unknown };
          const label = x.title ?? x.eyebrow ?? "";
          return `§${x.num ?? "-"} ${label}${x.meta ? ` (${x.meta})` : ""}`;
        });
      return `[${p}]\n    섹션 헤더: ${heads.join(" / ") || "(없음)"}\n    쓴 컴포넌트: ${allComponents(comp.nodes).join(", ")}`;
    })
    .join("\n");
}

function buildPrompt(
  persona: Persona,
  args: { catalog: string; anchor: string; personaData: string; sharedData: string; context: string; siblings: string },
): string {
  const role = SITE_STRUCTURE[persona]?.role ?? `'${persona}' 페이지`;
  return `너는 hsol.info 포트폴리오의 **컴포지션 빌더**다. '${persona}' 페이지를 디자인시스템 컴포넌트의 **트리**로 조합하고, content 컴포넌트의 내용을 **vault 근거로 직접 작성**한다.

페이지 성격: ${role}
이 관점에 잘 맞는 data-bound: ${DATABOUND_HINT[persona]}

원칙:
1) 앵커 후 진화: "현재 composition"이 있으면 통째로 갈아엎지 말고 1~3가지 개선만. 없으면 페이지 성격에 맞게 새로 구성.
2) 카탈로그 안 component 만. container 만 children 을 가진다. data-bound(Facts/Skills/Writing/Pillars/PillarGrid/CareerTimeline/Gantt/CoffeeCTA/Back/ViewHead)는 배치만 — 내용은 site-data 에서 자동, props 로 내용 지어내지 마라. data-bound 가 자동으로 보여주는 항목(특히 Writing 은 블로그·출판물·뉴스레터를 다 보여줌)을 Callout/CardGrid/Prose 로 또 만들지 마라 — 중복된다.
3) vault 그라운딩(필수): content 컴포넌트(Prose/Callout/CardGrid/MetricGrid/ChipList/Quote/KeyValueList/LinkList/Heading)의 내용은 아래 [참조 vault]·[관점 데이터]에 실제로 있는 사실로만. 문서 밖 추측·새 수치·과장 금지. 애매하면 항목 수를 줄여라. **"블로그" = 현행 Medium(medium.com/@hsol)**; 한솔닷컴(Tistory)은 deprecated 아카이브로만 표기하고 Medium 을 빠뜨리지 마라.
4) 고정 골격(시스템이 자동 배치 — 다시 만들지 마라): 네 본문 말고도 다음이 이미 고정으로 들어간다. 인지하고 중복하지 마라.
   - 맨 위 Back 바(뒤로가기 + 언어 토글).
   - 그다음 ViewHead: GRID 좌표 + 페이지 큰 제목 + lede 소개(viewHeaders[persona]에서 자동). → 본문 첫 섹션에서 같은 제목·자기소개를 되풀이하지 마라.
   - 맨 끝 CoffeeCTA: 'Coffee chat — 30 min' 커피챗 예약 카드(Calendly). 연락·마무리 CTA가 이미 끝에 있다. → '연락 / Contact / 커피챗 / 대화 나눠요' 같은 마무리·연락 섹션을 따로 만들지 마라(중복).
   너는 ViewHead 와 CoffeeCTA 사이의 본문만 짠다.
5) 문체(한국어): 줄글은 존댓말(~합니다/~입니다). 첫 문장을 "저는/임한솔은" 같은 1인칭·이름 고정으로 시작하지 마라. 엠대시(—)·말줄임표(…)·곡선따옴표 금지 — 하이픈·마침표·곧은따옴표만.
6) **형제 관점과 협업(매우 중요)**: 너는 혼자가 아니다. 아래 [형제 관점들의 현재 구성]에 다른 관점 페이지들이 어떻게 만들어졌는지 있다. **한 사람이 만든 한 사이트**처럼 보이도록 형제들과 맞춰라 — 섹션 헤더의 워딩·형식(예: 한국어 제목인지 영문인지, 번호 붙이는지, 영문 kicker 다는지), 컴포넌트 쓰는 습관, 톤. 한쪽은 영문 제목·다른 쪽은 한글 제목처럼 따로 노는 건 금지. 단 베끼지는 말고, 내용·강조·순서는 ${persona} 관점에 맞게 다르게. (형제가 아직 없으면 네가 기준이 된다 — 명확하고 일관된 헤더로 첫 표준을 세워라.)
7) 기술/스택은 '범위 신호'로만(헤드라인 금지): 기술 나열이 'X·Y·Z 밖에 못 하는 사람'으로 축소시키면 안 된다(12년차 엔지니어->대표·팀장 포지셔닝과 충돌).
   - 회사별·시기별로 기술을 쪼개 나열 금지(예: "토스: Django, Flask" 식) — 한정돼 보인다.
   - 스택은 통합해 한 번만(언어 + 핵심 프레임워크), 그것도 builder 관점에서만 구체적으로(Skills). hire 는 가볍게, collab·curious 는 기술 나열 섹션을 두지 말고 역량·도메인·만든 것으로 대체.
   - 헤드라인은 '무엇을 끝까지 책임질 수 있는가'(역량·도메인·임팩트). 기술은 그 보조.
8) 이력서 진입점(ResumeCTA): 이력서·포트폴리오 원페이저(/resume)로 보내는 ResumeCTA 컴포넌트가 있다. hire(채용) 관점에는 반드시 포함해 PDF 이력서 진입점을 제공하라. 나머지는 선택.
   - Divider 는 한 섹션 안(children)에서 묶음을 나눌 때만 쓴다. 섹션과 섹션 사이(최상위)에 Divider 를 넣지 마라 — 섹션은 이미 충분히 떨어진다(중복·노이즈).
9) 관점마다 본문 구성·강조를 다르게: 같은 데이터라도 ${persona} 독자의 관심사에 맞춰 순서·선택·카피를 달리한다.
10) 레퍼런스는 링크로(중요): 본문이 가리키는 대상에 [참조 vault]·data-bound 데이터에 정식 URL 이 있으면 평문으로 두지 말고 클릭 가능한 링크로 건다. 링크 수단은 LinkList(items[{label,href}])·CardGrid(items[{title,body,href}]) 의 href, 글·출판물은 data-bound Writing(자동 링크). Prose 는 링크를 담지 못하니 Prose 안에 URL 을 글자로 적지 말고 위 컴포넌트로 올려라. URL 은 실제 있는 것만, 지어내지 마라. 출처·조회 과정을 숨기라는 규칙은 공개 가능한 정식 링크(글·뉴스레터·출판물·외부 사이트)까지 막는 게 아니다 — 그런 링크는 적극적으로 건다.

반드시 ${TOOL} tool_use 로만 반환:
- composition: { "nodes": [ ...노드 ] }
- changes: 무엇을·왜 그렇게 구성했는지 1~3개 한국어 한 줄.

${args.catalog}

[형제 관점들의 현재 구성 — 한 사이트의 다른 방들. 한 사람이 만든 것처럼 형식·워딩·톤을 맞춰라]
${args.siblings}

[현재 composition — 앵커]
${args.anchor}

[관점 데이터(viewHeaders + portfolioCopy.${persona})]
${args.personaData}

[공용 구조 데이터(data-bound 컴포넌트가 보여줄 내용 요약)]
${args.sharedData}

[참조 vault]
${args.context}`;
}

interface SiteShape {
  composition?: { pages?: Record<string, PageComposition> };
  viewHeaders?: Record<string, unknown>;
  portfolioCopy?: Record<string, unknown>;
  career?: { org: string; role: string; period: string }[];
  pillars?: { labelKo: string }[];
  education?: unknown;
  languages?: unknown;
  certifications?: unknown;
  publications?: { title: string }[];
  [k: string]: unknown;
}

async function generateForPersona(
  persona: Persona,
  site: SiteShape,
  context: string,
  pages: Record<string, PageComposition>,
): Promise<{ composition: PageComposition; changes: string[] } | null> {
  const catalog = renderComposeCatalog();
  const current = pages[persona] ?? site.composition?.pages?.[persona];
  const anchor = current ? JSON.stringify(current, null, 2) : "(아직 없음 — 처음 만든다)";
  const siblings = siblingDigest(pages, persona);
  const personaData = JSON.stringify(
    { viewHeader: site.viewHeaders?.[persona], copy: site.portfolioCopy?.[persona] },
    null,
    1,
  );
  const sharedData = JSON.stringify(
    {
      career: (site.career ?? []).map((c) => ({ org: c.org, role: c.role, period: c.period })),
      pillars: (site.pillars ?? []).map((p) => p.labelKo),
      education: site.education,
      languages: site.languages,
      certifications: site.certifications,
      publications: (site.publications ?? []).map((p) => p.title),
    },
    null,
    1,
  );
  const prompt = buildPrompt(persona, { catalog, anchor, personaData, sharedData, context, siblings });

  let hint = "";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const toolInput = await callComposition(
      hint ? `${prompt}\n\n이전 시도 오류:\n${hint}\n고쳐서 다시 생성하라.` : prompt,
    );
    const parsed = pageCompositionSchema.safeParse(toolInput?.composition);
    if (!parsed.success) {
      hint = parsed.error.issues.slice(0, 10).map((s) => `${s.path.join(".") || "<root>"}: ${s.message}`).join("\n");
      console.log(`    [${persona} attempt ${attempt}] 트리 형태 실패: ${hint}`);
      continue;
    }
    const nodeErrors = validateNodes(parsed.data.nodes);
    if (nodeErrors.length) {
      hint = nodeErrors.slice(0, 12).join("\n");
      console.log(`    [${persona} attempt ${attempt}] 노드 검증 실패:\n${hint}`);
      continue;
    }
    const changes = (Array.isArray(toolInput?.changes) ? (toolInput?.changes as unknown[]) : []).map((c) => String(c).trim()).filter(Boolean);
    return { composition: parsed.data, changes };
  }
  return null;
}

async function main() {
  if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) {
    throw new Error(
      "Missing AI Gateway 인증 — AI_GATEWAY_API_KEY 또는 VERCEL_OIDC_TOKEN 필요 (run with --env-file=.env.local; OIDC는 `vercel env pull` 로 갱신)",
    );
  }

  const argv = process.argv.slice(2).filter((a) => (PERSONAS as readonly string[]).includes(a)) as Persona[];
  const targets = argv.length ? argv : [...PERSONAS];

  const site = JSON.parse(await readFile(SITE_DATA_PATH, "utf8")) as SiteShape;
  const context = await loadContext();
  const pages: Record<string, PageComposition> = { ...(site.composition?.pages ?? {}) };
  const done: string[] = [];

  /** 한 persona 성공할 때마다 즉시 저장 — 중간 네트워크 오류에도 진행분이 남게. */
  async function save() {
    const verified = siteCompositionSchema.safeParse({ pages });
    if (!verified.success) {
      console.error("❌ composition 스키마 재검증 실패:", verified.error.issues.slice(0, 5));
      return;
    }
    site.composition = verified.data;
    await writeFile(SITE_DATA_PATH, `${JSON.stringify(site, null, 2)}\n`, "utf8");
  }

  for (const persona of targets) {
    console.log(`[pilot] ${persona} composition 생성 중 (model=${MODEL})...`);
    try {
      const result = await generateForPersona(persona, site, context, pages);
      if (!result) {
        console.error(`  ✗ ${persona}: 3회 검증 실패 — 건너뜀(기존/blocks 폴백)`);
        continue;
      }
      pages[persona] = enforceSkeleton(persona, result.composition);
      await save(); // 즉시 저장
      done.push(persona);
      console.log(`  ✓ ${persona}: 노드 ${pages[persona].nodes.length}개 (저장됨)`);
      for (const c of result.changes) console.log(`      - ${c}`);
    } catch (err) {
      console.error(`  ✗ ${persona}: 오류로 건너뜀 — ${err instanceof Error ? err.message.slice(0, 120) : String(err)}`);
    }
  }

  console.log(`\n✅ 갱신된 composition.pages: ${done.length ? done.join(", ") : "(없음)"} / 전체 보유: ${Object.keys(pages).join(", ")}`);
  console.log("   dev(localhost:9999)에서 /hire /collab /builder /curious 확인.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
