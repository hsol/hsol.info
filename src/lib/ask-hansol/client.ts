type AskHansolResponse = { answer?: string; messageId?: string | null };

/** 답변 텍스트와, 평가(피드백)를 연결할 assistant 메시지 id(DB 미설정 시 null). */
export type AskHansolAnswer = { answer: string; messageId: string | null };

export type AskHansolPageContext = {
  view: "home" | "hire" | "collab" | "builder" | "curious";
  section?: string;
  hash?: string;
  /** 스크롤 등으로 사용자가 주로 보고 있는 화면 블록(예: hire/strengths) */
  detail?: string;
};

export type AskHansolHistoryMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  /** 이 답변에 이미 평가를 남겼으면 true — 평가 UI를 다시 띄우지 않는다. */
  has_feedback?: boolean;
};

export async function fetchAskHansolHistory(
  sessionId: string,
): Promise<AskHansolHistoryMessage[]> {
  if (!sessionId) return [];
  const response = await fetch(
    "/api/ask-hansol?sessionId=" + encodeURIComponent(sessionId),
    { cache: "no-store" },
  );
  if (!response.ok) return [];
  const data = (await response.json()) as { messages?: AskHansolHistoryMessage[] };
  return Array.isArray(data.messages) ? data.messages : [];
}

export async function askHansolViaApi(
  query: string,
  sessionId: string,
  pageContext?: AskHansolPageContext,
): Promise<AskHansolAnswer> {
  const response = await fetch("/api/ask-hansol", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      sessionId: sessionId || undefined,
      pageContext: pageContext ?? undefined,
    }),
  });
  if (!response.ok) {
    throw new Error(`ask-hansol failed: ${response.status}`);
  }
  const data = (await response.json()) as AskHansolResponse;
  if (!data.answer) {
    throw new Error("empty answer");
  }
  return { answer: data.answer, messageId: data.messageId ?? null };
}

export async function askHansolSelectionViaApi(
  selectedText: string,
  sessionId: string,
  pageContext?: AskHansolPageContext,
): Promise<AskHansolAnswer> {
  const response = await fetch("/api/ask-hansol-selection", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      selectedText,
      sessionId: sessionId || undefined,
      pageContext: pageContext ?? undefined,
    }),
  });
  if (!response.ok) {
    throw new Error(`ask-hansol-selection failed: ${response.status}`);
  }
  const data = (await response.json()) as AskHansolResponse;
  if (!data.answer) {
    throw new Error("empty answer");
  }
  return { answer: data.answer, messageId: data.messageId ?? null };
}

export async function analyzeJobDescriptionViaApi(
  jdText: string,
  sessionId: string,
  pageContext?: AskHansolPageContext,
): Promise<AskHansolAnswer> {
  const response = await fetch("/api/ask-hansol-jd", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jdText,
      sessionId: sessionId || undefined,
      pageContext: pageContext ?? undefined,
    }),
  });
  if (!response.ok) {
    throw new Error(`ask-hansol-jd failed: ${response.status}`);
  }
  const data = (await response.json()) as AskHansolResponse;
  if (!data.answer) {
    throw new Error("empty answer");
  }
  return { answer: data.answer, messageId: data.messageId ?? null };
}

export async function askHansolAdviceViaApi(
  issue: string,
  sessionId: string,
  pageContext?: AskHansolPageContext,
): Promise<AskHansolAnswer> {
  const response = await fetch("/api/ask-hansol-advice", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      issue,
      sessionId: sessionId || undefined,
      pageContext: pageContext ?? undefined,
    }),
  });
  if (!response.ok) {
    throw new Error(`ask-hansol-advice failed: ${response.status}`);
  }
  const data = (await response.json()) as AskHansolResponse;
  if (!data.answer) {
    throw new Error("empty answer");
  }
  return { answer: data.answer, messageId: data.messageId ?? null };
}

/**
 * 답변 평가(별점·의견) 전송. 별점만/의견만/둘 다 가능하며 같은 답변엔 서버가 upsert 한다.
 * 실패해도 던지지 않고 false를 반환 — UI는 낙관적으로 처리한다.
 */
export async function submitAskHansolFeedback(input: {
  sessionId: string;
  messageId: string;
  rating?: number | null;
  comment?: string | null;
}): Promise<boolean> {
  if (!input.sessionId || !input.messageId) return false;
  try {
    const response = await fetch("/api/ask-hansol-feedback", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: input.sessionId,
        messageId: input.messageId,
        rating: input.rating ?? undefined,
        comment: input.comment ?? undefined,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function streamAnswerText(
  answerText: string,
  onChunk: (text: string, streaming: boolean) => void,
  onDone: () => void,
) {
  let index = 0;
  const tick = () => {
    index += Math.max(1, Math.floor(answerText.length / 80));
    const text = answerText.slice(0, index);
    const streaming = index < answerText.length;
    onChunk(text, streaming);
    if (streaming) {
      setTimeout(tick, 18);
    } else {
      onDone();
    }
  };
  tick();
}
