export const ASK_HANSOL_FALLBACK_MESSAGE =
  "죄송해요, 답변을 못 가져왔어요. 직접 묻고 싶으시면 calendly.com/contact-hsol/coffee-chat 에서 시간을 잡아주세요.";

/** localStorage — 만료 없이 유지 */
export const ASK_HANSOL_SESSION_STORAGE_KEY = "ask-hansol-session-id";

/** `crypto.randomUUID()` 등 표준 UUID v4 */
const SESSION_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidAskHansolSessionId(id: unknown): id is string {
  return typeof id === "string" && id.length <= 64 && SESSION_ID_RE.test(id);
}

export const ASK_HANSOL_SUGGESTIONS = [
  "지금 무슨 일을 하나요?",
  "AI를 어떻게 쓰나요?",
  "강점이 뭐예요?",
  "코드도 짜시나요?",
  "어떤 회사와 잘 맞나요?",
] as const;
