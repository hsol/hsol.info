/**
 * Vercel Custom Events — 타입 안전 래퍼.
 *
 * track() 은 클라이언트 컴포넌트에서만 호출한다.
 * @vercel/analytics/react 는 <Analytics /> 마운트 후 큐를 비운다.
 */
import { track } from "@vercel/analytics/react";

// ─── 이벤트 스키마 ───────────────────────────────────────────────────────────

type AskTrigger = "fab" | "signal" | "selection" | "draft";
type AskSource = "input" | "suggestion" | "selection_ask";
type PersonaKey = "hire" | "collab" | "builder" | "curious";

type EventMap = {
  // ── Ask Hansol ──────────────────────────────────────────────────────────
  /** FAB·openSignal·selection·draft 등으로 도크가 열릴 때 */
  ask_open: { persona: PersonaKey | "home" | null; trigger: AskTrigger };
  /** × 버튼으로 도크가 닫힐 때 */
  ask_close: { persona: PersonaKey | "home" | null };
  /** 일반 질문 제출 */
  ask_submit: {
    persona: PersonaKey | "home" | null;
    source: AskSource;
    char_count: number;
  };
  /** JD 적합도 패널 열기 */
  ask_jd_panel_open: Record<string, never>;
  /** AI 자문 패널 열기 */
  ask_advice_panel_open: Record<string, never>;
  /** JD 적합도 분석 제출 */
  ask_jd_submit: { char_count: number };
  /** AI 자문 제출 */
  ask_advice_submit: { char_count: number };
  /** 도크 너비 드래그 완료 */
  ask_dock_resize: { width_px: number };
  /** 도크 너비 더블클릭 리셋 */
  ask_dock_resize_reset: Record<string, never>;
  // ── 답변 피드백 ──────────────────────────────────────────────────────────
  /** 별점 선택 */
  ask_feedback_rating: { rating: number };
  /** 코멘트 제출(별점 있을 수도 없을 수도) */
  ask_feedback_comment: { has_rating: boolean; has_comment: boolean };
  // ── 페르소나 ─────────────────────────────────────────────────────────────
  /** 홈에서 페르소나 선택 */
  persona_select: { persona: PersonaKey };
  // ── 텍스트 선택 Ask ──────────────────────────────────────────────────────
  /** 드래그 선택 후 "질문하기" 버튼 클릭 */
  selection_ask_click: Record<string, never>;
  // ── 이력서 ───────────────────────────────────────────────────────────────
  /** PDF 다운로드 링크 클릭 */
  resume_pdf_download: Record<string, never>;
  // ── 뉴스 ─────────────────────────────────────────────────────────────────
  /** 뉴스 카드 클릭 */
  news_article_click: { slug: string; section: string | null };
};

// ─── 타입 안전 track() ───────────────────────────────────────────────────────

export function trackEvent<K extends keyof EventMap>(
  event: K,
  ...args: EventMap[K] extends Record<string, never>
    ? []
    : [props: EventMap[K]]
): void {
  try {
    track(event, args[0] as Record<string, string | number | boolean>);
  } catch {
    // analytics 가 아직 로드되지 않았거나 개발 환경 — 조용히 무시
  }
}
