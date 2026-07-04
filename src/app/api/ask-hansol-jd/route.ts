import { NextResponse } from "next/server";
import { getSiteData } from "@/lib/content/site-data";
import type { SiteData } from "@/content/schema";
import { normalizeAskAnswerPlainText } from "@/lib/ask-hansol/answer-linkify";
import { chatText } from "@/lib/llm";
import {
  fetchComprehensiveProfileContext,
  fetchVaultReadmeGuideBody,
} from "@/lib/ask-hansol/blob-context";
import { summarizeMemoryMerge } from "@/lib/ask-hansol/memory-summarize";
import { ASK_HANSOL_FALLBACK_MESSAGE, isValidAskHansolSessionId } from "@/lib/ask-hansol/shared";
import {
  insertAskHansolMessage,
  insertAskHansolMessageReturningId,
  isAskHansolDbConfigured,
} from "@/lib/db/ask-hansol-messages";
import { rawHistoryMessageTailLimit, refreshSessionMemoryRollup } from "@/lib/db/ask-hansol-memory";

/** DB 영속화·메모리 롤업이 있으므로 매 요청 동적 처리. */
export const dynamic = "force-dynamic";

const JD_MIN_CHARS = 60;
const JD_MAX_CHARS = 8_000;
/** 세션 히스토리/메모리에 남길 JD 본문 상한(요약 품질·DB 크기 균형). */
const JD_PERSIST_CHARS = 4_000;

const JD_TOO_SHORT_MESSAGE =
  "적합도를 제대로 보려면 공고 본문이 조금 더 필요해요. 주요 업무·자격 요건·우대 사항이 담긴 채용 공고(JD) 전문을 붙여넣어 주시면 분석해 드릴게요.";

type AskHansolPageView = "home" | "hire" | "collab" | "builder" | "curious";
type AskHansolPageContext = {
  view: AskHansolPageView;
  section?: string;
  hash?: string;
  detail?: string;
};

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

/** siteData에서 1차 근거가 되는 지원자 핵심 사실 블록을 만든다(구조화·항상 가용). */
function buildCandidateFactsBlock(siteData: SiteData): string {
  const { identity, pillars, career, education, languages } = siteData;

  const pillarsLine = pillars
    .map((p) => `- ${p.labelKo || p.label}: ${p.blurb}`)
    .join("\n");

  const careerLines = career
    .map((c) => {
      const points = c.points.map((pt) => `    · ${pt}`).join("\n");
      return `- ${c.org} — ${c.role} (${c.period})\n${points}`;
    })
    .join("\n");

  const eduLine = education.map((e) => `${e.school} ${e.degree} (${e.period})`).join(" / ");
  const langLine = languages.map((l) => `${l.name}(${l.level})`).join(", ");

  return [
    "[지원자(임한솔) 핵심 사실 — 적합도 판단의 1차 근거]",
    `한 줄 소개: ${identity.tagline} / ${identity.taglineSub}`,
    `거점: ${identity.location}`,
    "",
    "강점(Pillars):",
    pillarsLine,
    "",
    "경력(주요 성과 포함):",
    careerLines,
    "",
    `학력: ${eduLine}`,
    `언어: ${langLine}`,
  ].join("\n");
}

