"use client";

import "@/styles/legacy/chatdock.css";
import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { useSiteData } from "@/components/portfolio/Atoms";
import {
  analyzeJobDescriptionViaApi,
  askHansolAdviceViaApi,
  askHansolSelectionViaApi,
  askHansolViaApi,
  type AskHansolAnswer,
  type AskHansolPageContext,
  fetchAskHansolHistory,
  streamAnswerText,
} from "@/lib/ask-hansol/client";
import {
  ASK_HANSOL_DOCK_WIDTH_MIN,
  clampAskHansolDockWidth,
  clearAskHansolDockWidth,
  getOrCreateAskHansolSessionId,
  peekAskHansolSessionId,
  readAskHansolDockWidth,
  writeAskHansolDockWidth,
} from "@/lib/ask-hansol/browser-session";
import {
  onAskOpen,
  onSelectionAsk,
  takePendingSelectionAsk,
} from "@/components/ask-selection/selection-bridge";
import { ASK_HANSOL_FALLBACK_MESSAGE, ASK_HANSOL_SUGGESTIONS } from "@/lib/ask-hansol/shared";
import type { AskDraft, ChatMsg } from "@/components/portfolio/portfolio-types";
import { useAskFeature } from "./ask-feature-context";
import { renderMarkdownText } from "./render-markdown-text";
import { AnswerFeedback } from "./AnswerFeedback";

