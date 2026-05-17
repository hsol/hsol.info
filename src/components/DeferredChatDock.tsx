"use client";

import { useCallback, useEffect, useState, type ComponentProps } from "react";
import { lazy } from "@/lib/lazy-dynamic";

const ChatDock = lazy(() =>
  import("@/components/portfolio/ask/ChatDock").then((m) => ({ default: m.ChatDock })),
);

type Props = ComponentProps<typeof ChatDock>;

/**
 * Ask Hansol — ChatDock 청크(react-markdown 등)는 FAB 클릭·페르소나 인라인·openSignal 때만 로드.
 * 홈 초기 방문에서 미사용 JS ~100KiB+ 절감.
 */
export function DeferredChatDock({ defaultOpen, inline, openSignal, ...rest }: Props) {
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

  if (!ready) {
    if (inline) return null;
    return (
      <button
        type="button"
        className="chatdock-fab"
        onClick={() => mountDock(true)}
        aria-label="Ask Hansol"
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
      {...rest}
    />
  );
}
