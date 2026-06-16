import { normalizeAskAnswerPlainText } from "@/lib/ask-hansol/answer-linkify";

/**
 * 세션 메모리 롤업용 요약 머지. `refreshSessionMemoryRollup`에 콜백으로 넘긴다.
 * 대화형 Ask와 JD 적합도 분석이 같은 세션 메모리를 공유하므로 공용 모듈로 둔다.
 */
export async function summarizeMemoryMerge(
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
  return text ? normalizeAskAnswerPlainText(text) : null;
}
