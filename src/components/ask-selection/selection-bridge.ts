import type { AskDraft } from "@/components/portfolio/portfolio-types";

/**
 * 드래그(선택) → Ask Hansol 전역 브리지.
 *
 * 선택 넛지(SelectionAsk)는 루트 레이아웃에 한 번 떠서 어느 라우트에서든 동작하고,
 * 실제로 답하는 Ask 도크(ChatDock)는 페이지마다 따로 마운트된다. 둘을 props로 잇기 어려워
 * 이 모듈 브리지로 연결한다.
 *
 * - requestSelectionAsk: 넛지의 "질문하기"가 호출. 대기 draft를 보관하고 구독자에게 통지.
 * - onSelectionAsk: 마운트된 도크(ChatDock/DeferredChatDock)가 구독. 즉시 반응.
 * - takePendingSelectionAsk: 도크가 (구독 전 발생분 포함) 대기 draft를 1회 흡수하고 비운다.
 */

type Listener = (draft: AskDraft) => void;
type OpenListener = () => void;

let pending: AskDraft | null = null;
const listeners = new Set<Listener>();
const openListeners = new Set<OpenListener>();

export function requestSelectionAsk(draft: AskDraft): void {
  pending = draft;
  listeners.forEach((listener) => listener(draft));
}

/**
 * 질문 자동 전송 없이 Ask 도크만 연다(예: "직접 물어보기" CTA).
 * requestSelectionAsk 와 달리 draft 를 남기지 않아 도크가 빈 입력 상태로 떠 사용자가 직접 친다.
 */
export function requestAskOpen(): void {
  openListeners.forEach((listener) => listener());
}

export function onAskOpen(listener: OpenListener): () => void {
  openListeners.add(listener);
  return () => {
    openListeners.delete(listener);
  };
}

export function onSelectionAsk(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * 지금 라우트에 답할 Ask 도크가 마운트돼 있는지(=구독자 존재).
 * 도크가 없는 페이지(/architecture, /build-log 등)에서는 넛지를 띄우지 않기 위해 본다.
 */
export function hasSelectionAskSubscriber(): boolean {
  return listeners.size > 0;
}

export function takePendingSelectionAsk(): AskDraft | null {
  const draft = pending;
  pending = null;
  return draft;
}
