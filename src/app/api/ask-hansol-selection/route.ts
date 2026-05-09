import { NextResponse } from "next/server";
import { isValidAskHansolSessionId } from "@/lib/ask-hansol/shared";

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

function buildSelectionQuery(selectedText: string): string {
  return [
    "아래 인용문을 현재 페이지 문맥에 맞춰 보강 설명해 주세요.",
    "중요: 인사, 감탄, 칭찬, 추임새 없이 첫 문장부터 바로 본론으로 답해 주세요.",
    "중요: 반드시 한국어 3~5문장으로만 답하고, 마크다운 제목/불릿/번호 목록은 쓰지 마세요.",
    "중요: 한 단락으로 답하고 문장 중간에 빈 줄을 넣지 마세요.",
    "핵심 의미, 생략된 배경, 이 포트폴리오 맥락에서의 중요성을 자연스럽게 포함해 주세요.",
    `인용문: "${selectedText}"`,
  ].join("\n");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      selectedText?: unknown;
      sessionId?: unknown;
      pageContext?: unknown;
    };
    const selectedText =
      typeof body.selectedText === "string" ? body.selectedText.replace(/\s+/g, " ").trim() : "";
    const sessionId =
      typeof body.sessionId === "string" && isValidAskHansolSessionId(body.sessionId)
        ? body.sessionId
        : undefined;
    const pageContext = parsePageContext(body.pageContext);

    if (!selectedText) {
      return NextResponse.json({ error: "selectedText is required" }, { status: 400 });
    }

    const askEndpoint = new URL("/api/ask-hansol", req.url).toString();
    const response = await fetch(askEndpoint, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: buildSelectionQuery(selectedText),
        sessionId,
        pageContext: pageContext ?? undefined,
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: "ask route failed" }, { status: response.status });
    }

    const data = (await response.json()) as { answer?: string };
    return NextResponse.json({ answer: data.answer ?? "" });
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
}
