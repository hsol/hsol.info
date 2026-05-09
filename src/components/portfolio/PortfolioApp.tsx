"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Back,
  CareerList,
  CoffeeCTA,
  Foot,
  Pillars,
  Plate,
  PlanDiagram,
  SecHead,
  SiteDataProvider,
  useSiteData,
} from "@/components/portfolio/Atoms";
import type { SiteData } from "@/content/schema";
import { useMermaid } from "react-x-mermaid";
import { splitTextForAskHansolLinks } from "@/lib/ask-hansol/answer-linkify";
import {
  askHansolViaApi,
  type AskHansolPageContext,
  fetchAskHansolHistory,
  streamAnswerText,
} from "@/lib/ask-hansol/client";
import { getOrCreateAskHansolSessionId } from "@/lib/ask-hansol/browser-session";
import {
  ASK_HANSOL_FALLBACK_MESSAGE,
  ASK_HANSOL_SUGGESTIONS,
} from "@/lib/ask-hansol/shared";

const COORDS: Record<string, string> = {
  hire: "A1",
  collab: "B1",
  builder: "B2",
  curious: "A2",
};

type PersonaKey = "hire" | "collab" | "builder" | "curious";

/** `.shell` 안의 `[data-ask-section]` 중 뷰포트와 겹침이 가장 큰 블록 id를 Ask API `pageContext.detail`로 넘깁니다. */
function useReportAskVisibleSection(
  shellRef: React.RefObject<HTMLDivElement | null>,
  viewKey: string,
  onPick: (detail: string | undefined) => void,
) {
  useEffect(() => {
    const root = shellRef.current;
    if (!root) return;

    const nodes = root.querySelectorAll<HTMLElement>("[data-ask-section]");
    if (nodes.length === 0) {
      onPick(undefined);
      return;
    }

    const ratios = new Map<Element, number>();
    const apply = () => {
      let bestEl: Element | null = null;
      let best = -1;
      for (const el of nodes) {
        const v = ratios.get(el) ?? 0;
        if (v > best) {
          best = v;
          bestEl = el;
        }
      }
      const label = bestEl?.getAttribute("data-ask-section")?.trim();
      onPick(label || undefined);
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          ratios.set(e.target, e.intersectionRatio);
        }
        apply();
      },
      { root: null, threshold: [0, 0.05, 0.15, 0.35, 0.55, 0.75, 1] },
    );
    nodes.forEach((n) => io.observe(n));
    apply();

    return () => {
      io.disconnect();
      ratios.clear();
    };
  }, [shellRef, viewKey, onPick]);
}

function renderTitleLines(lines: string[]): ReactNode {
  return (
    <>
      {lines.map((line, idx) => (
        <span key={`${line}-${idx}`}>
          {line}
          {idx < lines.length - 1 ? <br /> : null}
        </span>
      ))}
    </>
  );
}

function MermaidDiagram({ chart }: { chart: string }) {
  const chartText = useMemo(() => {
    const s = chart.trim();
    if (!s) return "graph LR; EMPTY[No diagram data];";
    // react-x-mermaid/mermaid 파서 안정화를 위해 라벨 내부 \n 이스케이프는 공백으로 평탄화
    return s.replace(/\\n/g, " ").replace(/\r\n/g, "\n");
  }, [chart]);
  const mermaidConfig = useMemo(
    () => ({
      theme: "base" as const,
      securityLevel: "strict" as const,
      startOnLoad: false,
      suppressErrorRendering: true,
      fontFamily: "JetBrains Mono, LINE Seed KR, sans-serif",
      themeVariables: {
        background: "#14384f",
        primaryColor: "#0e2a3d",
        primaryBorderColor: "#3d7a9c",
        primaryTextColor: "#f2f7fa",
        lineColor: "#7fb4d0",
        secondaryColor: "#123247",
        tertiaryColor: "#183f58",
        edgeLabelBackground: "#14384f",
      },
      flowchart: {
        htmlLabels: false,
        curve: "linear" as const,
        useMaxWidth: true,
      },
    }),
    [],
  );
  const { ref, error } = useMermaid(chartText, mermaidConfig);

  return (
    <div className="home-built-mermaid-wrap" aria-label="How this site works diagram">
      <div className="home-built-mermaid-head">Mermaid Diagram</div>
      <div className="home-built-mermaid" ref={ref} />
      {error ? <pre className="home-built-mermaid-fallback">{error}</pre> : null}
    </div>
  );
}

