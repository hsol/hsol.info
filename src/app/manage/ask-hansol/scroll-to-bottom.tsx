"use client";

import { useEffect } from "react";

/**
 * 세션을 열면 chat UI 관례대로 마지막 메시지가 보이게 한다.
 * hash 가 있으면(permalink 진입) 아무것도 하지 않고 브라우저 기본 스크롤에 양보한다 —
 * 두 동작이 경쟁하면 안 된다.
 *
 * flex-direction: column-reverse 로 하면 JS 0줄이지만 DOM 에 메시지를 역순으로 심어야 해
 * 스크린리더 읽기 순서와 텍스트 드래그 복사가 뒤집힌다. 접근성을 CSS 트릭과 바꾸지 않는다.
 */
export function ScrollToBottom({ sessionId }: { sessionId: string }) {
  useEffect(() => {
    if (window.location.hash) return;
    document.getElementById("chat-end")?.scrollIntoView();
  }, [sessionId]); // 세션이 바뀌면 다시 바닥으로

  return <div id="chat-end" />;
}
