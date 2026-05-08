type AskHansolResponse = { answer?: string };

export type AskHansolPageContext = {
  view: "home" | "hire" | "collab" | "builder" | "curious";
  section?: string;
  hash?: string;
};

export type AskHansolHistoryMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export async function fetchAskHansolHistory(
  sessionId: string,
): Promise<AskHansolHistoryMessage[]> {
  if (!sessionId) return [];
  const response = await fetch(
    "/api/ask-hansol?sessionId=" + encodeURIComponent(sessionId),
  );
  if (!response.ok) return [];
  const data = (await response.json()) as { messages?: AskHansolHistoryMessage[] };
  return Array.isArray(data.messages) ? data.messages : [];
}

export async function askHansolViaApi(
  query: string,
  sessionId: string,
  pageContext?: AskHansolPageContext,
): Promise<string> {
  const response = await fetch("/api/ask-hansol", {
    method: "POST",
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
  return data.answer;
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
