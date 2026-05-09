import { NextResponse } from "next/server";
import { list } from "@vercel/blob";
import { getSiteData } from "@/lib/content/site-data";
import type { SiteData } from "@/content/schema";
import {
  ASK_HANSOL_FALLBACK_MESSAGE,
  isValidAskHansolSessionId,
} from "@/lib/ask-hansol/shared";
import {
  insertAskHansolMessage,
  isAskHansolDbConfigured,
  listAskHansolMessages,
} from "@/lib/db/ask-hansol-messages";
import {
  getSessionMemoryRow,
  listTailMessagesForPrompt,
  rawHistoryMessageTailLimit,
  refreshSessionMemoryRollup,
} from "@/lib/db/ask-hansol-memory";

/** `output: "export"` 빌드 요구사항 — 런타임(Vercel Function)에서는 여전히 동적 처리됨 */
export const dynamic = "force-static";

function normalize(text: string): string {
  return text.toLowerCase().replace(/[?!.\s]/g, "");
}

function keywordTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[?!.,]/g, " ")
    .split(/\s+/)
    .map((token) =>
      token.replace(/(은|는|이|가|을|를|요|나요|까요|인가요|입니다|있나요|하나요)$/g, ""),
    )
    .filter((token) => token.length >= 2);
}

type BlobEntry = { pathname: string; url: string };
type FaqEntry = SiteData["faq"][number];
type AskHansolPageView = "home" | "hire" | "collab" | "builder" | "curious";
type AskHansolPageContext = {
  view: AskHansolPageView;
  section?: string;
  hash?: string;
  detail?: string;
};
type RetrievalSkill = {
  id: string;
  keywords: string[];
  blobPaths: string[];
};

const BASE_CONTEXT_PATHS = [
  "vault/README.md",
  "vault/object-views/AI-클론-운영-매뉴얼.md",
];

const BLOB_CONTEXT_MAX_CHARS = Number(
  process.env.ASK_HANSOL_BLOB_CONTEXT_MAX_CHARS ?? 12_000,
);

const RETRIEVAL_SKILLS: RetrievalSkill[] = [
  {
    id: "persona-core",
    keywords: ["페르소나", "성격", "정체성", "톤", "말투", "persona"],
    blobPaths: [
      "vault/objects/concepts/임한솔-persona.md",
    ],
  },
  {
    id: "profile-career",
    keywords: ["경력", "커리어", "이력", "경험", "요약", "career"],
    blobPaths: [
      "vault/objects/people/임한솔.md",
    ],
  },
  {
    id: "writing-content",
    keywords: ["블로그", "글", "아카이브", "콘텐츠", "작문", "writing"],
    blobPaths: [
      "vault/objects/concepts/임한솔-writing-style.md",
    ],
  },
];

function findFaqAnswer(query: string, faq: FaqEntry[]): string | null {
  const needle = normalize(query);
  const needleTokens = keywordTokens(query);
  const matched = faq.find((item) => {
    const candidate = normalize(item.q);
    if (
      candidate === needle ||
      candidate.includes(needle) ||
      needle.includes(candidate)
    ) {
      return true;
    }

    if (needleTokens.length === 0) return false;
    const candidateTokens = keywordTokens(item.q);
    if (candidateTokens.length === 0) return false;
    const overlap = needleTokens.filter((token) => candidateTokens.includes(token)).length;
    return overlap / needleTokens.length >= 0.6;
  });
  return matched?.a ?? null;
}

async function listAllBlobs(prefix: string, token: string): Promise<BlobEntry[]> {
  const page = await list({ prefix, token, limit: 20 });
  return page.blobs.map((blob) => ({
    pathname: blob.pathname,
    url: blob.url,
  }));
}

async function resolveBlobEntryForRelativePath(
  relativePath: string,
  token: string,
  basePrefix: string,
): Promise<BlobEntry | null> {
  const pathCandidates = [
    `${basePrefix}/${relativePath}`.replace(/\/+/g, "/"),
    relativePath.replace(/^\/+/g, ""),
  ];
  for (const fullPath of pathCandidates) {
    const candidates = await listAllBlobs(fullPath, token).catch(() => []);
    const exact = candidates.find((blob) => blob.pathname === fullPath);
    const picked = exact ?? candidates[0];
    if (picked) return picked;
  }
  return null;
}

