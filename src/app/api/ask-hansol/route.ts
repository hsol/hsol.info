import { NextResponse } from "next/server";
import { HSOL_DATA as D } from "@/data/site";
import { ASK_HANSOL_FALLBACK_MESSAGE } from "@/lib/ask-hansol/shared";

function normalize(text: string): string {
  return text.toLowerCase().replace(/[?!.\s]/g, "");
}

function findFaqAnswer(query: string): string | null {
  const needle = normalize(query);
  const matched = D.faq.find((item) => {
    const candidate = normalize(item.q);
    return candidate === needle || candidate.includes(needle) || needle.includes(candidate);
  });
  return matched?.a ?? null;
}

function buildPrompt(query: string): string {
  return `당신은 임한솔(Hansol Lim) 본인을 대신해 포트폴리오 사이트 방문자에게 답하는 어시스턴트입니다.
한솔의 어조는 차분하고 단정합니다. 과장하지 않고, 짧고 사실 위주로 답합니다.
한국어로 3~5문장 이내로 답하세요. 모르는 것은 모른다고 말합니다.

[프로필 요약]
- 이름: 임한솔, 10년 차 엔지니어 출신, 서울 거주
- 현재: 프루퍼 ㈜ 대표 (2025.04~), PPB Studios 팀장 (2025.06~)
- 과거: 토스 인터널 제품팀 4년 10개월, 리디북스 2년, 씨엔티테크 2년 4개월
- Antler EIR, 라이트형제 자문
- 학력: 건국대 경영공학사, 선린인터넷고
- 대표 보유 기술: 전략적 사고 · 고객 중심 사고 · 디자인적 사고
- 키워드: 인터널 제품, 옴니채널, 개발자 생산성, AI Native, Claude Code, Vibe coding
- 연락: molmoty@gmail.com · calendly.com/contact-hsol/coffee-chat

[FAQ — 한솔 본인 톤]
${D.faq.map((f) => `Q: ${f.q}\nA: ${f.a}`).join("\n\n")}

방문자 질문: ${query}`;
}

async function askAnthropic(prompt: string): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? "claude-3-5-sonnet-latest",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    }),
    cache: "no-store",
  });
  if (!response.ok) return null;

  const data = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const text = data.content
    ?.filter((item) => item.type === "text" && item.text)
    .map((item) => item.text)
    .join("\n")
    .trim();
  return text || null;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { query?: unknown };
    const query = typeof body.query === "string" ? body.query.trim() : "";
    if (!query) {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    const faqAnswer = findFaqAnswer(query);
    if (faqAnswer) {
      return NextResponse.json({ answer: faqAnswer });
    }

    const prompt = buildPrompt(query);
    const llmAnswer = await askAnthropic(prompt);
    return NextResponse.json({ answer: llmAnswer ?? ASK_HANSOL_FALLBACK_MESSAGE });
  } catch {
    return NextResponse.json({ answer: ASK_HANSOL_FALLBACK_MESSAGE });
  }
}
