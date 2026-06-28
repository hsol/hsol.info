import { normalizeAskAnswerPlainText } from "@/lib/ask-hansol/answer-linkify";
import { chatText } from "@/lib/llm";

/**
 * 세션 메모리 롤업용 요약 머지. `refreshSessionMemoryRollup`에 콜백으로 넘긴다.
 * 대화형 Ask와 JD 적합도 분석이 같은 세션 메모리를 공유하므로 공용 모듈로 둔다.
 */
export async function summarizeMemoryMerge(
  existingSummary: string,
  chunk: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<string | null> {
  if (chunk.length === 0) return null;

  const formatted = chunk
    .map((m) => (m.role === "user" ? `방문자: ${m.content}` : `한솔: ${m.content}`))
    .join("\n\n");

  const userBlock = existingSummary.trim()
    ? `기존 세션 메모리(요약):\n${existingSummary.trim()}\n\n추가 대화 원문:\n${formatted}\n\n위를 하나의 메모리로 통합해 한국어 10문장 이내로 압축하세요. 주제·사실·방문자 관심만 남기고 덧붙임·중복·인사말은 제거하세요.`
    : `다음 대화를 한국어 10문장 이내로 요약해 세션 메모리로 만드세요:\n\n${formatted}`;

  const text = await chatText({
    model:
      process.env.AI_GATEWAY_MEMORY_MODEL ?? process.env.ANTHROPIC_MEMORY_MODEL ?? null,
    maxOutputTokens: 900,
    messages: [{ role: "user", content: userBlock }],
  });
  return text ? normalizeAskAnswerPlainText(text) : null;
}
