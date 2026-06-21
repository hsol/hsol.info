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

let pending: AskDraft | null = null;
const listeners = new Set<Listener>();

export function requestSelectionAsk(draft: AskDraft): void {
  pending = draft;
  listeners.forEach((listener) => listener(draft));
}

export function onSelectionAsk(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function takePendingSelectionAsk(): AskDraft | null {
  const draft = pending;
  pending = null;
  return draft;
}
