type AskHansolResponse = { answer?: string };

export async function askHansolViaApi(query: string): Promise<string> {
  const response = await fetch("/api/ask-hansol", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
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
