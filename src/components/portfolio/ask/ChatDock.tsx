"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSiteData } from "@/components/portfolio/Atoms";
import {
  askHansolSelectionViaApi,
  askHansolViaApi,
  type AskHansolPageContext,
  fetchAskHansolHistory,
  streamAnswerText,
} from "@/lib/ask-hansol/client";
import { getOrCreateAskHansolSessionId } from "@/lib/ask-hansol/browser-session";
import { ASK_HANSOL_FALLBACK_MESSAGE, ASK_HANSOL_SUGGESTIONS } from "@/lib/ask-hansol/shared";
import type { AskDraft, ChatMsg } from "@/components/portfolio/portfolio-types";
import { renderMarkdownText } from "./render-markdown-text";

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
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const handledDraftIdRef = useRef<string | null>(null);

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
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
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

  return (
    <>
      {!open && (
        <button type="button" className="chatdock-fab" onClick={() => setOpen(true)} aria-label="Ask Hansol">
          <span className="fab-dot" />
          ASK
        </button>
      )}
      <aside className={"chatdock" + (open ? " is-open" : "") + (inline ? " is-inline" : "")}>
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
            </div>
          )}
          {messages.map((m) => (
            <div key={m.key} className={"chatdock-msg chatdock-msg--" + m.role}>
              {m.role === "hansol" && <div className="chatdock-msg-from">— Hansol</div>}
              <div className="chatdock-msg-body">{renderMarkdownText(m.text, m.streaming)}</div>
            </div>
          ))}
        </div>
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
