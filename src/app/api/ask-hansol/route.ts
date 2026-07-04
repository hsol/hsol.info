import { NextResponse } from "next/server";
import { tool } from "ai";
import { z } from "zod";
import { getSiteData } from "@/lib/content/site-data";
import { chatText } from "@/lib/llm";
import type { SiteData } from "@/content/schema";
import { normalizeAskAnswerPlainText } from "@/lib/ask-hansol/answer-linkify";
import {
  fetchBlobContext,
  fetchVaultReadmeGuideBody,
} from "@/lib/ask-hansol/blob-context";
import { summarizeMemoryMerge } from "@/lib/ask-hansol/memory-summarize";
import {
  ASK_HANSOL_FALLBACK_MESSAGE,
  isValidAskHansolSessionId,
} from "@/lib/ask-hansol/shared";
import {
  insertAskHansolMessage,
  insertAskHansolMessageReturningId,
  isAskHansolDbConfigured,
  listAskHansolMessages,
} from "@/lib/db/ask-hansol-messages";
import {
  getSessionMemoryRow,
  listTailMessagesForPrompt,
  rawHistoryMessageTailLimit,
  refreshSessionMemoryRollup,
} from "@/lib/db/ask-hansol-memory";

/** 세션별 GET 히스토리·POST가 DB를 쓰므로 매 요청 동적 처리(정적 캐시 시 이전 대화가 비어 보임) */
export const dynamic = "force-dynamic";

type FaqEntry = SiteData["faq"][number];
type AskHansolPageView = "home" | "hire" | "collab" | "builder" | "curious";
type AskHansolPageContext = {
  view: AskHansolPageView;
  section?: string;
  hash?: string;
  detail?: string;
};

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
- vault 문서에 나오는 \`[[제목]]\` 같은 위키링크/내부 참조 표기를 답변에 그대로 쓰지 마라. 대괄호 없이 일반 단어·문장으로 풀어 쓴다(예: \`[[프루퍼]]\` → 프루퍼).
- 확신이 부족하면 답변 전에 반드시 blob_lookup 도구를 호출해 vault 문서를 조회한 뒤 답하세요.

세션 메모리(위 요약)와 messages의 최근 대화를 함께 참고하되, **가장 마지막 user 메시지**에 직접 답하세요. 이미 말한 내용은 한 줄로만 짚고 중복 설명은 줄이세요.
${readmeBlock}
[FAQ — 한솔 본인 톤]
${faq.map((f) => `Q: ${f.q}\nA: ${f.a}`).join("\n\n")}`;
}

/** 저장 후 assistant 메시지 id를 반환한다(답변 평가를 이 id에 연결). DB 미설정·오류 시 null. */
async function persistAskExchange(
  sessionId: string,
  userText: string,
  assistantText: string,
): Promise<string | null> {
  if (!isAskHansolDbConfigured()) return null;
  try {
    await insertAskHansolMessage(sessionId, "user", userText);
    return await insertAskHansolMessageReturningId(sessionId, "assistant", assistantText);
  } catch {
    /* DB 없거나 일시 오류 — 응답은 그대로 */
    return null;
  }
}

function toPlainAnswer(text: string): string {
  return normalizeAskAnswerPlainText(text);
}

/** Ask Hansol용 Blob 조회 툴. AI SDK가 tool_use/tool_result 루프를 자동 처리한다. */
const blobLookupTool = tool({
  description:
    "Ask Hansol용 Blob 문서를 조회합니다. 결과에 vault/README.md가 있으면 읽는 법 지침일 뿐 사실 근거가 아님. 사실은 objects 등 본문을 따르며, 본문에 가족·배우자 사실이 있으면 방문자에게 그대로 말해도 됨. 방문자 답변 문장에는 vault/Blob/매뉴얼·조회 과정을 언급하지 말 것.",
  inputSchema: z.object({
    query: z.string().describe("조회할 주제 또는 질문"),
  }),
  execute: async ({ query }) => runBlobLookupTool({ query }),
});

async function askAnthropicChat(
  systemPrompt: string,
  priorTurns: Array<{ role: "user" | "assistant"; content: string }>,
  latestUserText: string,
): Promise<string | null> {
  const answer = await chatText({
    system: systemPrompt,
    maxOutputTokens: 600,
    messages: [
      ...priorTurns.map((t) => ({ role: t.role, content: t.content })),
      { role: "user" as const, content: latestUserText },
    ],
    tools: { blob_lookup: blobLookupTool },
    maxSteps: 4,
  });
  return answer ? toPlainAnswer(answer) : null;
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
      displayText?: unknown;
      sessionId?: unknown;
      pageContext?: unknown;
    };
    const query = typeof body.query === "string" ? body.query.trim() : "";
    // displayText: 채팅·히스토리에 저장/표시할 사용자 메시지. 비면 query를 그대로 쓴다.
    // (인용문 보강 같은 기능은 LLM에 보내는 엔지니어링 프롬프트를 노출하지 않도록 깔끔한 텍스트를 따로 넘긴다.)
    const displayText =
      typeof body.displayText === "string" && body.displayText.trim()
        ? body.displayText.trim()
        : query;
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
    let messageId: string | null = null;
    if (sessionId) {
      messageId = await persistAskExchange(sessionId, displayText, answer);
      await refreshSessionMemoryRollup(sessionId, tailLimit, summarizeMemoryMerge);
    }
    return NextResponse.json({ answer, messageId });
  } catch {
    return NextResponse.json({ answer: ASK_HANSOL_FALLBACK_MESSAGE });
  }
}