function buildSystemPrompt(
  siteData: SiteData,
  profileContext: string,
  vaultReadmeGuideBody: string | null,
  pageContext: AskHansolPageContext | null,
): string {
  const facts = buildCandidateFactsBlock(siteData);

  const supplementary = profileContext.trim()
    ? `\n\n[보조 자료 — 위 핵심 사실을 보강하는 배경 문서]\n${profileContext.trim()}`
    : "";

  const readmeBlock = vaultReadmeGuideBody?.trim()
    ? `\n\n[자료 읽기 지침 — 이 블록은 자료를 어떻게 읽을지에 대한 안내일 뿐, 적합도의 사실 근거로 인용하지 않는다.]\n${vaultReadmeGuideBody.trim()}`
    : "";

  const calendly = siteData.identity.calendly;
  const ctxLine = pageContext ? `\n[현재 방문 화면] view=${pageContext.view}` : "";

  return `당신은 임한솔(Hansol Lim)을 대신해, 방문자가 붙여넣은 채용 공고(JD)와 임한솔의 적합도를 평가하는 어시스턴트입니다.${ctxLine}

평가 원칙:
- 아래 "지원자 핵심 사실"과 보조 자료에 근거해서만 판단하세요. 근거가 없는 강점·경험을 지어내지 마세요.
- 과장하거나 무조건 잘 맞다고 하지 마세요. 다만 부족함·약점·보완·미흡·간극처럼 결함을 지적하는 표현이나 뉘앙스는 절대 쓰지 마세요.
- 자료만으로 분명히 확인되지 않는 부분은 "모자라다/보완이 필요하다"가 아니라, 어디까지나 "공고만으로는 확인되지 않아 대화로 확인해보면 좋을 지점"이라는 중립적인 확인 관점으로만 표현하세요.

출력 형식(한국어):
- 칭찬·환호·인사 없이 첫 문장부터 본론으로 시작하세요.
- 첫 줄에 전반적인 적합도를 한 문장으로 명확히 제시하세요(예: "전반적으로 잘 맞는 편입니다", "핵심 역량은 잘 맞고, 몇 가지는 직접 확인해보시면 좋습니다", "맞닿는 지점이 있고, 방향성은 대화로 확인해보면 좋겠습니다"). 이때도 "보완이 필요하다" 같은 결함 뉘앙스는 쓰지 마세요.
- 이어서 **부합하는 강점**과 **확인하면 좋을 지점**을 각각 2~4개의 간단한 불릿으로 정리하세요. 각 항목은 JD의 요구와 임한솔의 실제 경험을 연결해 근거를 함께 적으세요. "확인하면 좋을 지점"은 결함 지적이 아니라 "무엇을 직접 확인해보면 좋은지" 관점으로만 쓰세요.
- 마지막에 한 문장으로, 더 깊은 논의가 필요하면 ${calendly} 에서 커피챗을 제안하세요.
- 전체 분량은 한국어 기준 12문장 이내로 간결하게. 마크다운 굵게(**)와 불릿(-)만 쓰고 제목(#)·표는 쓰지 마세요.
- 자료 출처·저장소·조회 과정(예: "vault에서", "자료상")은 답에 드러내지 마세요. 자연스러운 대화 톤만 쓰세요.

${facts}${supplementary}${readmeBlock}`;
}

async function analyzeJdWithAnthropic(
  systemPrompt: string,
  jdText: string,
): Promise<string | null> {
  const userBlock = `아래 채용 공고(JD)에 대한 임한솔의 적합도를 위 원칙·형식대로 분석해 주세요.\n\n[채용 공고(JD)]\n${jdText}`;

  const text = await chatText({
    system: systemPrompt,
    maxOutputTokens: 1_100,
    messages: [{ role: "user", content: userBlock }],
  });
  return text ? normalizeAskAnswerPlainText(text) : null;
}

async function persistJdExchange(
  sessionId: string,
  jdText: string,
  assistantText: string,
): Promise<string | null> {
  if (!isAskHansolDbConfigured()) return null;
  const persistedJd = jdText.slice(0, JD_PERSIST_CHARS);
  const userRecord = `[채용 공고 적합도 분석 요청]\n\n${persistedJd}`;
  try {
    await insertAskHansolMessage(sessionId, "user", userRecord);
    return await insertAskHansolMessageReturningId(sessionId, "assistant", assistantText);
  } catch {
    /* DB 없거나 일시 오류 — 응답은 그대로 */
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      jdText?: unknown;
      sessionId?: unknown;
      pageContext?: unknown;
    };
    const rawJd = typeof body.jdText === "string" ? body.jdText.trim() : "";
    const jdText = rawJd.slice(0, JD_MAX_CHARS);
    const sessionId =
      typeof body.sessionId === "string" && isValidAskHansolSessionId(body.sessionId)
        ? body.sessionId
        : null;
    const pageContext = parsePageContext(body.pageContext);

    if (!jdText) {
      return NextResponse.json({ error: "jdText is required" }, { status: 400 });
    }
    if (jdText.length < JD_MIN_CHARS) {
      return NextResponse.json({ answer: JD_TOO_SHORT_MESSAGE });
    }

    const siteData = await getSiteData();
    const [profileContext, vaultReadmeGuideBody] = await Promise.all([
      fetchComprehensiveProfileContext().catch(() => ""),
      fetchVaultReadmeGuideBody().catch(() => null),
    ]);

    const systemPrompt = buildSystemPrompt(
      siteData,
      profileContext,
      vaultReadmeGuideBody,
      pageContext,
    );
    const analysis = await analyzeJdWithAnthropic(systemPrompt, jdText);
    const answer = analysis ?? ASK_HANSOL_FALLBACK_MESSAGE;

    let messageId: string | null = null;
    if (sessionId) {
      messageId = await persistJdExchange(sessionId, jdText, answer);
      await refreshSessionMemoryRollup(
        sessionId,
        rawHistoryMessageTailLimit(),
        summarizeMemoryMerge,
      );
    }

    return NextResponse.json({ answer, messageId });
  } catch {
    return NextResponse.json({ answer: ASK_HANSOL_FALLBACK_MESSAGE });
  }
}