function sortVaultReadmeFirst(entries: BlobEntry[]): BlobEntry[] {
  const isVaultReadme = (pathname: string) => /(^|\/)vault\/README\.md$/i.test(pathname);
  return [...entries].sort((a, b) => {
    const ar = isVaultReadme(a.pathname) ? 0 : 1;
    const br = isVaultReadme(b.pathname) ? 0 : 1;
    if (ar !== br) return ar - br;
    return a.pathname.localeCompare(b.pathname);
  });
}

/** Blob의 vault/README.md — vault를 찾고 읽는 절차·규칙용. 사실 근거 문서가 아님. */
async function fetchVaultReadmeGuideBody(): Promise<string | null> {
  const token = getBlobToken();
  if (!token) return null;
  const basePrefix = (process.env.BLOB_PREFIX || "info").replace(/^\/+|\/+$/g, "");
  const entry = await resolveBlobEntryForRelativePath("vault/README.md", token, basePrefix);
  if (!entry) return null;
  const text = await fetchBlobText(entry.url, token);
  if (!text) return null;
  const limit = Number.isFinite(BLOB_CONTEXT_MAX_CHARS) && BLOB_CONTEXT_MAX_CHARS > 0
    ? BLOB_CONTEXT_MAX_CHARS
    : 12_000;
  return text.slice(0, limit);
}

async function fetchBlobText(url: string, token: string): Promise<string | null> {
  const attempt = async (withAuth: boolean) => {
    const response = await fetch(url, {
      headers: withAuth ? { Authorization: `Bearer ${token}` } : undefined,
      cache: "no-store",
    });
    if (!response.ok) return null;
    return response.text();
  };

  try {
    const text = await attempt(true);
    if (text) return text;
  } catch {}

  try {
    return await attempt(false);
  } catch {
    return null;
  }
}

function pickRetrievalSkills(query: string): RetrievalSkill[] {
  const tokens = keywordTokens(query);
  const matched = RETRIEVAL_SKILLS.filter((skill) => {
    const skillTokenSet = skill.keywords.flatMap((k) => keywordTokens(k));
    if (skillTokenSet.length === 0 || tokens.length === 0) return false;
    const overlap = tokens.filter((token) => skillTokenSet.includes(token)).length;
    return overlap >= 1;
  });

  if (matched.length > 0) return matched.slice(0, 2);
  // 기본 스킬: 일반 질문에도 핵심 프로필은 항상 참조 가능
  return RETRIEVAL_SKILLS.filter((s) => s.id === "profile-career");
}

async function resolveSkillBlobs(
  skills: RetrievalSkill[],
  token: string,
  basePrefix: string,
): Promise<BlobEntry[]> {
  const dedup = new Map<string, BlobEntry>();
  const enqueuePath = async (relativePath: string) => {
    const pathCandidates = [
      `${basePrefix}/${relativePath}`.replace(/\/+/g, "/"),
      relativePath.replace(/^\/+/g, ""),
    ];

    for (const fullPath of pathCandidates) {
      const candidates = await listAllBlobs(fullPath, token).catch(() => []);
      const exact = candidates.find((blob) => blob.pathname === fullPath);
      const picked = exact ?? candidates[0];
      if (picked) {
        dedup.set(picked.pathname, picked);
        return;
      }
    }
  };

  // Always include base context for every Ask Hansol request.
  for (const basePath of BASE_CONTEXT_PATHS) {
    await enqueuePath(basePath);
  }

  for (const skill of skills) {
    for (const relativePath of skill.blobPaths) {
      await enqueuePath(relativePath);
    }
  }

  return [...dedup.values()].slice(0, 4);
}

