"use client";

import "@/components/ask-selection/selection-ask.css";

import { useCallback, useEffect, useState } from "react";
import {
  hasSelectionAskSubscriber,
  requestSelectionAsk,
} from "@/components/ask-selection/selection-bridge";

type Nudge = { text: string; x: number; y: number; placeAbove: boolean };

/**
 * 드래그(선택) → "질문하기" 넛지. 루트 레이아웃에 한 번 떠서 모든 라우트에서 동작한다.
 * 입력·버튼·편집영역과 Ask 도크/언어토글([data-no-translate]) 내부 선택은 제외한다.
 */
export function SelectionAsk() {
  const [nudge, setNudge] = useState<Nudge | null>(null);

  useEffect(() => {
    const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
    const extractElement = (node: Node | null): Element | null => {
      if (!node) return null;
      return node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
    };

    const update = () => {
      // 이 라우트에 답할 Ask 도크가 없으면(/architecture·/build-log 등) 넛지를 띄우지 않는다.
      if (!hasSelectionAskSubscriber()) {
        setNudge(null);
        return;
      }
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        setNudge(null);
        return;
      }
      const anchorEl = extractElement(sel.anchorNode);
      const focusEl = extractElement(sel.focusNode);
      if (!anchorEl || !focusEl) {
        setNudge(null);
        return;
      }
      const common = extractElement(sel.getRangeAt(0).commonAncestorContainer);
      if (
        common?.closest(
          "input, textarea, button, [contenteditable='true'], [data-no-translate], .chatdock",
        )
      ) {
        setNudge(null);
        return;
      }
      const text = normalize(sel.toString());
      if (!text || text.length < 4) {
        setNudge(null);
        return;
      }
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        setNudge(null);
        return;
      }
      const margin = 16;
      const x = Math.min(Math.max(rect.left + rect.width / 2, margin), window.innerWidth - margin);
      const placeAbove = rect.top > 88;
      const y = placeAbove ? rect.top - 10 : rect.bottom + 10;
      setNudge({ text, x, y, placeAbove });
    };

    const hide = () => setNudge(null);
    const schedule = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(update);
      });
    };
    const onMouseUp = () => schedule();
    const onKeyUp = () => schedule();

    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("keyup", onKeyUp);
    document.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);

    return () => {
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, []);

  const onAsk = useCallback(() => {
    if (!nudge) return;
    const selectedText = nudge.text;
    const preview =
      selectedText.length > 220 ? `${selectedText.slice(0, 220)}...` : selectedText;
    requestSelectionAsk({
      id: crypto.randomUUID(),
      displayQuery: `아래 인용문을 현재 페이지 문맥에 맞춰 보강 설명해 주세요.\n\n"${preview}"`,
      selectedText,
    });
    setNudge(null);
    window.getSelection()?.removeAllRanges();
  }, [nudge]);

  if (!nudge) return null;
  return (
    <div
      className={"selection-ask-nudge" + (nudge.placeAbove ? " is-above" : " is-below")}
      style={{ left: nudge.x, top: nudge.y }}
      role="dialog"
      aria-label="Ask Hansol nudging"
      data-no-translate
    >
      <div className="selection-ask-nudge-text">이 부분이 궁금하신가요?</div>
      <button type="button" className="selection-ask-nudge-btn" onClick={onAsk}>
        질문하기
      </button>
    </div>
  );
}
