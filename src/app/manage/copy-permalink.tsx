"use client";

import { useState } from "react";

/**
 * 이 메시지의 permalink 를 클립보드에 복사한다.
 * 현재 URL 의 hash 만 갈아끼우므로 ?session·?page 가 저절로 보존된다 —
 * ?session 만 넣으면 링크를 받은 쪽이 LNB 1페이지를 보게 되어 정작 그 세션이 목록에 없다.
 */
export function CopyPermalink({ messageId }: { messageId: string }) {
  const [state, setState] = useState<"idle" | "done" | "fail">("idle");

  async function copy() {
    try {
      const url = new URL(window.location.href);
      url.hash = `m-${messageId}`;
      await navigator.clipboard.writeText(url.toString());
      setState("done");
    } catch {
      // 비-HTTPS 등에서 clipboard API 가 없을 수 있다. 조용히 넘기지 않고 알린다.
      setState("fail");
    }
    setTimeout(() => setState("idle"), 1500);
  }

  return (
    <button type="button" className="manage-copy" onClick={copy}>
      {state === "done" ? "복사됨" : state === "fail" ? "복사 실패" : "링크 복사"}
    </button>
  );
}
