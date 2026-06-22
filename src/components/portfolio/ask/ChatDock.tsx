"use client";

import "@/styles/legacy/chatdock.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSiteData } from "@/components/portfolio/Atoms";
import {
  analyzeJobDescriptionViaApi,
  askHansolAdviceViaApi,
  askHansolSelectionViaApi,
  askHansolViaApi,
  type AskHansolPageContext,
  fetchAskHansolHistory,
  streamAnswerText,
} from "@/lib/ask-hansol/client";
import { getOrCreateAskHansolSessionId } from "@/lib/ask-hansol/browser-session";
import { onSelectionAsk, takePendingSelectionAsk } from "@/components/ask-selection/selection-bridge";
import { ASK_HANSOL_FALLBACK_MESSAGE, ASK_HANSOL_SUGGESTIONS } from "@/lib/ask-hansol/shared";
import type { AskDraft, ChatMsg } from "@/components/portfolio/portfolio-types";
import { renderMarkdownText } from "./render-markdown-text";

export function ChatDock({
  defaultOpen = false,
  inline = false,
  pageContext,
  openSignal,
  draftToAsk,
  jdOpenSignal,
  adviceOpenSignal,
}: {
  defaultOpen?: boolean;
  inline?: boolean;
  pageContext?: AskHansolPageContext;
  openSignal?: number;
  draftToAsk?: AskDraft | null;
  jdOpenSignal?: number;
  adviceOpenSignal?: number;
}) {
  const D = useSiteData();
  const [open, setOpen] = useState(defaultOpen);
  const [q, setQ] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [historyReady, setHistoryReady] = useState(false);
  const [jdMode, setJdMode] = useState(false);
  const [jdText, setJdText] = useState("");
  const [adviceMode, setAdviceMode] = useState(false);
  const [adviceText, setAdviceText] = useState("");
  const [selectionDraft, setSelectionDraft] = useState<AskDraft | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const handledDraftIdRef = useRef<string | null>(null);
  const handledJdSignalRef = useRef(0);
  const handledAdviceSignalRef = useRef(0);

  /** JD 적합도 분석 기능은 채용 검토(Hire) 상세 화면에서만 노출한다. */
  const jdFeatureEnabled = pageContext?.view === "hire";
  /** 임한솔 시각 자문 기능은 협업 검토(Collab) 상세 화면에서만 노출한다. */
  const adviceFeatureEnabled = pageContext?.view === "collab";

  const suggestions = ASK_HANSOL_SUGGESTIONS;

  useEffect(() => {
    const sid = getOrCreateAskHansolSessionId();
    setSessionId(sid);
    void fetchAskHansolHistory(sid)
      .then((rows) => {
        if (rows.length === 0) return;
        setMessages(
          rows.map((row) => ({
            key: `db-${row.id}`,
            role: row.role === "assistant" ? "hansol" : "user",
            text: row.content,
          })),
        );
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

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const id = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(id);
  }, [messages]);

  const ask = useCallback(
    async (query?: string, options?: { selectedText?: string }) => {
      const finalQ = (query ?? q).trim();
      if (!finalQ || loading || !historyReady) return;
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

      let answerText;
      try {
        answerText = options?.selectedText
          ? await askHansolSelectionViaApi(options.selectedText, sid, pageContext)
          : await askHansolViaApi(finalQ, sid, pageContext);
      } catch {
        answerText = ASK_HANSOL_FALLBACK_MESSAGE;
      }

      streamAnswerText(
        answerText,
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
    [q, loading, sessionId, historyReady, pageContext],
  );

  useEffect(() => {
    if (!draftToAsk || !historyReady) return;
    if (handledDraftIdRef.current === draftToAsk.id) return;
    handledDraftIdRef.current = draftToAsk.id;
    setOpen(true);
    void ask(draftToAsk.displayQuery, { selectedText: draftToAsk.selectedText });
  }, [draftToAsk, historyReady, ask]);

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

  useEffect(() => {
    if (!selectionDraft || !historyReady) return;
    if (handledDraftIdRef.current === selectionDraft.id) return;
    handledDraftIdRef.current = selectionDraft.id;
    setOpen(true);
    void ask(selectionDraft.displayQuery, { selectedText: selectionDraft.selectedText });
  }, [selectionDraft, historyReady, ask]);

  // Hire 상세의 "JD 적합도 분석" 진입점 — 도크를 열고 JD 작성 패널을 펼친다.
  // handledJdSignalRef로 같은 신호를 한 번만 처리해, Hire를 떠났다 돌아올 때
  // 오래된 신호로 패널이 다시 열리지 않게 한다.
  useEffect(() => {
    if (typeof jdOpenSignal !== "number" || jdOpenSignal <= 0) return;
    if (handledJdSignalRef.current === jdOpenSignal) return;
    if (!jdFeatureEnabled) return;
    handledJdSignalRef.current = jdOpenSignal;
    setOpen(true);
    setJdMode(true);
  }, [jdOpenSignal, jdFeatureEnabled]);

  const analyzeJd = useCallback(async () => {
    const finalJd = jdText.trim();
    if (finalJd.length < 40 || loading || !historyReady) return;
    const sid = sessionId || getOrCreateAskHansolSessionId();
    if (!sessionId && sid) setSessionId(sid);
    setJdText("");
    setJdMode(false);
    setLoading(true);

    const preview = finalJd.length > 180 ? `${finalJd.slice(0, 180)}…` : finalJd;
    const userText = `채용 공고 적합도 분석을 부탁드려요.\n\n> ${preview.replace(/\n+/g, " ")}`;
    const botKey = `local-h-${crypto.randomUUID()}`;
    setMessages((prev) => [
      ...prev,
      { key: `local-u-${crypto.randomUUID()}`, role: "user", text: userText },
      { key: botKey, role: "hansol", text: "", streaming: true },
    ]);

    let answerText;
    try {
      answerText = await analyzeJobDescriptionViaApi(finalJd, sid, pageContext);
    } catch {
      answerText = ASK_HANSOL_FALLBACK_MESSAGE;
    }

    streamAnswerText(
      answerText,
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
  }, [jdText, loading, sessionId, historyReady, pageContext]);

  // Collab 상세의 "임한솔 시각 자문" 진입점 — 도크를 열고 이슈 작성 패널을 펼친다.
  useEffect(() => {
    if (typeof adviceOpenSignal !== "number" || adviceOpenSignal <= 0) return;
    if (handledAdviceSignalRef.current === adviceOpenSignal) return;
    if (!adviceFeatureEnabled) return;
    handledAdviceSignalRef.current = adviceOpenSignal;
    setOpen(true);
    setAdviceMode(true);
  }, [adviceOpenSignal, adviceFeatureEnabled]);

  const askAdvice = useCallback(async () => {
    const finalIssue = adviceText.trim();
    if (finalIssue.length < 20 || loading || !historyReady) return;
    const sid = sessionId || getOrCreateAskHansolSessionId();
    if (!sessionId && sid) setSessionId(sid);
    setAdviceText("");
    setAdviceMode(false);
    setLoading(true);

    const preview = finalIssue.length > 180 ? `${finalIssue.slice(0, 180)}…` : finalIssue;
    const userText = `임한솔이라면 이 이슈를 어떻게 볼까요?\n\n> ${preview.replace(/\n+/g, " ")}`;
    const botKey = `local-h-${crypto.randomUUID()}`;
    setMessages((prev) => [
      ...prev,
      { key: `local-u-${crypto.randomUUID()}`, role: "user", text: userText },
      { key: botKey, role: "hansol", text: "", streaming: true },
    ]);

    let answerText;
    try {
      answerText = await askHansolAdviceViaApi(finalIssue, sid, pageContext);
    } catch {
      answerText = ASK_HANSOL_FALLBACK_MESSAGE;
    }

    streamAnswerText(
      answerText,
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
  }, [adviceText, loading, sessionId, historyReady, pageContext]);

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
        <header className="chatdock-head">
          <div>
            <div className="chatdock-title">{D.portfolioCopy.ask.dockTitle}</div>
            <div className="chatdock-sub">{D.portfolioCopy.ask.dockSub}</div>
          </div>
          <button type="button" className="chatdock-x" onClick={() => setOpen(false)} aria-label="Close">
            ×
          </button>
        </header>
        <div className="chatdock-scroll" ref={scrollRef}>
          {messages.length === 0 && (
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
                  onClick={() => setJdMode(true)}
                >
                  채용 공고(JD) 붙여넣고 적합도 보기
                </button>
              )}
              {adviceFeatureEnabled && (
                <button
                  type="button"
                  className="chatdock-jd-cta"
                  onClick={() => setAdviceMode(true)}
                >
                  이슈를 적고 “임한솔이라면?” 묻기
                </button>
              )}
            </div>
          )}
          {messages.map((m) => (
            <div key={m.key} className={"chatdock-msg chatdock-msg--" + m.role}>
              {m.role === "hansol" && <div className="chatdock-msg-from">— Hansol</div>}
              <div className="chatdock-msg-body">{renderMarkdownText(m.text, m.streaming)}</div>
            </div>
          ))}
        </div>
        {jdFeatureEnabled && jdMode && (
          <div className="chatdock-jd-panel">
            <div className="chatdock-jd-head">
              <span className="chatdock-jd-title">채용 공고 적합도 분석</span>
              <button
                type="button"
                className="chatdock-jd-close"
                onClick={() => {
                  setJdMode(false);
                  setJdText("");
                }}
                aria-label="JD 분석 닫기"
              >
                취소
              </button>
            </div>
            <textarea
              className="chatdock-jd-textarea"
              placeholder="채용 공고(JD) 전문을 붙여넣어 주세요. 주요 업무·자격 요건·우대 사항이 있으면 더 정확합니다."
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              rows={6}
            />
            <button
              type="button"
              className="chatdock-jd-submit"
              onClick={() => analyzeJd()}
              disabled={loading || jdText.trim().length < 40 || !historyReady}
            >
              {loading ? "분석 중…" : "적합도 분석하기"}
            </button>
          </div>
        )}
        {jdFeatureEnabled && !jdMode && (
          <button
            type="button"
            className="chatdock-jd-toggle"
            onClick={() => setJdMode(true)}
          >
            채용 공고(JD) 적합도 분석
          </button>
        )}
        {adviceFeatureEnabled && adviceMode && (
          <div className="chatdock-jd-panel">
            <div className="chatdock-jd-head">
              <span className="chatdock-jd-title">임한솔이라면? — 이슈 자문</span>
              <button
                type="button"
                className="chatdock-jd-close"
                onClick={() => {
                  setAdviceMode(false);
                  setAdviceText("");
                }}
                aria-label="자문 닫기"
              >
                취소
              </button>
            </div>
            <textarea
              className="chatdock-jd-textarea"
              placeholder="고민 중인 이슈를 적어주세요. 배경·제약·목표·지금까지 시도한 것을 함께 적으면 더 깊이 짚어드려요. (예: 초기 팀에 PM을 따로 둬야 할까요? 상황은…)"
              value={adviceText}
              onChange={(e) => setAdviceText(e.target.value)}
              rows={6}
            />
            <button
              type="button"
              className="chatdock-jd-submit"
              onClick={() => askAdvice()}
              disabled={loading || adviceText.trim().length < 20 || !historyReady}
            >
              {loading ? "생각 중…" : "임한솔 시각으로 보기"}
            </button>
          </div>
        )}
        {adviceFeatureEnabled && !adviceMode && (
          <button
            type="button"
            className="chatdock-jd-toggle"
            onClick={() => setAdviceMode(true)}
          >
            임한솔이라면? — 이슈 자문
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

          <button className="chatdock-send" type="submit" disabled={loading || !q.trim() || !historyReady}>
            {loading ? "…" : "↑"}
          </button>
        </form>
      </aside>
    </>
  );
}
