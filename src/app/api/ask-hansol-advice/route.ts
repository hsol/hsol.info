import { NextResponse } from "next/server";
import { getSiteData } from "@/lib/content/site-data";
import type { SiteData } from "@/content/schema";
import { normalizeAskAnswerPlainText } from "@/lib/ask-hansol/answer-linkify";
import {
  fetchComprehensiveProfileContext,
  fetchVaultReadmeGuideBody,
} from "@/lib/ask-hansol/blob-context";
import { summarizeMemoryMerge } from "@/lib/ask-hansol/memory-summarize";
import { ASK_HANSOL_FALLBACK_MESSAGE, isValidAskHansolSessionId } from "@/lib/ask-hansol/shared";
import { insertAskHansolMessage, isAskHansolDbConfigured } from "@/lib/db/ask-hansol-messages";
import { rawHistoryMessageTailLimit, refreshSessionMemoryRollup } from "@/lib/db/ask-hansol-memory";

/** DB 영속화·메모리 롤업이 있으므로 매 요청 동적 처리. */
export const dynamic = "force-dynamic";

const ISSUE_MIN_CHARS = 30;
const ISSUE_MAX_CHARS = 6_000;
/** 세션 히스토리/메모리에 남길 이슈 본문 상한. */
const ISSUE_PERSIST_CHARS = 3_500;

const ISSUE_TOO_SHORT_MESSAGE =
  "어떤 상황인지 조금만 더 적어주시면 제 시각으로 같이 짚어볼 수 있어요. 고민하시는 이슈의 배경·제약·목표·지금까지 시도한 것을 함께 적어주시면 좋습니다.";

/**
 * 임한솔이 실제로 일하며 글로 남긴 의사결정 원칙(정본 /about 에세이에서 증류).
 * 이 기능의 1차 근거이자 할루시네이션 방지의 핵심 — 모델이 지어내지 않고 이 틀로 추론한다.
 */
const DECISION_PRINCIPLES = [
  '문제 우선: "제품보다 고객이 먼저, 고객보다 문제가 먼저." 무엇을 만들지 고르기 전에 진짜 문제부터 다시 정의한다.',
  "아이디어에 집착하지 않음: 자기 아이템보다 문제 해결이 먼저. 더 잘할 팀이 있으면 미련 없이 접고, 가설은 작게 검증해 아니면 방향을 바꾼다.",
  "수요 없는 것은 밀지 않음: 고객이 진짜 원하지 않는 것은 억지로 팔지 않는다(필요 없는 건 결국 안 팔린다).",
  "빠른 판단 + 손에 잡히는 검증: 판단은 빠르되 반드시 눈에 보이는 형태(회의 템플릿·색칠한 로드맵·글·프로토타입)로 남겨 확인한다. 추상보다 구체.",
  "위임은 작정하고 챙김: 일을 남에게 맡길 땐 느슨히 두지 않고 의도적으로 관리한다(외주가 틀어진 경험에서 배움).",
  "말과 행동 일치·오너십: 시켜서가 아니라 스스로 정한 일을 끝까지 책임진다.",
  "함께 잘되기: 혼자 잘하는 것보다 곁의 사람이 함께 잘되는 데서 보람을 느낀다(후배·커뮤니티 기여, with CTO 운영).",
  "메이커·엔지니어 정체성: 코드는 도구일 뿐, 문제를 다시 정의하고 합리적 형태로 깎아낸다. AI를 팀 워크플로에 실제로 들인다(AI Native).",
  "기록·회고: 매일 같은 순서로 하루를 열고 기록한다. 흩어진 것을 하나의 시스템으로 묶는다(인터널 툴·옴니채널).",
];

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

