import { ASK_HANSOL_SESSION_STORAGE_KEY, isValidAskHansolSessionId } from "@/lib/ask-hansol/shared";

/** 저장된 세션 id 를 생성 없이 조회. 없으면 첫 방문 — 서버 히스토리가 있을 수 없다. */
export function peekAskHansolSessionId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const existing = window.localStorage.getItem(ASK_HANSOL_SESSION_STORAGE_KEY);
    return existing && isValidAskHansolSessionId(existing) ? existing : null;
  } catch {
    return null;
  }
}

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