function getBlobToken(): string | null {
  return (
    process.env.ASK_HANSOL_BLOB_TOKEN ??
    process.env.BLOB_READ_WRITE_TOKEN ??
    process.env.BLOB_READ_TOKEN ??
    null
  );
}

async function fetchBlobContext(query: string): Promise<string> {
  const token = getBlobToken();
  if (!token) return "";

  const basePrefix = (process.env.BLOB_PREFIX || "info").replace(/^\/+|\/+$/g, "");
  const skills = pickRetrievalSkills(query);
  const selected = sortVaultReadmeFirst(await resolveSkillBlobs(skills, token, basePrefix));
  if (selected.length === 0) return "";

  const chunks = await Promise.all(
    selected.map(async (blob) => {
      const text = await fetchBlobText(blob.url, token);
      if (!text) return null;
      const limit = Number.isFinite(BLOB_CONTEXT_MAX_CHARS) && BLOB_CONTEXT_MAX_CHARS > 0
        ? BLOB_CONTEXT_MAX_CHARS
        : 12_000;
      const isVaultReadme = /(^|\/)vault\/README\.md$/i.test(blob.pathname);
      const header = isVaultReadme
        ? `### ${blob.pathname} (vault 읽기 지침 — 사실·인물·경력 근거로 쓰지 말 것)`
        : `### ${blob.pathname}`;
      return `${header}\n${text.slice(0, limit)}`;
    }),
  );

  return chunks.filter(Boolean).join("\n\n");
}

async function runBlobLookupTool(input: unknown): Promise<string> {
  const query =
    typeof input === "object" && input !== null && "query" in input
      ? String((input as { query?: unknown }).query ?? "").trim()
      : "";
  if (!query) return "Blob 조회 실패: query가 비어 있습니다.";

  const context = await fetchBlobContext(query);
  if (!context) return "Blob 조회 결과가 없습니다. 운영 매뉴얼 또는 관련 문서를 찾지 못했습니다.";
  return context;
}

function mergeAdjacentSameRole(
  turns: Array<{ role: "user" | "assistant"; content: string }>,
): Array<{ role: "user" | "assistant"; content: string }> {
  const out: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const t of turns) {
    const c = t.content.trim();
    if (!c) continue;
    const last = out[out.length - 1];
    if (last && last.role === t.role) {
      last.content = `${last.content}\n\n${c}`;
    } else {
      out.push({ role: t.role, content: c });
    }
  }
  return out;
}

/** DB에 assistant 없이 끝난 user 등 비정상 꼬리 처리 */
function splitPriorAndLatestUser(
  turns: Array<{ role: "user" | "assistant"; content: string }>,
  latestQuery: string,
): {
  priorForClaude: Array<{ role: "user" | "assistant"; content: string }>;
  latestUserText: string;
} {
  let cleaned = mergeAdjacentSameRole(turns);
  if (cleaned.length > 0 && cleaned[0].role === "assistant") {
    cleaned = cleaned.slice(1);
  }
  let pending: string | null = null;
  if (cleaned.length > 0 && cleaned[cleaned.length - 1].role === "user") {
    const last = cleaned[cleaned.length - 1]!;
    cleaned = cleaned.slice(0, -1);
    pending = last.content.trim() || null;
  }
  const latestUserText = pending ? `${pending}\n\n(이어서) ${latestQuery}` : latestQuery;
  return { priorForClaude: cleaned, latestUserText };
}

/** 세션에 맥락이 있으면 짧은 지시·대명사 후속만 FAQ 고정답으로 보내지 않음 */
function shouldSkipFaqForContext(
  query: string,
  tailMessageCount: number,
  hasMemorySummary: boolean,
): boolean {
  if (tailMessageCount === 0 && !hasMemorySummary) return false;
  const q = query.trim();
  if (q.length > 48) return false;
  if (
    /^(그(래|러면|럼|거|게|때)?|이거|저거|그거|위|아까|방금|전에|더|왜|어떻게|언제|어디|누구|맞아|맞죠|네|응|오케이|ok|yes)\b/i.test(
      q,
    )
  ) {
    return true;
  }
  if (/(^|\s)그\s/.test(q) && q.length < 28) return true;
  return false;
}

