"use client";

// FAB(chatdock-fab) 스타일은 ChatDock 지연 청크가 로드되기 전에도 필요하므로 여기서 함께
// 로드한다(작은 CSS만 즉시 로드, react-markdown 등 무거운 JS는 ChatDock 청크에 그대로 지연).
import "@/styles/legacy/chatdock.css";
import { useCallback, useEffect, useState, type ComponentProps } from "react";
import { lazy } from "@/lib/lazy-dynamic";
import { onAskOpen, onSelectionAsk } from "@/components/ask-selection/selection-bridge";

const ChatDock = lazy(() =>
  import("@/components/portfolio/ask/ChatDock").then((m) => ({ default: m.ChatDock })),
);

type Props = ComponentProps<typeof ChatDock>;

/**
 * Ask Hansol — ChatDock 청크(react-markdown 등)는 FAB 클릭·페르소나 인라인·openSignal 때만 로드.
 * 홈 초기 방문에서 미사용 JS ~100KiB+ 절감.
 */
export function DeferredChatDock({
  defaultOpen,
  inline,
  openSignal,
  jdOpenSignal,
  adviceOpenSignal,
  ...rest
}: Props) {
  const [ready, setReady] = useState(false);
  const [openAfterLoad, setOpenAfterLoad] = useState(false);

  const mountDock = useCallback((open = false) => {
    if (open) setOpenAfterLoad(true);
    setReady(true);
  }, []);

  useEffect(() => {
    if (inline && defaultOpen) mountDock(true);
  }, [inline, defaultOpen, mountDock]);

  useEffect(() => {
    if (openSignal && openSignal > 0) mountDock(true);
  }, [openSignal, mountDock]);

  useEffect(() => {
    if (jdOpenSignal && jdOpenSignal > 0) mountDock(true);
  }, [jdOpenSignal, mountDock]);

  useEffect(() => {
    if (adviceOpenSignal && adviceOpenSignal > 0) mountDock(true);
  }, [adviceOpenSignal, mountDock]);

  // 드래그→질문 전역 브리지: 선택 질문이 오면 도크를 띄운다(FAB 상태인 /about 등 포함).
  useEffect(() => onSelectionAsk(() => mountDock(true)), [mountDock]);

  // "직접 물어보기" CTA 등 자동 전송 없이 도크만 여는 전역 신호.
  useEffect(() => onAskOpen(() => mountDock(true)), [mountDock]);

  if (!ready) {
    // 데스크톱 인라인(has-dock, ≥900px)에서는 CSS로 FAB이 숨겨지고 곧바로 인라인 도크가
    // 마운트된다. 모바일에서는 자동으로 열지 않고 FAB만 노출해 탭으로 열도록 한다.
    return (
      <button
        type="button"
        className="chatdock-fab"
        onClick={() => mountDock(true)}
        aria-label="Ask Hansol"
        data-no-translate
      >
        Ask <span className="fab-dot" />
      </button>
    );
  }

  return (
    <ChatDock
      defaultOpen={openAfterLoad || defaultOpen}
      inline={inline}
      openSignal={openSignal}
      jdOpenSignal={jdOpenSignal}
      adviceOpenSignal={adviceOpenSignal}
      {...rest}
    />
  );
}
