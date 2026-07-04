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

/** 도크(시트) 너비 조절 범위(px). 화면이 좁으면 적용 시점에 92vw로 한 번 더 제한한다. */
export const ASK_HANSOL_DOCK_WIDTH_MIN = 320;
export const ASK_HANSOL_DOCK_WIDTH_MAX = 720;

const DOCK_WIDTH_KEY_PREFIX = "ask-hansol-dock-width:";

export function clampAskHansolDockWidth(width: number): number {
  if (!Number.isFinite(width)) return ASK_HANSOL_DOCK_WIDTH_MIN;
  return Math.max(ASK_HANSOL_DOCK_WIDTH_MIN, Math.min(ASK_HANSOL_DOCK_WIDTH_MAX, Math.round(width)));
}

/** 세션 id 와 페어링해 저장한 도크 너비를 조회. 없거나 무효면 null(→ CSS 기본 너비 사용). */
export function readAskHansolDockWidth(sessionId: string): number | null {
  if (typeof window === "undefined" || !sessionId) return null;
  try {
    const raw = window.localStorage.getItem(DOCK_WIDTH_KEY_PREFIX + sessionId);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? clampAskHansolDockWidth(n) : null;
  } catch {
    return null;
  }
}

export function writeAskHansolDockWidth(sessionId: string, width: number): void {
  if (typeof window === "undefined" || !sessionId) return;
  try {
    window.localStorage.setItem(
      DOCK_WIDTH_KEY_PREFIX + sessionId,
      String(clampAskHansolDockWidth(width)),
    );
  } catch {
    /* 저장 실패해도 UI는 그대로 */
  }
}

/** 저장된 너비를 삭제(기본 너비로 복귀). */
export function clearAskHansolDockWidth(sessionId: string): void {
  if (typeof window === "undefined" || !sessionId) return;
  try {
    window.localStorage.removeItem(DOCK_WIDTH_KEY_PREFIX + sessionId);
  } catch {
    /* noop */
  }
}