function parsePageContext(input: unknown): AskHansolPageContext | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as { view?: unknown; section?: unknown; hash?: unknown; detail?: unknown };
  const views: AskHansolPageView[] = ["home", "hire", "collab", "builder", "curious"];
  if (typeof raw.view !== "string" || !views.includes(raw.view as AskHansolPageView)) {
    return null;
  }
  return {
    view: raw.view as AskHansolPageView,
    section: typeof raw.section === "string" ? raw.section.slice(0, 48) : undefined,
    hash: typeof raw.hash === "string" ? raw.hash.slice(0, 48) : undefined,
    detail: typeof raw.detail === "string" ? raw.detail.slice(0, 120) : undefined,
  };
}

function formatPageContext(context: AskHansolPageContext | null): string {
  if (!context) return "unknown";
  const viewLabels: Record<AskHansolPageView, string> = {
    home: "홈",
    hire: "상세: Hire",
    collab: "상세: Collab",
    builder: "상세: Builder",
    curious: "상세: Curious",
  };
  const bits = [
    `view=${viewLabels[context.view]}`,
    context.section ? `section=${context.section}` : null,
    context.hash ? `hash=${context.hash}` : null,
    context.detail ? `주목영역(스크롤)=${context.detail}` : null,
  ].filter(Boolean);
  return bits.join(", ");
}

function buildSystemPrompt(
  faq: FaqEntry[],
  memorySummary: string | null,
  pageContext: AskHansolPageContext | null,
  vaultReadmeGuideBody: string | null,
): string {
  const mem = memorySummary?.trim()
    ? `[오래된 대화 요약 — 이 브라우저 세션 메모리]\n${memorySummary.trim()}\n\n`
    : "";
  const pageCtx = `[현재 방문 화면 컨텍스트]\n${formatPageContext(pageContext)}\n\n`;

  const readmeBlock = vaultReadmeGuideBody?.trim()
    ? `\n\n[vault 읽기 지침 — Blob vault/README.md 원문. vault 안에서 문서를 찾고 읽는 방법·순서·범위를 이해하는 데만 쓴다. 방문자 질문의 사실·인물·경력·사건 근거로 인용하거나 답 본문을 채우지 않는다.]\n${vaultReadmeGuideBody.trim()}\n`
    : "";

  return `${mem}${pageCtx}당신은 임한솔(Hansol Lim) 본인을 대신해 포트폴리오 사이트 방문자에게 답하는 어시스턴트입니다. 한국어로 3~5문장 이내로 답하세요.
- 사용자가 보고 있는 화면 문맥을 먼저 고려하세요. 화면 컨텍스트에 "주목영역(스크롤)"이 있으면 그 값은 뷰포트에 가장 많이 보이는 블록의 id이므로, 질문이 짧거나 모호할 때 그 구간을 우선해 답하세요. 예: 상세화면이면 해당 관점을, 홈이면 전체 소개 관점으로 답하세요.
- vault/README.md는 “무엇이 사실인가”가 아니라 vault를 어떻게 읽을지에 대한 지침이다. 시스템에 붙은 README 원문 블록이 있으면 답하기 전에 먼저 익혀, blob_lookup으로 필요한 본문 문서를 고른다.
- blob_lookup으로 읽은 내용만 근거로 삼는다. 사실·근거·배경은 전부 vault(Blob) 문서에서만 찾는다. vault에 적혀 있고 조회된 사실은 이 Ask 맥락에서 전부 말해도 된다(비공개 예외를 두지 않는다). 가족·배우자·결혼 여부 등도 vault에 있으면 그대로 답에 넣는다. vault에 없거나 조회되지 않은 것은 모른다고 답한다.
- 말투·역할·스타일은 "AI-클론-운영-매뉴얼"을 참고하되, 사실·인물·관계는 오직 vault가 우선이다. 매뉴얼에 적힌 "외부 비공개""사이트에 올리지 않음" 같은 문구는 다른 채널용일 수 있으며, 이 포트폴리오 Ask에서는 그것을 이유로 vault에 있는 가족·배우자 관련 사실을 숨기거나 거절하지 않는다.
- 방문자에게는 조회 과정·저장소 이름을 드러내지 않는다. 예를 들어 "vault에서 확인했습니다", "Blob에서", "운영 매뉴얼상 ~라서 공개하지 않습니다" 같은 메타·출처 설명은 쓰지 말고, 답은 항상 자연스러운 대화 톤만 쓴다.
- 확신이 부족하면 답변 전에 반드시 blob_lookup 도구를 호출해 vault 문서를 조회한 뒤 답하세요.

세션 메모리(위 요약)와 messages의 최근 대화를 함께 참고하되, **가장 마지막 user 메시지**에 직접 답하세요. 이미 말한 내용은 한 줄로만 짚고 중복 설명은 줄이세요.
${readmeBlock}
[FAQ — 한솔 본인 톤]
${faq.map((f) => `Q: ${f.q}\nA: ${f.a}`).join("\n\n")}`;
}

