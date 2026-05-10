export const COORDS: Record<string, string> = {
  hire: "A1",
  collab: "B1",
  builder: "B2",
  curious: "A2",
};

export type PersonaKey = "hire" | "collab" | "builder" | "curious";

export const PERSONA_PATH_KEYS: readonly PersonaKey[] = ["hire", "collab", "builder", "curious"];

/** `/`, `/hire` 등 단일 세그먼트만 처리. 알 수 없는 경로는 `null`(페이지에서 `notFound` 처리 권장). */
export function personaFromPathname(pathname: string | null | undefined): PersonaKey | null {
  if (!pathname) return null;
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length !== 1) return null;
  const k = parts[0] as PersonaKey;
  return PERSONA_PATH_KEYS.includes(k) ? k : null;
}

export type ChatMsg = {
  key: string;
  role: "user" | "hansol";
  text: string;
  streaming?: boolean;
};

export type AskDraft = {
  id: string;
  displayQuery: string;
  selectedText?: string;
};
