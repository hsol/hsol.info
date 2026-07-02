"use client";

import { requestAskOpen } from "@/components/ask-selection/selection-bridge";

/**
 * 기사 클론 인터뷰 하단 "직접 물어보기" CTA. 홈으로 가지 않고 같은 페이지의 Ask Hansol
 * 도크(DeferredChatDock)를 연다. 질문 자동 전송 없이 빈 입력 상태로 떠 사용자가 직접 친다.
 */
export function AskHansolCta() {
  return (
    <button type="button" className="news-clone-cta-btn" onClick={() => requestAskOpen()}>
      Ask Hansol에게 직접 물어보기 →
    </button>
  );
}