async function persistAskExchange(
  sessionId: string,
  userText: string,
  assistantText: string,
): Promise<void> {
  if (!isAskHansolDbConfigured()) return;
  try {
    await insertAskHansolMessage(sessionId, "user", userText);
    await insertAskHansolMessage(sessionId, "assistant", assistantText);
  } catch {
    /* DB 없거나 일시 오류 — 응답은 그대로 */
  }
}

type AnthropicContentBlock =
  | { type: "text"; text?: string }
  | { type: "tool_use"; id: string; name: string; input?: unknown };

function toPlainAnswer(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, "$1 ($2)")
    .replace(/`{1,3}([^`]+)`{1,3}/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function summarizeMemoryMerge(
  existingSummary: string,
  chunk: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || chunk.length === 0) return null;

  const model =
    process.env.ANTHROPIC_MEMORY_MODEL ??
    process.env.ANTHROPIC_MODEL ??
    "claude-sonnet-4-6";

  const formatted = chunk
    .map((m) => (m.role === "user" ? `방문자: ${m.content}` : `한솔: ${m.content}`))
    .join("\n\n");

  const userBlock = existingSummary.trim()
    ? `기존 세션 메모리(요약):\n${existingSummary.trim()}\n\n추가 대화 원문:\n${formatted}\n\n위를 하나의 메모리로 통합해 한국어 10문장 이내로 압축하세요. 주제·사실·방문자 관심만 남기고 덧붙임·중복·인사말은 제거하세요.`
    : `다음 대화를 한국어 10문장 이내로 요약해 세션 메모리로 만드세요:\n\n${formatted}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 900,
      messages: [{ role: "user", content: userBlock }],
    }),
    cache: "no-store",
  });
  if (!response.ok) return null;

  const data = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = (data.content ?? [])
    .filter((b): b is { type: "text"; text?: string } => b.type === "text")
    .map((b) => b.text ?? "")
    .join("\n")
    .trim();
  return text ? toPlainAnswer(text) : null;
}