export function ChatDock({
  defaultOpen = false,
  inline = false,
  pageContext,
  openSignal,
  draftToAsk,
}: {
  defaultOpen?: boolean;
  inline?: boolean;
  pageContext?: AskHansolPageContext;
  openSignal?: number;
  draftToAsk?: AskDraft | null;
}) {
  const D = useSiteData();
  const [open, setOpen] = useState(defaultOpen);
  const [q, setQ] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [historyReady, setHistoryReady] = useState(false);
  const [selectionDraft, setSelectionDraft] = useState<AskDraft | null>(null);
  const [resizing, setResizing] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scrollInnerRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const historyRequestedRef = useRef(false);
  const handledDraftIdRef = useRef<string | null>(null);
  const handledSubmitRef = useRef(0);
  const dockWidthRef = useRef<number | null>(null);

  // JD 적합도·자문 패널의 입력·활성·제출은 모달(AskFeatureDialog)과 공유한다(완전 싱크).
  const af = useAskFeature();

  /** JD 적합도 분석 기능은 채용 검토(Hire) 상세 화면에서만 노출한다. */
  const jdFeatureEnabled = pageContext?.view === "hire";
  /** 임한솔 시각 자문 기능은 협업 검토(Collab) 상세 화면에서만 노출한다. */
  const adviceFeatureEnabled = pageContext?.view === "collab";

  const suggestions = ASK_HANSOL_SUGGESTIONS;

  // 도크(시트) 너비는 --chatdock-width CSS 변수로 인라인 그리드·플로팅 두 모드가 공유한다.
  // 변수가 없으면 CSS 기본값(인라인 400px·플로팅 380px)을 그대로 쓴다.
  const applyDockWidth = useCallback((rawWidth: number) => {
    if (typeof window === "undefined") return null;
    // 조절 범위 안에서 클램프하고, 좁은 화면에선 92vw를 넘지 않게 한 번 더 제한한다.
    const viewportCap = Math.max(
      ASK_HANSOL_DOCK_WIDTH_MIN,
      Math.floor(window.innerWidth * 0.92),
    );
    const width = Math.min(clampAskHansolDockWidth(rawWidth), viewportCap);
    document.documentElement.style.setProperty("--chatdock-width", `${width}px`);
    dockWidthRef.current = width;
    return width;
  }, []);

  // 저장된(세션 페어) 너비를 세션 확정 시 1회 적용.
  useEffect(() => {
    if (!sessionId) return;
    const saved = readAskHansolDockWidth(sessionId);
    if (saved != null) applyDockWidth(saved);
  }, [sessionId, applyDockWidth]);

  // 좌측 손잡이 드래그로 너비 조절. 도크가 우측에 고정이라 너비 = 화면폭 − 커서X.
  const onResizeStart = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      const handle = e.currentTarget;
      handle.setPointerCapture(e.pointerId);
      setResizing(true);
      document.body.style.userSelect = "none";

      const onMove = (ev: PointerEvent) => {
        applyDockWidth(window.innerWidth - ev.clientX);
      };
      const onUp = () => {
        handle.removeEventListener("pointermove", onMove);
        handle.removeEventListener("pointerup", onUp);
        handle.removeEventListener("pointercancel", onUp);
        document.body.style.userSelect = "";
        setResizing(false);
        const sid = sessionId || peekAskHansolSessionId();
        if (sid && dockWidthRef.current != null) {
          writeAskHansolDockWidth(sid, dockWidthRef.current);
        }
      };
      handle.addEventListener("pointermove", onMove);
      handle.addEventListener("pointerup", onUp);
      handle.addEventListener("pointercancel", onUp);
    },
    [applyDockWidth, sessionId],
  );

  // 손잡이 더블클릭 → 기본 너비로 초기화(변수 제거 + 저장값 삭제).
  const onResizeReset = useCallback(() => {
    if (typeof window === "undefined") return;
    document.documentElement.style.removeProperty("--chatdock-width");
    dockWidthRef.current = null;
    const sid = sessionId || peekAskHansolSessionId();
    if (sid) clearAskHansolDockWidth(sid);
  }, [sessionId]);

  useEffect(() => {
    // StrictMode 이중 실행 가드 — 첫 실행이 세션을 새로 만들면 두 번째 실행이
    // "기존 세션"으로 오인해 불필요한 히스토리 fetch 를 날리는 것을 막는다.
    if (historyRequestedRef.current) return;
    historyRequestedRef.current = true;
    // 첫 방문(저장된 세션 없음)이면 서버 히스토리가 있을 수 없다 — fetch 없이 즉시 준비 완료.
    // 재방문만 로딩 상태를 거치므로 새 방문자는 로더를 아예 보지 않는다.
    const existing = peekAskHansolSessionId();
    const sid = existing ?? getOrCreateAskHansolSessionId();
    setSessionId(sid);
    if (!existing) {
      setHistoryReady(true);
      return;
    }
    void fetchAskHansolHistory(sid)
      .then((rows) => {
        if (rows.length === 0) return;
        const history = rows.map((row) => ({
          key: `db-${row.id}`,
          role: row.role === "assistant" ? ("hansol" as const) : ("user" as const),
          text: row.content,
          messageId: row.role === "assistant" ? row.id : null,
          rated: row.role === "assistant" ? Boolean(row.has_feedback) : false,
        }));
        // 로딩 중 사용자가 이미 보낸 로컬 메시지를 덮어쓰지 않도록 교체가 아니라 앞에 병합.
        // 같은 db 키는 걸러내 이펙트가 두 번 돌아도(StrictMode) 중복되지 않게 멱등 처리.
        const historyKeys = new Set(history.map((h) => h.key));
        setMessages((prev) => [
          ...history,
          ...prev.filter((m) => !historyKeys.has(m.key)),
        ]);
      })
      .finally(() => setHistoryReady(true));
  }, []);

  useEffect(() => {
    setOpen(defaultOpen);
  }, [defaultOpen]);

  useEffect(() => {
    if (typeof openSignal !== "number") return;
    if (openSignal <= 0) return;
    setOpen(true);
  }, [openSignal]);

  // 바닥 고정 스크롤 — 히스토리 로드·새 메시지·스트리밍은 물론, 마크다운 청크가 늦게
  // 로드되며 콘텐츠 높이가 자랄 때도 ResizeObserver 로 바닥을 유지한다(한 번만 내리면
  // 이후 높이 증가로 스크롤이 과거 대화 위쪽에 남는 문제가 있었다). 사용자가 위로
  // 스크롤해 과거 대화를 읽는 중에는 자동 스크롤로 방해하지 않는다.
  useEffect(() => {
    const el = scrollRef.current;
    const inner = scrollInnerRef.current;
    if (!el || !inner) return;
    const scrollToBottom = () => {
      if (stickToBottomRef.current) el.scrollTop = el.scrollHeight;
    };
    scrollToBottom();
    const observer = new ResizeObserver(scrollToBottom);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [open, historyReady]);

  // 답변 스트리밍이 끝나면(!streaming) messageId가 붙은 봇 메시지에만 평가 UI를 노출한다.
  const attachMessageId = useCallback((botKey: string, messageId: string | null) => {
    if (!messageId) return;
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.key === botKey);
      if (idx < 0) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], messageId };
      return next;
    });
  }, []);

  const ask = useCallback(
    async (query?: string, options?: { selectedText?: string }) => {
      // 히스토리 로딩(historyReady 이전)을 기다리지 않는다 — 로드 완료 시 병합되므로
      // 로딩 중 입력·전송도 안전하다. 입력을 막으면 초기 몇 초간 도크가 죽은 것처럼 보인다.
      const finalQ = (query ?? q).trim();
      if (!finalQ || loading) return;
      const sid = sessionId || getOrCreateAskHansolSessionId();
      if (!sessionId && sid) setSessionId(sid);
      setQ("");
      setLoading(true);
      const botKey = `local-h-${crypto.randomUUID()}`;
      setMessages((prev) => [
        ...prev,
        { key: `local-u-${crypto.randomUUID()}`, role: "user", text: finalQ },
        { key: botKey, role: "hansol", text: "", streaming: true },
      ]);

      let result: AskHansolAnswer;
      try {
        result = options?.selectedText
          ? await askHansolSelectionViaApi(options.selectedText, sid, pageContext)
          : await askHansolViaApi(finalQ, sid, pageContext);
      } catch {
        result = { answer: ASK_HANSOL_FALLBACK_MESSAGE, messageId: null };
      }

      attachMessageId(botKey, result.messageId);
      streamAnswerText(
        result.answer,
        (text, streaming) => {
          setMessages((prev) => {
            const next = [...prev];
            const idx = next.findIndex((m) => m.key === botKey);
            if (idx >= 0) next[idx] = { ...next[idx], text, streaming };
            return next;
          });
        },
        () => setLoading(false),
      );
    },
    [q, loading, sessionId, pageContext, attachMessageId],
  );

  useEffect(() => {
    if (!draftToAsk) return;
    if (handledDraftIdRef.current === draftToAsk.id) return;
    handledDraftIdRef.current = draftToAsk.id;
    setOpen(true);
    void ask(draftToAsk.displayQuery, { selectedText: draftToAsk.selectedText });
  }, [draftToAsk, ask]);

  // 전역 드래그→질문 브리지 구독(+ 마운트 전 발생분 1회 흡수).
  useEffect(() => {
    const queued = takePendingSelectionAsk();
    if (queued) setSelectionDraft(queued);
    return onSelectionAsk((draft) => {
      // 다른 도크 인스턴스가 중복 처리하지 않도록 즉시 비운다.
      takePendingSelectionAsk();
      setSelectionDraft(draft);
    });
  }, []);

  // "직접 물어보기" CTA — 자동 전송 없이 도크만 연다. 이미 마운트돼 닫혀 있어도 다시 열리게.
  useEffect(() => onAskOpen(() => setOpen(true)), []);

  useEffect(() => {
    if (!selectionDraft) return;
    if (handledDraftIdRef.current === selectionDraft.id) return;
    handledDraftIdRef.current = selectionDraft.id;
    setOpen(true);
    void ask(selectionDraft.displayQuery, { selectedText: selectionDraft.selectedText });
  }, [selectionDraft, ask]);

  const analyzeJd = useCallback(async () => {
    const finalJd = af.text.trim();
    if (finalJd.length < 40 || loading) return;
    const sid = sessionId || getOrCreateAskHansolSessionId();
    if (!sessionId && sid) setSessionId(sid);
    af.closePanel(); // 입력 비우고 패널을 닫는다(답변은 도크 대화로 스트리밍).
    setLoading(true);

    const preview = finalJd.length > 180 ? `${finalJd.slice(0, 180)}...` : finalJd;
    const userText = `채용 공고 적합도 분석을 부탁드려요.\n\n> ${preview.replace(/\n+/g, " ")}`;
    const botKey = `local-h-${crypto.randomUUID()}`;
    setMessages((prev) => [
      ...prev,
      { key: `local-u-${crypto.randomUUID()}`, role: "user", text: userText },
      { key: botKey, role: "hansol", text: "", streaming: true },
    ]);

    let result: AskHansolAnswer;
    try {
      result = await analyzeJobDescriptionViaApi(finalJd, sid, pageContext);
    } catch {
      result = { answer: ASK_HANSOL_FALLBACK_MESSAGE, messageId: null };
    }

    attachMessageId(botKey, result.messageId);
    streamAnswerText(
      result.answer,
      (text, streaming) => {
        setMessages((prev) => {
          const next = [...prev];
          const idx = next.findIndex((m) => m.key === botKey);
          if (idx >= 0) next[idx] = { ...next[idx], text, streaming };
          return next;
        });
      },
      () => setLoading(false),
    );
  }, [af, loading, sessionId, pageContext, attachMessageId]);

  const askAdvice = useCallback(async () => {
    const finalIssue = af.text.trim();
    if (finalIssue.length < 20 || loading) return;
    const sid = sessionId || getOrCreateAskHansolSessionId();
    if (!sessionId && sid) setSessionId(sid);
    af.closePanel();
    setLoading(true);

    const preview = finalIssue.length > 180 ? `${finalIssue.slice(0, 180)}...` : finalIssue;
    const userText = `이 이슈, 어떻게 보면 좋을지 의견을 듣고 싶어요.\n\n> ${preview.replace(/\n+/g, " ")}`;
    const botKey = `local-h-${crypto.randomUUID()}`;
    setMessages((prev) => [
      ...prev,
      { key: `local-u-${crypto.randomUUID()}`, role: "user", text: userText },
      { key: botKey, role: "hansol", text: "", streaming: true },
    ]);

    let result: AskHansolAnswer;
    try {
      result = await askHansolAdviceViaApi(finalIssue, sid, pageContext);
    } catch {
      result = { answer: ASK_HANSOL_FALLBACK_MESSAGE, messageId: null };
    }

    attachMessageId(botKey, result.messageId);
    streamAnswerText(
      result.answer,
      (text, streaming) => {
        setMessages((prev) => {
          const next = [...prev];
          const idx = next.findIndex((m) => m.key === botKey);
          if (idx >= 0) next[idx] = { ...next[idx], text, streaming };
          return next;
        });
      },
      () => setLoading(false),
    );
  }, [af, loading, sessionId, pageContext, attachMessageId]);

  // 제출 신호(모달·패널 공용) → 현재 활성 기능의 실제 분석/자문을 실행한다.
  useEffect(() => {
    if (af.submitSignal <= 0 || handledSubmitRef.current === af.submitSignal) return;
    handledSubmitRef.current = af.submitSignal;
    if (af.panelActive === "jd") void analyzeJd();
    else if (af.panelActive === "advice") void askAdvice();
  }, [af.submitSignal, af.panelActive, analyzeJd, askAdvice]);

  return (
    <>
      {!open && (
        <button
          type="button"
          className="chatdock-fab"
          onClick={() => setOpen(true)}
          aria-label="Ask Hansol"
          data-no-translate
        >
          <span className="fab-dot" />
          ASK
        </button>
      )}
      <aside
        className={"chatdock" + (open ? " is-open" : "") + (inline ? " is-inline" : "")}
        data-no-translate
      >
        <div
          className={"chatdock-resize" + (resizing ? " is-dragging" : "")}
          role="separator"
          aria-orientation="vertical"
          aria-label="시트 너비 조절 (드래그)"
          title="드래그해서 시트 너비 조절 · 더블클릭 시 기본값"
          onPointerDown={onResizeStart}
          onDoubleClick={onResizeReset}
        />
        <header className="chatdock-head">
          <div>
            <div className="chatdock-title">{D.portfolioCopy.ask.dockTitle}</div>
            <div className="chatdock-sub">{D.portfolioCopy.ask.dockSub}</div>
          </div>
          <button type="button" className="chatdock-x" onClick={() => setOpen(false)} aria-label="Close">
            ×
          </button>
        </header>
        <div
          className="chatdock-scroll"
          ref={scrollRef}
          onScroll={() => {
            const el = scrollRef.current;
            if (!el) return;
            // 바닥에서 48px 이내면 자동 스크롤 유지, 그 위로 올라가면 사용자가 읽는 중.
            stickToBottomRef.current =
              el.scrollHeight - el.scrollTop - el.clientHeight < 48;
          }}
        >
          <div className="chatdock-scroll-inner" ref={scrollInnerRef}>
          {!historyReady && messages.length === 0 && (
            <div className="chatdock-history-loading" role="status">
              <span className="chatdock-history-spinner" aria-hidden />
              이전 대화를 불러오는 중…
            </div>
          )}
          {historyReady && messages.length === 0 && (
            <div className="chatdock-empty">
              <div className="chatdock-empty-line">{D.portfolioCopy.ask.dockEmptyLine}</div>
              <p>{D.portfolioCopy.ask.dockEmptyIntro}</p>
              <div className="chatdock-suggest">
                {suggestions.map((s, i) => (
                  <button key={i} type="button" className="chatdock-chip" onClick={() => ask(s)}>
                    {s}
                  </button>
                ))}
              </div>
              {jdFeatureEnabled && (
                <button
                  type="button"
                  className="chatdock-jd-cta"
                  onClick={() => af.openPanel("jd")}
                >
                  채용 공고(JD) 붙여넣고 적합도 보기
                </button>
              )}
              {adviceFeatureEnabled && (
                <button
                  type="button"
                  className="chatdock-jd-cta"
                  onClick={() => af.openPanel("advice")}
                >
                  고민이 있으신가요? 제게 말씀해주세요.
                </button>
              )}
            </div>
          )}
          {messages.map((m) => (
            <div key={m.key} className={"chatdock-msg chatdock-msg--" + m.role}>
              {m.role === "hansol" && <div className="chatdock-msg-from">— Hansol</div>}
              <div className="chatdock-msg-body">{renderMarkdownText(m.text, m.streaming)}</div>
              {m.role === "hansol" && !m.streaming && m.messageId && !m.rated && sessionId && (
                <AnswerFeedback sessionId={sessionId} messageId={m.messageId} />
              )}
            </div>
          ))}
          </div>
        </div>
        {jdFeatureEnabled && af.panelActive === "jd" && (
          <div className="chatdock-jd-panel">
            <div className="chatdock-jd-head">
              <span className="chatdock-jd-title">채용 공고 적합도 분석</span>
              <button
                type="button"
                className="chatdock-jd-close"
                onClick={() => af.closePanel()}
                aria-label="JD 분석 닫기"
              >
                취소
              </button>
            </div>
            <textarea
              className="chatdock-jd-textarea"
              placeholder="채용 공고(JD) 전문을 붙여넣어 주세요. 주요 업무·자격 요건·우대 사항이 있으면 더 정확합니다."
              value={af.text}
              onChange={(e) => af.setText(e.target.value)}
              rows={6}
            />
            <button
              type="button"
              className="chatdock-jd-submit"
              onClick={() => af.requestSubmit()}
              disabled={loading || af.text.trim().length < 40}
            >
              {loading ? "분석 중..." : "적합도 분석하기"}
            </button>
          </div>
        )}
        {jdFeatureEnabled && af.panelActive !== "jd" && (
          <button
            type="button"
            className="chatdock-jd-toggle"
            onClick={() => af.openPanel("jd")}
          >
            채용 공고(JD) 적합도 분석
          </button>
        )}
        {adviceFeatureEnabled && af.panelActive === "advice" && (
          <div className="chatdock-jd-panel">
            <div className="chatdock-jd-head">
              <span className="chatdock-jd-title">임한솔의 AI 클론 의사결정 자문요청</span>
              <button
                type="button"
                className="chatdock-jd-close"
                onClick={() => af.closePanel()}
                aria-label="자문 닫기"
              >
                취소
              </button>
            </div>
            <textarea
              className="chatdock-jd-textarea"
              placeholder="고민 중인 이슈를 적어주세요. 배경·제약·목표·지금까지 시도한 것을 함께 적으면 더 깊이 짚어드려요. (예: 초기 팀에 PM을 따로 둬야 할까요? 상황은...)"
              value={af.text}
              onChange={(e) => af.setText(e.target.value)}
              rows={6}
            />
            <button
              type="button"
              className="chatdock-jd-submit"
              onClick={() => af.requestSubmit()}
              disabled={loading || af.text.trim().length < 20}
            >
              {loading ? "생각 중..." : "제 관점은요!"}
            </button>
          </div>
        )}
        {adviceFeatureEnabled && af.panelActive !== "advice" && (
          <button
            type="button"
            className="chatdock-jd-toggle"
            onClick={() => af.openPanel("advice")}
          >
            AI 자문 · 한솔님은 어떻게 보시나요?
          </button>
        )}
        <form
          className="chatdock-form"
          onSubmit={(e) => {
            e.preventDefault();
            ask();
          }}
        >
          <input
            className="chatdock-input"
            placeholder={D.portfolioCopy.ask.dockInputPlaceholder}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <button className="chatdock-send" type="submit" disabled={loading || !q.trim()}>
            {loading ? "..." : "↑"}
          </button>
        </form>
      </aside>
    </>
  );
}
