"use client";

import { useCallback, useState } from "react";
import { useSiteData } from "@/components/portfolio/Atoms";
import { askHansolViaApi, type AskHansolPageContext, streamAnswerText } from "@/lib/ask-hansol/client";
import { getOrCreateAskHansolSessionId } from "@/lib/ask-hansol/browser-session";
import { ASK_HANSOL_FALLBACK_MESSAGE, ASK_HANSOL_SUGGESTIONS } from "@/lib/ask-hansol/shared";
import { renderMarkdownText } from "./render-markdown-text";

export function AskBox({ pageContext }: { pageContext?: AskHansolPageContext }) {
  const D = useSiteData();
  const [q, setQ] = useState("");
  const [a, setA] = useState<{
    q: string;
    text: string;
    streaming: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const suggestions = ASK_HANSOL_SUGGESTIONS;

  const ask = useCallback(
    async (query?: string) => {
      const finalQ = (query ?? q).trim();
      if (!finalQ) return;
      setLoading(true);
      setA({ q: finalQ, text: "", streaming: true });

      let answerText;
      try {
        answerText = await askHansolViaApi(finalQ, getOrCreateAskHansolSessionId(), pageContext);
      } catch {
        answerText = ASK_HANSOL_FALLBACK_MESSAGE;
      }

      streamAnswerText(
        answerText,
        (text, streaming) => setA({ q: finalQ, text, streaming }),
        () => setLoading(false),
      );
    },
    [q, pageContext],
  );

  return (
    <section className="ask">
      <div className="ask-head">
        <span>{D.portfolioCopy.ask.askHeaderLeft}</span>
        <span>{D.portfolioCopy.ask.askHeaderRight}</span>
      </div>
      <form
        className="ask-row"
        onSubmit={(e) => {
          e.preventDefault();
          ask();
        }}
      >
        <input
          className="ask-input"
          placeholder={D.portfolioCopy.ask.askInputPlaceholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        <button className="ask-submit" type="submit" disabled={loading}>
          {loading ? "..." : D.portfolioCopy.ask.askSendLabel}
        </button>
      </form>
      <div className="ask-suggestions">
        {suggestions.map((s, i) => (
          <button key={i} type="button" className="ask-chip" onClick={() => { setQ(s); ask(s); }}>
            {s}
          </button>
        ))}
      </div>
      {a && (
        <div className="ask-answer">
          <span className="meta">{D.portfolioCopy.ask.askMetaLabel}</span>
          {renderMarkdownText(a.text, a.streaming)}
        </div>
      )}
    </section>
  );
}
