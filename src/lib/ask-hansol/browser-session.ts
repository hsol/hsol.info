import { ASK_HANSOL_SESSION_STORAGE_KEY, isValidAskHansolSessionId } from "@/lib/ask-hansol/shared";

export function getOrCreateAskHansolSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(ASK_HANSOL_SESSION_STORAGE_KEY);
    if (existing && isValidAskHansolSessionId(existing)) return existing;
    const id = crypto.randomUUID();
    window.localStorage.setItem(ASK_HANSOL_SESSION_STORAGE_KEY, id);
    return id;
  } catch {
    return "";
  }
}