async function askAnthropicChat(
  systemPrompt: string,
  priorTurns: Array<{ role: "user" | "assistant"; content: string }>,
  latestUserText: string,
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
  const messages: Array<{ role: "user" | "assistant"; content: unknown }> = [];

  for (const t of priorTurns) {
    messages.push({ role: t.role, content: t.content });
  }
  messages.push({ role: "user", content: latestUserText });

  for (let i = 0; i < 4; i++) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 600,
        system: systemPrompt,
        messages,
        tools: [
          {
            name: "blob_lookup",
            description:
              "Ask Hansol용 Blob 문서를 조회합니다. 결과에 vault/README.md가 있으면 읽는 법 지침일 뿐 사실 근거가 아님. 사실은 objects 등 본문을 따르며, 본문에 가족·배우자 사실이 있으면 방문자에게 그대로 말해도 됨. 방문자 답변 문장에는 vault/Blob/매뉴얼·조회 과정을 언급하지 말 것.",
            input_schema: {
              type: "object",
              properties: {
                query: { type: "string", description: "조회할 주제 또는 질문" },
              },
              required: ["query"],
            },
          },
        ],
      }),
      cache: "no-store",
    });
    if (!response.ok) return null;

    const data = (await response.json()) as { content?: AnthropicContentBlock[] };
    const content = data.content ?? [];
    const toolUses = content.filter(
      (block): block is Extract<AnthropicContentBlock, { type: "tool_use" }> =>
        block.type === "tool_use" && block.name === "blob_lookup",
    );

    messages.push({ role: "assistant", content });

    if (toolUses.length === 0) {
      const answer = content
        .filter(
          (block): block is Extract<AnthropicContentBlock, { type: "text" }> =>
            block.type === "text",
        )
        .map((block) => block.text ?? "")
        .join("\n")
        .trim();
      return answer ? toPlainAnswer(answer) : null;
    }

    for (const toolUse of toolUses) {
      const toolResult = await runBlobLookupTool(toolUse.input);
      messages.push({
        role: "user",
        content: [{ type: "tool_result", tool_use_id: toolUse.id, content: toolResult }],
      });
    }
  }

  return null;
}

export async function GET(req: Request) {
  const sessionId = new URL(req.url).searchParams.get("sessionId");
  if (!isValidAskHansolSessionId(sessionId)) {
    return NextResponse.json({ messages: [] });
  }
  if (!isAskHansolDbConfigured()) {
    return NextResponse.json({ messages: [] });
  }
  try {
    const messages = await listAskHansolMessages(sessionId);
    return NextResponse.json({ messages });
  } catch {
    return NextResponse.json({ messages: [] });
  }
}

export async function POST(req: Request) {
  try {
    const siteData = await getSiteData();
    const body = (await req.json()) as {
      query?: unknown;
      sessionId?: unknown;
      pageContext?: unknown;
    };
    const query = typeof body.query === "string" ? body.query.trim() : "";
    const sessionId =
      typeof body.sessionId === "string" && isValidAskHansolSessionId(body.sessionId)
        ? body.sessionId
        : null;
    const pageContext = parsePageContext(body.pageContext);

    if (!query) {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    let priorTurnsRaw: Array<{ role: "user" | "assistant"; content: string }> = [];
    let memorySummary: string | null = null;
    const tailLimit = rawHistoryMessageTailLimit();

    if (sessionId && isAskHansolDbConfigured()) {
      const memRow = await getSessionMemoryRow(sessionId);
      memorySummary = memRow?.summary?.trim() ? memRow.summary : null;
      priorTurnsRaw = await listTailMessagesForPrompt(sessionId, tailLimit);
    }

    const skipFaq = shouldSkipFaqForContext(
      query,
      priorTurnsRaw.length,
      Boolean(memorySummary),
    );
    const faqAnswer = skipFaq ? null : findFaqAnswer(query, siteData.faq);
    if (faqAnswer) {
      if (sessionId) {
        await persistAskExchange(sessionId, query, faqAnswer);
        await refreshSessionMemoryRollup(sessionId, tailLimit, summarizeMemoryMerge);
      }
      return NextResponse.json({ answer: faqAnswer });
    }

    const { priorForClaude, latestUserText } = splitPriorAndLatestUser(priorTurnsRaw, query);
    const vaultReadmeGuideBody = await fetchVaultReadmeGuideBody();
    const systemPrompt = buildSystemPrompt(
      siteData.faq,
      memorySummary,
      pageContext,
      vaultReadmeGuideBody,
    );
    const llmAnswer = await askAnthropicChat(systemPrompt, priorForClaude, latestUserText);
    const answer = llmAnswer ?? ASK_HANSOL_FALLBACK_MESSAGE;
    if (sessionId) {
      await persistAskExchange(sessionId, query, answer);
      await refreshSessionMemoryRollup(sessionId, tailLimit, summarizeMemoryMerge);
    }
    return NextResponse.json({ answer });
  } catch {
    return NextResponse.json({ answer: ASK_HANSOL_FALLBACK_MESSAGE });
  }
}