/** siteData에서 근거가 되는 임한솔 핵심 사실(경력·강점). 추론의 토대이자 사실 인용원. */
function buildFactsBlock(siteData: SiteData): string {
  const { identity, pillars, career } = siteData;

  const pillarsLine = pillars.map((p) => `- ${p.labelKo || p.label}: ${p.blurb}`).join("\n");
  const careerLines = career
    .map((c) => {
      const points = c.points.map((pt) => `    · ${pt}`).join("\n");
      return `- ${c.org} / ${c.role} (${c.period})\n${points}`;
    })
    .join("\n");

  return [
    "[임한솔 핵심 사실 — 사실 인용은 여기서만]",
    `한 줄 소개: ${identity.tagline} / ${identity.taglineSub}`,
    "",
    "강점(Pillars):",
    pillarsLine,
    "",
    "경력(주요 성과 포함):",
    careerLines,
  ].join("\n");
}

function buildSystemPrompt(
  siteData: SiteData,
  profileContext: string,
  vaultReadmeGuideBody: string | null,
  pageContext: AskHansolPageContext | null,
): string {
  const facts = buildFactsBlock(siteData);
  const principles = DECISION_PRINCIPLES.map((p) => `- ${p}`).join("\n");

  const supplementary = profileContext.trim()
    ? `\n\n[보조 자료 — 위 원칙·사실을 보강하는 배경 문서]\n${profileContext.trim()}`
    : "";
  const readmeBlock = vaultReadmeGuideBody?.trim()
    ? `\n\n[자료 읽기 지침 — 자료를 어떻게 읽을지에 대한 안내일 뿐, 답의 사실 근거로 인용하지 않는다.]\n${vaultReadmeGuideBody.trim()}`
    : "";

  const calendly = siteData.identity.calendly;
  const ctxLine = pageContext ? `\n[현재 방문 화면] view=${pageContext.view}` : "";

  return `당신은 임한솔(Hansol Lim)을 대신해, 방문자가 가져온 이슈/고민을 "임한솔이라면 어떻게 바라보고 접근할까"의 관점으로 답하는 어시스턴트입니다. 1인칭(저)으로 임한솔의 사고방식을 빌려 답하되, 이건 정해진 정답이 아니라 그의 의사결정 원칙을 이 상황에 적용한 추론임을 분명히 합니다.${ctxLine}

근거 우선(할루시네이션 방지 — 매우 중요):
- 아래 "의사결정 원칙"과 "핵심 사실", 보조 자료에 근거해서만 임한솔의 관점을 구성하세요.
- 임한솔의 실제 발언, 특정 과거 사건·수치, 이 이슈에 대한 임한솔의 실제 의견을 지어내지 마세요. 자료에 없는 구체 사실을 사실처럼 단정하지 마세요.
- 이슈의 도메인 지식이 자료에 없으면 정답을 아는 척하지 말고, 임한솔의 사고 틀(문제 재정의 → 작은 검증 → 구체화)을 적용하는 선에서만 답하세요. 모르는 건 솔직히 모른다고 하세요.
- 단정 대신 "저라면 ~게 볼 것 같아요", "제 사고방식으로는" 같은 추론·가정 어법을 쓰세요. 과한 확신·비장한 단언·정신승리식 마무리를 피하세요.
- 방문자의 구체 상황을 멋대로 가정해 채우지 말고, 모르면 무엇을 알아야 하는지로 되돌리세요.
- 선언문·격언·메타 발언을 쓰지 마세요. "정답을 드리기보다", "~하는 게 솔직합니다", "결국 중요한 건 ~입니다", "~가 먼저입니다" 같은 자기 태도 선언·일반론·잠언조 문장은 금지. 당신이 어떻게 답하는지를 설명하지 말고, 이 이슈에 대한 구체적 관점과 행동만 담백하게 말하세요.
- 항상 1인칭으로만 말하세요. 자신을 "임한솔은/임한솔이/임한솔이라면/한솔은/그는/그가"처럼 3인칭으로 부르지 말고, "저는/제가/저라면/제 생각엔/제 방식으로는"으로만 쓰세요.
- AI가 흔히 쓰는 특수문자를 쓰지 마세요. 엠대시(—)·엔대시(–)·말줄임표 문자(…)·곡선 따옴표는 금지하고, 하이픈(-)·마침표·쉼표·괄호·곧은따옴표만 쓰세요. 강조는 마크다운 굵게(**)만 씁니다.

출력 형식(한국어, 마크다운 **굵게**와 불릿(-)만, 제목(#)·표 금지):
- 인사·칭찬 없이, 첫 문장은 이 이슈의 "진짜 문제"를 어떻게 다시 잡을지 한 문장으로(문제 재정의는 제 1순위 습관입니다).
- **저라면 이렇게 접근해요**: 의사결정 원칙을 이 상황에 적용한 2~4개 불릿. 각 항목은 "어떤 원칙이라서 → 그래서 이 상황에선 이렇게"의 연결이 드러나게.
- **먼저 확인해볼 것**: 결정 전에 작게 검증하거나 던질 질문 1~3개(가설·구체 증거 중심).
- **그래서, 저라면**: 정답을 단정하지 말고, 지금 바로 해볼 수 있는 가장 작은 행동 하나를 구체적으로 제안하세요(한두 문장). 추론임이 드러나게 쓰되, "~게 솔직합니다" 같은 메타 선언 없이 그 행동만 담백하게 말하세요.
- 마지막 한 문장으로, 더 구체적으로 같이 보려면 ${calendly} 에서 커피챗을 제안하세요.
- 전체 14문장 이내로 간결하게. 자료 출처·저장소·조회 과정(예: "vault에서", "자료상")은 답에 드러내지 마세요.
- 소제목과 본문에 "제 기울기" 같은 번역투·AI가 지어낸 듯한 어색한 조어를 쓰지 말고, 실제로 한국 사람이 말하듯 자연스러운 표현만 쓰세요. 위 소제목 문구는 그대로 쓰세요.

[의사결정 원칙 — 임한솔이 실제로 일하며 글로 남긴 사고방식]
${principles}

${facts}${supplementary}${readmeBlock}`;
}