// ============================================================
// HOME
// ============================================================
function Home({ onPick }: { onPick: (key: PersonaKey) => void }) {
  const D = useSiteData();
  const [hovered, setHovered] = useState<PersonaKey | null>(null);
  const [autoIdx, setAutoIdx] = useState(0);
  const lastInteractRef = useRef(0);
  const bumpInteract = useCallback(() => {lastInteractRef.current = Date.now();}, []);
  useEffect(() => {
    const keys = D.personas.map((p) => p.key);
    const tick = setInterval(() => {
      // pause auto-loop if user is hovering or interacted in the last 1s
      if (hovered) return;
      if (Date.now() - lastInteractRef.current < 1000) return;
      setAutoIdx((i) => (i + 1) % keys.length);
    }, 1600);
    return () => clearInterval(tick);
  }, [hovered, D.personas]);
  const activeKey: PersonaKey = hovered ?? (D.personas[autoIdx].key as PersonaKey);
  return (
    <div className="view" onMouseMove={bumpInteract} onClick={bumpInteract} onKeyDown={bumpInteract}>
      <Plate />

      <section className="hero" data-ask-section="home/hero">
        <div className="hero-left">
          <div>
            <div className="hero-eyebrow">
              <span className="axis"></span>
              {D.portfolioCopy.home.heroEyebrow}
            </div>
            <h1 className="hero-title">
              {D.portfolioCopy.home.heroTitleLines.map((line, idx) => (
                <span className="blk" key={`${line}-${idx}`}>
                  {idx === D.portfolioCopy.home.heroTitleLines.length - 1 ? <span className="hi">{line}</span> : line}
                </span>
              ))}
            </h1>
            <p className="hero-sub">
              {D.portfolioCopy.home.heroSubLead}
              <span className="em"> {D.portfolioCopy.home.heroSubEmphasis}</span>{" "}
              {D.portfolioCopy.home.heroSubTail}
            </p>
          </div>
          <div className="hero-meta">
            <span><b>{D.portfolioCopy.home.heroMetaSinceLabel}</b> {D.portfolioCopy.home.heroMetaSinceValue}</span>
            <span><b>{D.portfolioCopy.home.heroMetaNowLabel}</b> {D.portfolioCopy.home.heroMetaNowValue}</span>
            <span><b>{D.portfolioCopy.home.heroMetaBaseLabel}</b> {D.portfolioCopy.home.heroMetaBaseValue}</span>
          </div>
        </div>
        <PlanDiagram
          onPick={(k) => onPick(k as PersonaKey)}
          hovered={activeKey}
          onHover={(k) => setHovered(k as PersonaKey | null)}
        />
      </section>

      <section className="doors" data-ask-section="home/doors">
        <div className="doors-head">
          <h2 className="doors-h">{D.portfolioCopy.home.doorsTitle}</h2>
          <div className="doors-meta">{D.portfolioCopy.home.doorsMeta}</div>
        </div>
        <div className="doors-list">
          {D.personas.map((p) =>
          <button
            className={"persona" + (activeKey === p.key ? " is-hover" : "")}
            key={p.key}
            onClick={() => onPick(p.key as PersonaKey)}
            onMouseEnter={() => {
              setHovered(p.key as PersonaKey);
              bumpInteract();
            }}
            onMouseLeave={() => setHovered(null)}>
              <div className="persona-mark">
                <span className="lbl">No.</span>
                <span>{p.mark}</span>
              </div>
              <div className="persona-body">
                <div className="persona-title">{p.title}</div>
                <div className="persona-hint">{p.hint}</div>
              </div>
              <div className="persona-coord">{COORDS[p.key]}</div>
              <div className="persona-arrow">→</div>
            </button>
          )}
        </div>
      </section>

      <section className="home-built" data-ask-section="home/built">
        <div className="home-built-head">
          <h2 className="home-built-h">{D.portfolioCopy.home.builtTitle}</h2>
          <div className="home-built-meta">{D.portfolioCopy.home.builtMeta}</div>
        </div>
        <p className="home-built-body">{D.portfolioCopy.home.builtBody}</p>
        <div className="home-built-grid">
          {D.portfolioCopy.home.builtCards.map((card) => (
            <article className="home-built-card" key={card.title}>
              <h3 className="home-built-card-title">{card.title}</h3>
              <p className="home-built-card-body">{card.body}</p>
            </article>
          ))}
        </div>
        <MermaidDiagram chart={D.portfolioCopy.home.builtMermaid} />
        <div className="home-built-perspectives">
          <div className="home-built-perspectives-head">
            <h3 className="home-built-perspectives-title">{D.portfolioCopy.home.builtPerspectiveTitle}</h3>
            <div className="home-built-perspectives-meta">{D.portfolioCopy.home.builtPerspectiveMeta}</div>
          </div>
          <div className="home-built-perspectives-grid">
            {D.portfolioCopy.home.builtPerspectives.map((item) => (
              <article className="home-built-perspective" key={item.title}>
                <h4 className="home-built-perspective-title">{item.title}</h4>
                <p className="home-built-perspective-summary">{item.summary}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="coffee" data-ask-section="home/coffee">
        <div className="coffee-card">
          <div className="coffee-quote">“</div>
          <div className="coffee-body">
            <div className="coffee-eyebrow">{D.portfolioCopy.home.coffeeEyebrow}</div>
            <h3 className="coffee-h">{D.portfolioCopy.home.coffeeTitle}</h3>
            <p className="coffee-p">{D.portfolioCopy.home.coffeeBody}</p>
            <div className="coffee-cta">
              <a className="coffee-btn" href={D.identity.calendly} target="_blank" rel="noopener">
                {D.portfolioCopy.home.coffeeButtonLabel} <span className="arr">→</span>
              </a>
              <a className="coffee-link" href={"mailto:" + D.identity.email}>{D.identity.email}</a>
            </div>
          </div>
          <div className="coffee-photo">
            <Image src="/hansol.png" alt={D.identity.name} width={280} height={280} />
          </div>
        </div>
      </section>
    </div>);

}

// ============================================================
// ChatDock — persistent floating sidebar across all views
// ============================================================
type ChatMsg = {
  key: string;
  role: "user" | "hansol";
  text: string;
  streaming?: boolean;
};

function renderTextWithLinks(text: string): ReactNode[] {
  return splitTextForAskHansolLinks(text)
    .filter((p) => p.value.length > 0)
    .map((part, i) =>
      part.kind === "link" ? (
        <a key={`lnk-${i}`} href={part.value} target="_blank" rel="noopener noreferrer">
          {part.value}
        </a>
      ) : (
        <span key={`txt-${i}`}>{part.value}</span>
      ),
    );
}

function ChatDock({
  defaultOpen = false,
  inline = false,
  pageContext,
}: {
  defaultOpen?: boolean;
  inline?: boolean;
  pageContext?: AskHansolPageContext;
}) {
  const D = useSiteData();
  const [open, setOpen] = useState(defaultOpen);
  const [q, setQ] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [historyReady, setHistoryReady] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

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
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const ask = useCallback(async (query?: string) => {
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
      answerText = await askHansolViaApi(finalQ, sid, pageContext);
    } catch (e) {
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
  }, [q, loading, sessionId, historyReady, pageContext]);

  return (
    <>
      {!open && (
        <button
          type="button"
          className="chatdock-fab"
          onClick={() => setOpen(true)}
          aria-label="Ask Hansol"
        >
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
          <button className="chatdock-x" onClick={() => setOpen(false)} aria-label="Close">×</button>
        </header>
        <div className="chatdock-scroll" ref={scrollRef}>
          {messages.length === 0 &&
          <div className="chatdock-empty">
              <div className="chatdock-empty-line">{D.portfolioCopy.ask.dockEmptyLine}</div>
              <p>{D.portfolioCopy.ask.dockEmptyIntro}</p>
              <div className="chatdock-suggest">
                {suggestions.map((s, i) =>
              <button key={i} className="chatdock-chip" onClick={() => ask(s)}>{s}</button>
              )}
              </div>
            </div>
          }
          {messages.map((m) =>
          <div key={m.key} className={"chatdock-msg chatdock-msg--" + m.role}>
              {m.role === 'hansol' && <div className="chatdock-msg-from">— Hansol</div>}
              <div className="chatdock-msg-body">
                <span className={m.streaming ? "cursor-blink" : ""}>{renderTextWithLinks(m.text)}</span>
              </div>
            </div>
          )}
        </div>
        <form className="chatdock-form" onSubmit={(e) => {e.preventDefault();ask();}}>
          <input
            className="chatdock-input"
            placeholder={D.portfolioCopy.ask.dockInputPlaceholder}
            value={q}
            onChange={(e) => setQ(e.target.value)} />
          
          <button className="chatdock-send" type="submit" disabled={loading || !q.trim() || !historyReady}>
            {loading ? "…" : "↑"}
          </button>
        </form>
      </aside>
    </>);

}

// ============================================================
// AskBox
// ============================================================
function AskBox({ pageContext }: { pageContext?: AskHansolPageContext }) {
  const D = useSiteData();
  const [q, setQ] = useState("");
  const [a, setA] = useState<{
    q: string;
    text: string;
    streaming: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const suggestions = ASK_HANSOL_SUGGESTIONS;


  const ask = useCallback(async (query?: string) => {
    const finalQ = (query ?? q).trim();
    if (!finalQ) return;
    setLoading(true);
    setA({ q: finalQ, text: "", streaming: true });

    let answerText;
    try {
      answerText = await askHansolViaApi(
        finalQ,
        getOrCreateAskHansolSessionId(),
        pageContext,
      );
    } catch (e) {
      answerText = ASK_HANSOL_FALLBACK_MESSAGE;
    }

    streamAnswerText(
      answerText,
      (text, streaming) => setA({ q: finalQ, text, streaming }),
      () => setLoading(false),
    );
  }, [q, pageContext]);

  return (
    <section className="ask">
      <div className="ask-head">
        <span>{D.portfolioCopy.ask.askHeaderLeft}</span>
        <span>{D.portfolioCopy.ask.askHeaderRight}</span>
      </div>
      <form className="ask-row" onSubmit={(e) => {e.preventDefault();ask();}}>
        <input
          className="ask-input"
          placeholder={D.portfolioCopy.ask.askInputPlaceholder}
          value={q}
          onChange={(e) => setQ(e.target.value)} />
        
        <button className="ask-submit" type="submit" disabled={loading}>
          {loading ? "..." : D.portfolioCopy.ask.askSendLabel}
        </button>
      </form>
      <div className="ask-suggestions">
        {suggestions.map((s, i) =>
        <button key={i} className="ask-chip" onClick={() => {setQ(s);ask(s);}}>{s}</button>
        )}
      </div>
      {a &&
      <div className="ask-answer">
          <span className="meta">{D.portfolioCopy.ask.askMetaLabel}</span>
          <span className={a.streaming ? "cursor-blink" : ""}>{renderTextWithLinks(a.text)}</span>
        </div>
      }
    </section>);

}

// ============================================================
// Persona view shells with header bar
// ============================================================
function ViewHead({
  room,
  coord,
  title,
  lede,
}: {
  room: string;
  coord: string;
  title: ReactNode;
  lede: string;
}) {
  return (
    <div className="view-head">
      <div className="view-head-bar">
        <div className="room">{room}</div>
        <div className="scale">— hsol.info</div>
        <div className="coord">GRID {coord}</div>
      </div>
      <div className="view-head-body">
        <h1 className="view-title">{title}</h1>
        <p className="view-lede">{lede}</p>
      </div>
    </div>);

}

// ---------- 01 HIRE ----------
function HireView({ onBack }: { onBack: () => void }) {
  const D = useSiteData();
  const tier1 = D.career.filter((c) => c.tier === 1);
  return (
    <div className="view">
      <Back onBack={onBack} />
      <ViewHead
        room="01 · HIRE"
        coord="A1"
        title={renderTitleLines(D.viewHeaders.hire.titleLines)}
        lede={D.viewHeaders.hire.lede} />
      
      <div className="sec" data-ask-section="hire/strengths">
        <SecHead title="Strengths" num="01" meta="3 pillars" />
        <Pillars />
      </div>
      <div className="sec" data-ask-section="hire/experience">
        <SecHead title="Selected experience" num="02" meta={`${tier1.length} roles`} />
        <CareerList items={tier1} />
      </div>
      <div className="sec" data-ask-section="hire/facts">
        <SecHead title="Facts" num="03" meta="basic" />
        <div className="facts">
          <div className="fact"><div className="fact-label">{D.portfolioCopy.hire.factsYearsLabel}</div><div className="fact-value">{D.portfolioCopy.hire.factsYearsValue}</div></div>
          <div className="fact"><div className="fact-label">{D.portfolioCopy.hire.factsBaseLabel}</div><div className="fact-value">{D.identity.location}</div></div>
          <div className="fact"><div className="fact-label">{D.portfolioCopy.hire.factsEducationLabel}</div><div className="fact-value">{D.education[0].school} · {D.education[0].degree}</div></div>
          <div className="fact"><div className="fact-label">{D.portfolioCopy.hire.factsLanguagesLabel}</div><div className="fact-value">{D.languages.map((l) => `${l.name}(${l.level.split(' ')[0]})`).join(' · ')}</div></div>
        </div>
      </div>
      <CoffeeCTA
        title={D.portfolioCopy.hire.coffee.title}
        sub={D.portfolioCopy.hire.coffee.sub} />
      
    </div>);

}

// ---------- 02 COLLAB ----------
function CollabView({ onBack }: { onBack: () => void }) {
  const D = useSiteData();
  return (
    <div className="view">
      <Back onBack={onBack} />
      <ViewHead
        room="02 · COLLAB"
        coord="B1"
        title={renderTitleLines(D.viewHeaders.collab.titleLines)}
        lede={D.viewHeaders.collab.lede} />
      
      <div className="sec" data-ask-section="collab/building">
        <SecHead title="What I'm building now" num="01" meta="active" />
        <CareerList items={D.career.filter((c) => c.period.includes("현재"))} />
      </div>
      <div className="sec" data-ask-section="collab/methods">
        <SecHead title="How I work" num="02" meta="approach" />
        <div className="pillars">
          {D.portfolioCopy.collab.methods.map((method) => (
            <div className="pillar" key={method.no}>
              <div className="pillar-no">{method.no}</div>
              <div className="pillar-name">{method.name}</div>
              <div className="pillar-en">{method.en}</div>
              <div className="pillar-blurb">{method.blurb}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="sec" data-ask-section="collab/advisory">
        <SecHead title="Past advisory" num="03" meta="reference" />
        <CareerList items={D.career.filter((c) => (c.tags || []).includes("자문") || c.org === "Antler")} />
      </div>
      <CoffeeCTA
        title={D.portfolioCopy.collab.coffee.title}
        sub={D.portfolioCopy.collab.coffee.sub} />
      
    </div>);

}

// ---------- 03 BUILDER ----------
function BuilderView({ onBack }: { onBack: () => void }) {
  const D = useSiteData();
  return (
    <div className="view">
      <Back onBack={onBack} />
      <ViewHead
        room="03 · BUILDER"
        coord="B2"
        title={renderTitleLines(D.viewHeaders.builder.titleLines)}
        lede={D.viewHeaders.builder.lede} />
      
      <div className="sec" data-ask-section="builder/stack">
        <SecHead title="Stack & domain" num="01" meta="practical" />
        <div className="facts">
          {D.portfolioCopy.builder.facts.map((fact) => (
            <div className="fact" key={fact.label}>
              <div className="fact-label">{fact.label}</div>
              <div className="fact-value">{fact.value}</div>
            </div>
          ))}
          <div className="fact"><div className="fact-label">{D.portfolioCopy.builder.certificationLabel}</div><div className="fact-value">{D.certifications.join(' · ')}</div></div>
        </div>
      </div>
      <div className="sec" data-ask-section="builder/career">
        <SecHead title="Career as engineer" num="02" meta="full timeline" />
        <CareerList items={D.career} />
      </div>
      <div className="sec" data-ask-section="builder/writing">
        <SecHead title="Writing" num="03" meta="publications" />
        <div className="pillars">
          {D.publications.map((p, i) =>
          <div className="pillar" key={i}>
              <div className="pillar-no">PIECE · 0{i + 1}</div>
              <div className="pillar-name">{p.title}</div>
              <div className="pillar-en">Publication</div>
              <div className="pillar-blurb">{p.desc}</div>
            </div>
          )}
          {D.portfolioCopy.builder.extraWritings.map((piece) => (
            <div className="pillar" key={piece.no}>
              <div className="pillar-no">{piece.no}</div>
              <div className="pillar-name">{piece.name}</div>
              <div className="pillar-en">{piece.en}</div>
              <div className="pillar-blurb">{piece.blurb}</div>
            </div>
          ))}
        </div>
      </div>
      <CoffeeCTA
        title={D.portfolioCopy.builder.coffee.title}
        sub={D.portfolioCopy.builder.coffee.sub} />
      
    </div>);

}

// ---------- 04 CURIOUS ----------
function parseTimelineRange(t: { year: string }) {
  // Returns { start: float, end: float } in fractional years.
  const NOW = 2025 + 11 / 12; // Nov 2025-ish
  const m = t.year.match(/(\d{4})(?:\.(\d{1,2}))?\s*(?:[—\-~]\s*(현재|now|(\d{4})(?:\.(\d{1,2}))?))?/);
  if (!m) return { start: NOW, end: NOW };
  const sY = parseInt(m[1], 10);
  const sM = m[2] ? parseInt(m[2], 10) : 1;
  const start = sY + (sM - 1) / 12;
  let end;
  if (!m[3]) {
    // single point — give a small bar
    end = start + 1 / 12;
  } else if (m[3] === "현재" || m[3] === "now") {
    end = NOW;
  } else {
    const eY = parseInt(m[4] ?? "0", 10);
    const eM = m[5] ? parseInt(m[5], 10) : 12;
    end = eY + (eM - 1) / 12 + 1 / 12;
  }
  return { start, end };
}

function GanttTimeline({
  items,
  accent,
}: {
  items: { year: string; title: string; desc: string }[];
  accent?: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  // Compute axis bounds
  const ranges = items.map(parseTimelineRange);
  const minY = Math.floor(Math.min(...ranges.map((r) => r.start)));
  const lastY = Math.ceil(Math.max(...ranges.map((r) => r.end)));
  // Show through current year + 3 future years; horizontal scroll past viewport
  const now = new Date();
  const currentY = now.getFullYear() + now.getMonth() / 12;
  const FUTURE_YEARS = 3;
  const maxY = Math.max(lastY, Math.ceil(currentY) + FUTURE_YEARS);
  const span = maxY - minY;
  const years = [];
  for (let y = minY; y <= maxY; y++) years.push(y);
  // Each year gets a fixed pixel width so the chart can extend past viewport
  const YEAR_W = 64;
  const chartW = span * YEAR_W;
  const span_pct = (v: number) => ((v - minY) / span) * 100;

  // Pack rows: place each item on its own row to keep all bars cleanly readable.
  // (Greedy packing collapses point-events onto crowded rows and clips titles.)
  const placed = items.map((it, i) => ({ ...it, ...ranges[i], row: i }));
  const rowCount = items.length;
  const ROW_H = 44;
  const HEAD_H = 28;
  const totalH = HEAD_H + rowCount * ROW_H + 16;

  return (
    <div className="gantt-scroll">
      <div className="gantt" style={{ height: totalH, width: chartW }}>
      {/* year ticks */}
      <div className="gantt-axis" style={{ height: HEAD_H }}>
        {years.map((y) =>
          <div className="gantt-tick" key={y} style={{ left: `${span_pct(y)}%` }}>
            <span className={"gantt-tick-y" + (y > lastY ? " future" : "")}>{`'${String(y).slice(2)}`}</span>
          </div>
          )}
      </div>
      {/* vertical year gridlines */}
      <div className="gantt-grid" style={{ top: HEAD_H, height: rowCount * ROW_H }}>
        {years.map((y) =>
          <div className={"gantt-gline" + (y > lastY ? " future" : "")} key={y} style={{ left: `${span_pct(y)}%` }} />
          )}
      </div>
      {/* now marker — points at the actual current month so the open future to its right reads as "ongoing" */}
      <div className="gantt-now" style={{ left: `${span_pct((() => {const d = new Date();return d.getFullYear() + d.getMonth() / 12;})())}%`, top: HEAD_H, height: rowCount * ROW_H + 16 }}>
        <span>NOW</span>
      </div>
      {/* bars — title rendered inside bar but allowed to overflow horizontally so it never clips */}
      {placed.map((p, i) => {
          const left = span_pct(p.start);
          const width = Math.max(1.2, span_pct(p.end) - span_pct(p.start));
          const top = HEAD_H + p.row * ROW_H + 4;
          return (
            <div key={i} className={"gantt-bar" + (p.row >= rowCount - 2 ? " bottom" : "") + (active === i ? " active" : "")}
            style={{ left: `${left}%`, width: `${width}%`, top }}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}>
            <div className="gantt-bar-inner" style={{ borderColor: accent || "#5e93b1" }}>
              <div className="gantt-bar-title">{p.title}</div>
              <div className="gantt-bar-year">{p.year}</div>
            </div>
            {active === i &&
              <div className="gantt-pop">
                <div className="gantt-pop-year">{p.year}</div>
                <div className="gantt-pop-title">{p.title}</div>
                <div className="gantt-pop-desc">{p.desc}</div>
              </div>
              }
          </div>);

        })}
      </div>
    </div>);

}

function CuriousView({
  onBack,
  accent,
}: {
  onBack: () => void;
  accent?: string;
}) {
  const D = useSiteData();
  const timeline = D.portfolioCopy.curious.timeline;


  return (
    <div className="view">
      <Back onBack={onBack} />
      <ViewHead
        room="04 · CURIOUS"
        coord="A2"
        title={renderTitleLines(D.viewHeaders.curious.titleLines)}
        lede={D.viewHeaders.curious.lede} />
      
      <div className="sec" data-ask-section="curious/timeline">
        <SecHead title="Section drawing — 2012 to now" num="01" meta="parallel tracks" />
        <GanttTimeline items={timeline} accent={accent} />
      </div>
      <div className="sec" data-ask-section="curious/personal">
        <SecHead title="A bit personal" num="02" meta="off-record" />
        <div className="pillars">
          {D.portfolioCopy.curious.notes.map((note) => (
            <div className="pillar" key={note.no}>
              <div className="pillar-no">{note.no}</div>
              <div className="pillar-name">{note.name}</div>
              <div className="pillar-en">{note.en}</div>
              <div className="pillar-blurb">{note.blurb}</div>
            </div>
          ))}
        </div>
      </div>
      <CoffeeCTA
        title={D.portfolioCopy.curious.coffee.title}
        sub={D.portfolioCopy.curious.coffee.sub} />
      
    </div>);

}

// ============================================================
// App router
// ============================================================
const DEFAULT_ACCENT = "#287099";

function PortfolioAppBody() {
  const [persona, setPersona] = useState<PersonaKey | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [askVisibleSection, setAskVisibleSection] = useState<string | undefined>();
  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.style.setProperty("--accent", DEFAULT_ACCENT);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [persona]);
  useEffect(() => {
    const onHash = () => {
      const h = window.location.hash.slice(1);
      if (["hire", "collab", "builder", "curious"].includes(h)) {
        setPersona(h as PersonaKey);
      } else {
        setPersona(null);
      }
    };
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 768px)");
    const apply = () => setIsMobileViewport(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  const pick = (key: PersonaKey) => {
    window.location.hash = key;
    setPersona(key);
  };
  const back = () => {
    window.location.hash = "";
    setPersona(null);
  };

  const viewKey = persona ?? "home";
  useReportAskVisibleSection(shellRef, viewKey, setAskVisibleSection);

  const pageContext: AskHansolPageContext = useMemo(
    () => ({
      view: persona ?? "home",
      section: persona === null ? "home" : "detail",
      hash: persona ?? "home",
      detail: askVisibleSection,
    }),
    [persona, askVisibleSection],
  );

  let body;
  if (persona === "hire") body = <HireView onBack={back} />;
  else if (persona === "collab") body = <CollabView onBack={back} />;
  else if (persona === "builder") body = <BuilderView onBack={back} />;
  else if (persona === "curious")
    body = (
      <CuriousView
        onBack={back}
        accent={DEFAULT_ACCENT}
      />
    );
  else body = <Home onPick={pick} />;

  return (
    <div className={"app-layout" + (persona !== null ? " has-dock" : "")}>
      <div className="shell" ref={shellRef}>
        {body}
        <Foot />
      </div>
      <ChatDock
        defaultOpen={persona !== null && !isMobileViewport}
        inline={persona !== null}
        pageContext={pageContext}
      />
    </div>
  );
}

export default function PortfolioApp({ siteData }: { siteData: SiteData }) {
  return (
    <SiteDataProvider data={siteData}>
      <PortfolioAppBody />
    </SiteDataProvider>
  );
}