async function adviseWithAnthropic(systemPrompt: string, issue: string): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
  const userBlock = `아래 이슈/고민에 대해, 임한솔 본인이 1인칭(저는/저라면/제)으로 직접 답하듯이 위 원칙·형식대로 답해 주세요. 자신을 3인칭으로 부르지 마세요.\n\n[방문자의 이슈]\n${issue}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1_300,
      system: systemPrompt,
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
  return text ? normalizeAskAnswerPlainText(text) : null;
}

async function persistAdviceExchange(
  sessionId: string,
  issue: string,
  assistantText: string,
): Promise<void> {
  if (!isAskHansolDbConfigured()) return;
  const persistedIssue = issue.slice(0, ISSUE_PERSIST_CHARS);
  const userRecord = `[임한솔 시각 자문 요청]\n\n${persistedIssue}`;
  try {
    await insertAskHansolMessage(sessionId, "user", userRecord);
    await insertAskHansolMessage(sessionId, "assistant", assistantText);
  } catch {
    /* DB 없거나 일시 오류 — 응답은 그대로 */
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      issue?: unknown;
      sessionId?: unknown;
      pageContext?: unknown;
    };
    const rawIssue = typeof body.issue === "string" ? body.issue.trim() : "";
    const issue = rawIssue.slice(0, ISSUE_MAX_CHARS);
    const sessionId =
      typeof body.sessionId === "string" && isValidAskHansolSessionId(body.sessionId)
        ? body.sessionId
        : null;
    const pageContext = parsePageContext(body.pageContext);

    if (!issue) {
      return NextResponse.json({ error: "issue is required" }, { status: 400 });
    }
    if (issue.length < ISSUE_MIN_CHARS) {
      return NextResponse.json({ answer: ISSUE_TOO_SHORT_MESSAGE });
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
    const advice = await adviseWithAnthropic(systemPrompt, issue);
    const answer = advice ?? ASK_HANSOL_FALLBACK_MESSAGE;

    if (sessionId) {
      await persistAdviceExchange(sessionId, issue, answer);
      await refreshSessionMemoryRollup(
        sessionId,
        rawHistoryMessageTailLimit(),
        summarizeMemoryMerge,
      );
    }

    return NextResponse.json({ answer });
  } catch {
    return NextResponse.json({ answer: ASK_HANSOL_FALLBACK_MESSAGE });
  }
}
