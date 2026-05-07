/* hsol.info v2 — main app (architectural) */

const D = window.HSOL_DATA;
const COORDS = { hire: "A1", collab: "B1", builder: "B2", curious: "A2" };
const SECTION_NAMES = {
  hire: "01 · HIRE",
  collab: "02 · COLLAB",
  builder: "03 · BUILDER",
  curious: "04 · CURIOUS"
};
const ASK_HANSOL_FALLBACK_MESSAGE =
  "죄송해요, 답변을 못 가져왔어요. 직접 묻고 싶으시면 calendly.com/contact-hsol/coffee-chat 에서 시간을 잡아주세요.";
const ASK_HANSOL_SUGGESTIONS = [
  "지금 무슨 일을 하나요?",
  "AI를 어떻게 쓰나요?",
  "강점이 뭐예요?",
  "코드도 짜시나요?",
  "어떤 회사와 잘 맞나요?"];

async function askHansolViaApi(query) {
  const response = await fetch("/api/ask-hansol", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) throw new Error(`ask-hansol failed: ${response.status}`);
  const data = await response.json();
  if (!data.answer) throw new Error("empty answer");
  return data.answer;
}

function streamAnswerText(answerText, onChunk, onDone) {
  let i = 0;
  const tick = () => {
    i += Math.max(1, Math.floor(answerText.length / 80));
    const text = answerText.slice(0, i);
    const streaming = i < answerText.length;
    onChunk(text, streaming);
    if (streaming) setTimeout(tick, 18);else
    onDone();
  };
  tick();
}

// ============================================================
// HOME
// ============================================================
function Home({ onPick }) {
  const [hovered, setHovered] = useState(null);
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
  }, [hovered]);
  const activeKey = hovered || D.personas[autoIdx].key;
  return (
    <div className="view" onMouseMove={bumpInteract} onClick={bumpInteract} onKeyDown={bumpInteract}>
      <Plate />

      <section className="hero">
        <div className="hero-left">
          <div>
            <div className="hero-eyebrow">
              <span className="axis"></span>
              hsol.info — a portfolio in plan view
            </div>
            <h1 className="hero-title">
              <span className="blk">온라인의 기술과</span>
              <span className="blk">오프라인의 운영을 잇는</span>
              <span className="blk"><span className="hi">임한솔</span>입니다.</span>
            </h1>
            <p className="hero-sub">
              10년이상 경력의 엔지니어이자 스타트업을 창업한 메이커. 씨엔티테크 → 리디북스 → 토스 인터널 제품팀을 거쳐, 지금은 
              <span className="em"> 프루퍼 ㈜ 대표이자 PPB Studios 팀장</span>으로 일하고 있습니다. 
              아래에서 가장 가까운 항목을 골라주세요. 그에 맞춰 이야기를 정리해 드릴게요.
            </p>
          </div>
          <div className="hero-meta">
            <span><b>SINCE</b> 2014</span>
            <span><b>NOW</b> Proofer · PPB</span>
            <span><b>BASE</b> 서울</span>
          </div>
        </div>
        <PlanDiagram onPick={onPick} hovered={activeKey} onHover={setHovered} />
      </section>

      <section className="doors">
        <div className="doors-head">
          <h2 className="doors-h">어떤 이유로 오셨어요?</h2>
          <div className="doors-meta">Why are you here today</div>
        </div>
        <div className="doors-list">
          {D.personas.map((p) =>
          <button
            className={"persona" + (activeKey === p.key ? " is-hover" : "")}
            key={p.key}
            onClick={() => onPick(p.key)}
            onMouseEnter={() => {setHovered(p.key);bumpInteract();}}
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

      <section className="coffee">
        <div className="coffee-card">
          <div className="coffee-quote">“</div>
          <div className="coffee-body">
            <div className="coffee-eyebrow">— Coffee chat</div>
            <h3 className="coffee-h">시간 괜찮으시면 30분만 같이 이야기해요.</h3>
            <p className="coffee-p">
              여기까지 읽어주셨다면, 그것만으로도 감사합니다.
              더 궁금한 얘기가 있다면 직접 만나서 나누고 싶어요.
            </p>
            <div className="coffee-cta">
              <a className="coffee-btn" href={D.identity.calendly} target="_blank" rel="noopener">
                30분 커피챗 예약하기 <span className="arr">→</span>
              </a>
              <a className="coffee-link" href={"mailto:" + D.identity.email}>{D.identity.email}</a>
            </div>
          </div>
          <div className="coffee-photo">
            <img src="assets/hansol.png" alt="임한솔" />
          </div>
        </div>
      </section>
    </div>);

}

// ============================================================
// ChatDock — persistent floating sidebar across all views
// ============================================================
function ChatDock({ defaultOpen = false, inline = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const [q, setQ] = useState("");
  const [messages, setMessages] = useState([]); // {role:'user'|'hansol', text, streaming?}
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  const suggestions = ASK_HANSOL_SUGGESTIONS;


  useEffect(() => {
    setOpen(defaultOpen);
  }, [defaultOpen]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const ask = useCallback(async (query) => {
    const finalQ = (query ?? q).trim();
    if (!finalQ || loading) return;
    setQ("");
    setLoading(true);
    setMessages((prev) => [...prev, { role: 'user', text: finalQ }, { role: 'hansol', text: '', streaming: true }]);

    let answerText;
    try {
      answerText = await askHansolViaApi(finalQ);
    } catch (e) {
      answerText = ASK_HANSOL_FALLBACK_MESSAGE;
    }

    streamAnswerText(
      answerText,
      (text, streaming) => {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: 'hansol', text, streaming };
        return next;
      });
      },
      () => setLoading(false),
    );
  }, [q, loading]);

  return (
    <>
      <button className={"chatdock-fab" + (open ? " is-open" : "")} onClick={() => setOpen((o) => !o)} aria-label="Ask Hansol">
        {open ? '×' : <><span className="fab-dot"></span>ASK</>}
      </button>
      <aside className={"chatdock" + (open ? " is-open" : "") + (inline ? " is-inline" : "")}>
        <header className="chatdock-head">
          <div>
            <div className="chatdock-title">ASK HANSOL</div>
            <div className="chatdock-sub">한솔에게 직접 물어보세요</div>
          </div>
          <button className="chatdock-x" onClick={() => setOpen(false)} aria-label="Close">×</button>
        </header>
        <div className="chatdock-scroll" ref={scrollRef}>
          {messages.length === 0 &&
          <div className="chatdock-empty">
              <div className="chatdock-empty-line">— Hansol</div>
              <p>안녕하세요. 이력서에 적기 어려운 것들도 물어보셔도 좋아요. 프로필 데이터를 바탕으로 답합니다.</p>
              <div className="chatdock-suggest">
                {suggestions.map((s, i) =>
              <button key={i} className="chatdock-chip" onClick={() => ask(s)}>{s}</button>
              )}
              </div>
            </div>
          }
          {messages.map((m, i) =>
          <div key={i} className={"chatdock-msg chatdock-msg--" + m.role}>
              {m.role === 'hansol' && <div className="chatdock-msg-from">— Hansol</div>}
              <div className="chatdock-msg-body">
                <span className={m.streaming ? "cursor-blink" : ""}>{m.text}</span>
              </div>
            </div>
          )}
        </div>
        <form className="chatdock-form" onSubmit={(e) => {e.preventDefault();ask();}}>
          <input
            className="chatdock-input"
            placeholder="질문을 입력하세요"
            value={q}
            onChange={(e) => setQ(e.target.value)} />
          
          <button className="chatdock-send" type="submit" disabled={loading || !q.trim()}>
            {loading ? "…" : "↑"}
          </button>
        </form>
      </aside>
    </>);

}

// ============================================================
// AskBox
// ============================================================
function AskBox() {
  const [q, setQ] = useState("");
  const [a, setA] = useState(null);
  const [loading, setLoading] = useState(false);

  const suggestions = ASK_HANSOL_SUGGESTIONS;


  const ask = useCallback(async (query) => {
    const finalQ = (query ?? q).trim();
    if (!finalQ) return;
    setLoading(true);
    setA({ q: finalQ, text: "", streaming: true });

    let answerText;
    try {
      answerText = await askHansolViaApi(finalQ);
    } catch (e) {
      answerText = ASK_HANSOL_FALLBACK_MESSAGE;
    }

    streamAnswerText(
      answerText,
      (text, streaming) => setA({ q: finalQ, text, streaming }),
      () => setLoading(false),
    );
  }, [q]);

  return (
    <section className="ask">
      <div className="ask-head">
        <span>§ 02 · ASK</span>
        <span>위 항목 외의 질문은 — 직접 물어보세요</span>
      </div>
      <form className="ask-row" onSubmit={(e) => {e.preventDefault();ask();}}>
        <input
          className="ask-input"
          placeholder="한솔에게 직접 물어보세요"
          value={q}
          onChange={(e) => setQ(e.target.value)} />
        
        <button className="ask-submit" type="submit" disabled={loading}>
          {loading ? "..." : "Send"}
        </button>
      </form>
      <div className="ask-suggestions">
        {suggestions.map((s, i) =>
        <button key={i} className="ask-chip" onClick={() => {setQ(s);ask(s);}}>{s}</button>
        )}
      </div>
      {a &&
      <div className="ask-answer">
          <span className="meta">— Hansol responds</span>
          <span className={a.streaming ? "cursor-blink" : ""}>{a.text}</span>
        </div>
      }
    </section>);

}

// ============================================================
// Persona view shells with header bar
// ============================================================
function ViewHead({ room, coord, title, lede }) {
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
function HireView({ onBack }) {
  const tier1 = D.career.filter((c) => c.tier === 1);
  return (
    <div className="view">
      <Back onBack={onBack} />
      <ViewHead
        room="01 · HIRE"
        coord="A1"
        title={<>10년 차 엔지니어,<br />제품·운영·창업을 거친 사람.</>}
        lede="엔지니어로 시작해 토스 인터널 제품 4년 10개월, 두 번의 창업, 옴니채널 플랫폼 리드까지 — “기능을 잘 만드는 사람”보다 “무엇을 만들지 정하고 끝까지 가져가는 사람”으로 자랐습니다." />
      
      <div className="sec">
        <SecHead title="Strengths" num="01" meta="3 pillars" />
        <Pillars />
      </div>
      <div className="sec">
        <SecHead title="Selected experience" num="02" meta={`${tier1.length} roles`} />
        <CareerList items={tier1} />
      </div>
      <div className="sec">
        <SecHead title="Facts" num="03" meta="basic" />
        <div className="facts">
          <div className="fact"><div className="fact-label">Years</div><div className="fact-value">10년+ (since 2014)</div></div>
          <div className="fact"><div className="fact-label">Base</div><div className="fact-value">{D.identity.location}</div></div>
          <div className="fact"><div className="fact-label">Education</div><div className="fact-value">{D.education[0].school} · {D.education[0].degree}</div></div>
          <div className="fact"><div className="fact-label">Languages</div><div className="fact-value">{D.languages.map((l) => `${l.name}(${l.level.split(' ')[0]})`).join(' · ')}</div></div>
        </div>
      </div>
      <CoffeeCTA
        title="이력서 한 장으로는 다 담기지 않는 이야기가 있습니다."
        sub="30분 커피챗으로, 어떤 자리에 어떤 기여가 가능할지 직접 이야기 나눠요." />
      
    </div>);

}

// ---------- 02 COLLAB ----------
function CollabView({ onBack }) {
  return (
    <div className="view">
      <Back onBack={onBack} />
      <ViewHead
        room="02 · COLLAB"
        coord="B1"
        title={<>기술과 운영 사이,<br />다리를 놓는 일을 합니다.</>}
        lede="지금 두 곳에서 — 프루퍼(대표), PPB Studios(팀장) 으로 동시에 움직이고 있습니다. 공통점은 모두 “흩어진 부서·채널·역할을 하나의 시스템으로 묶는 일”이라는 점입니다." />
      
      <div className="sec">
        <SecHead title="What I'm building now" num="01" meta="active" />
        <CareerList items={D.career.filter((c) => c.period.includes("현재"))} />
      </div>
      <div className="sec">
        <SecHead title="How I work" num="02" meta="approach" />
        <div className="pillars">
          <div className="pillar">
            <div className="pillar-no">METHOD · 01</div>
            <div className="pillar-name">문제부터 다시 그린다</div>
            <div className="pillar-en">Reframe before build</div>
            <div className="pillar-blurb">의뢰가 들어와도 “그게 정말 그 문제냐“부터 묻습니다. 토스 인터널도, PPB의 옴니채널도 의뢰받은 명세 그대로가 아니라 한 단계 위에서 다시 정의한 결과였습니다.</div>
          </div>
          <div className="pillar">
            <div className="pillar-no">METHOD · 02</div>
            <div className="pillar-name">가설을 가장 작게 잘라낸다</div>
            <div className="pillar-en">Smallest viable test</div>
            <div className="pillar-blurb">한 번에 큰 시스템을 만들지 않습니다. 가장 작고 가장 빨리 검증 가능한 형태로 잘라낸 뒤, 진짜 사용 데이터를 보고 다음 한 걸음을 정합니다.</div>
          </div>
          <div className="pillar">
            <div className="pillar-no">METHOD · 03</div>
            <div className="pillar-name">AI를 도구가 아닌 문화로</div>
            <div className="pillar-en">AI as culture</div>
            <div className="pillar-blurb">PPB에서는 Claude Code + Linear 기반 바이브 코딩 프로토콜을 설계해 도입했습니다. 도메인별 반복 업무의 AI 전환을 코칭하며, 팀이 AI Native하게 일하게 만드는 일을 합니다.</div>
          </div>
        </div>
      </div>
      <div className="sec">
        <SecHead title="Past advisory" num="03" meta="reference" />
        <CareerList items={D.career.filter((c) => (c.tags || []).includes("자문") || c.org === "Antler")} />
      </div>
      <CoffeeCTA
        title="협업의 형태는 자유입니다."
        sub="자문 · 공동 창업 · 기술 파트너십 · 단발성 컨설팅 — 무엇이든 30분 통화부터 시작해요." />
      
    </div>);

}

// ---------- 03 BUILDER ----------
function BuilderView({ onBack }) {
  return (
    <div className="view">
      <Back onBack={onBack} />
      <ViewHead
        room="03 · BUILDER"
        coord="B2"
        title={<>코드도 짜고,<br />무엇을 만들지도 정합니다.</>}
        lede="2014년 외주개발사 풀스택부터, 리디·토스 인터널 제품, 그리고 지금은 AI Native 워크플로우와 개발자 생산성 — 10년 동안 “제품을 만든다는 것”의 정의를 계속 갱신해 왔습니다." />
      
      <div className="sec">
        <SecHead title="Stack & domain" num="01" meta="practical" />
        <div className="facts">
          <div className="fact"><div className="fact-label">언어 / 런타임</div><div className="fact-value">TypeScript · Python · Java · PHP · ASP.NET (legacy)</div></div>
          <div className="fact"><div className="fact-label">관심 도메인</div><div className="fact-value">Internal tools · Developer productivity · Omni-channel · AX</div></div>
          <div className="fact"><div className="fact-label">AI workflow</div><div className="fact-value">Claude Code · Linear · Vibe coding protocol</div></div>
          <div className="fact"><div className="fact-label">자격</div><div className="fact-value">{D.certifications.join(' · ')}</div></div>
        </div>
      </div>
      <div className="sec">
        <SecHead title="Career as engineer" num="02" meta="full timeline" />
        <CareerList items={D.career} />
      </div>
      <div className="sec">
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
          <div className="pillar">
            <div className="pillar-no">PIECE · 02</div>
            <div className="pillar-name">Measurable Developer</div>
            <div className="pillar-en">Newsletter</div>
            <div className="pillar-blurb">개발자 생산성을 측정 가능한 형태로 다루는 뉴스레터. 프루퍼 CTO 시절부터 발행해 왔습니다.</div>
          </div>
          <div className="pillar">
            <div className="pillar-no">PIECE · 03</div>
            <div className="pillar-name">Claude Code + Linear 프로토콜</div>
            <div className="pillar-en">Internal playbook</div>
            <div className="pillar-blurb">PPB에 도입한 바이브 코딩 프로토콜 — 요구사항 분석부터 태스크 관리·구현까지의 워크플로우를 재정의합니다.</div>
          </div>
        </div>
      </div>
      <CoffeeCTA
        title="비슷한 문제를 풀고 있다면, 이야기해봐요."
        sub="개발자 생산성, 인터널 툴, AI 도입, 옴니채널 — 한쪽이 일방적으로 가르치는 자리가 아니라 서로의 지도를 나누는 자리로." />
      
    </div>);

}

// ---------- 04 CURIOUS ----------
function parseTimelineRange(t) {
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
    const eY = parseInt(m[4], 10);
    const eM = m[5] ? parseInt(m[5], 10) : 12;
    end = eY + (eM - 1) / 12 + 1 / 12;
  }
  return { start, end };
}

function GanttTimeline({ items, accent }) {
  const [active, setActive] = useState(null);
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
  const span_pct = (v) => (v - minY) / span * 100;

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

function CuriousView({ onBack, timelineMode, accent }) {
  const timeline = [
  { year: "2012 — 2014", title: "선린인터넷고등학교 정보통신과", desc: "한국 IT업계의 인재 양성소로 알려진 특성화고. 일반 인문계와 달리 고등학교 시절부터 실무에 가까운 프로그래밍·시스템·네트워크를 다뤘습니다. 어릴 적부터 취미로 해 온 코딩을 본격적인 진로로 가져간 시기. 웹디자인기능사·정보처리기능사를 땄습니다." },
  { year: "2014 — 2016", title: "씨엔티테크", desc: "프랜차이즈 도메인의 풀스택 외주 개발자로 사회생활 시작. ASP.NET, JSP, PHP — 가리지 않고 썼습니다." },
  { year: "2016 — 2018", title: "리디북스", desc: "B2B 도구 — CMS와 작가/매니저 플랫폼을 만들며 “내부 사용자“라는 관점을 처음 익혔습니다." },
  { year: "2018 — 2023", title: "토스 인터널 제품팀, 4년 10개월", desc: "토스인터널, 티티(time-tracker), 3 month review, 비바뉴스 — 동료들이 매일 쓰는 제품을 만드는 일이 가장 즐거웠습니다." },
  { year: "2018 — 2022", title: "건국대학교 경영공학사", desc: "Advanced Industry Fusion 전공. 일하면서 학교를 다녔습니다." },
  { year: "2023.10 — 2023.12", title: "Antler EIR", desc: "글로벌 초기 VC 프로그램. 창업의 형태에 대해 본격적으로 고민한 시기." },
  { year: "2024.01 — 2024.11", title: "프루퍼 CTO — 첫 창업", desc: "개발자 생산성을 측정 가능한 형태로 다루는 일. 'Measurable Developer'와 '프루퍼 인사이트'를 만들었습니다." },
  { year: "2025.04 — 현재", title: "프루퍼 대표(CEO) 전환", desc: "프루퍼 ㈜를 운영하며, 회사의 방향을 DX → AX 전환을 돕는 쪽으로 다시 그렸습니다. 지금도 운영 중입니다." },
  { year: "2025.06 — 현재", title: "PPB Studios 팀장 겸직", desc: "프루퍼 운영과 병행하여, 물류 — 가맹 — MD — 브랜드를 잇는 옴니채널 플랫폼 리드를 맡고 있습니다. AI Native 팀 문화를 함께 구축 중." }];


  return (
    <div className="view">
      <Back onBack={onBack} />
      <ViewHead
        room="04 · CURIOUS"
        coord="A2"
        title={<>한 사람의 10년치<br />궤적을 펼쳐놓으면.</>}
        lede="엔지니어 → 인터널 제품 메이커 → 자문가 → 창업가 → 옴니채널 리드 — 한 줄로 적으면 점프처럼 보이지만 사이사이는 이어져 있습니다. 시간순으로 천천히 따라가보셔도 좋습니다." />
      
      <div className="sec">
        <SecHead title={timelineMode === "gantt" ? "Section drawing — 2012 to now" : "Section drawing — 2012 to now"} num="01" meta={timelineMode === "gantt" ? "parallel tracks" : "vertical cut"} />
        {timelineMode === "gantt" ?
        <GanttTimeline items={timeline} accent={accent} /> :

        <div className="timeline">
            {timeline.map((t, i) =>
          <div className="tl-item" key={i}>
                <div className="tl-year">{t.year}</div>
                <div className="tl-title">{t.title}</div>
                <div className="tl-desc">{t.desc}</div>
              </div>
          )}
          </div>
        }
      </div>
      <div className="sec">
        <SecHead title="A bit personal" num="02" meta="off-record" />
        <div className="pillars">
          <div className="pillar">
            <div className="pillar-no">NOTE · 01</div>
            <div className="pillar-name">메이커와 엔지니어 사이</div>
            <div className="pillar-en">Maker × Engineer</div>
            <div className="pillar-blurb">“메이커와 엔지니어 — 개발자가 됐습니다. 그 다음은요?“라는 글을 썼습니다. 코드 그 자체보다, 코드로 만들어진 것이 누군가의 하루를 어떻게 바꾸는지가 더 흥미로워요.</div>
          </div>
          <div className="pillar">
            <div className="pillar-no">NOTE · 02</div>
            <div className="pillar-name">선린 → 토스 → 창업</div>
            <div className="pillar-en">A non-linear path</div>
            <div className="pillar-blurb">실업계 고등학교에서 시작해 외주개발사 → 사용자 제품 회사 → 사내 제품팀 → 자문 → VC 프로그램 → 창업으로 이어진 길은 처음부터 계획된 게 아니었습니다. 매 시점 가장 흥미로운 다음 한 걸음을 골랐을 뿐입니다.</div>
          </div>
          <div className="pillar">
            <div className="pillar-no">NOTE · 03</div>
            <div className="pillar-name">기술과 운영의 접점</div>
            <div className="pillar-en">Where tech meets ops</div>
            <div className="pillar-blurb">관심사는 점점 “코드로 무엇을 짓는가“에서 “코드와 운영이 만나는 지점에서 무엇이 작동하는가“로 옮겨가고 있습니다. 옴니채널, 개발자 생산성, AX — 모두 그 접점의 다른 이름입니다.</div>
          </div>
        </div>
      </div>
      <CoffeeCTA
        title="시간 괜찮으시면 30분만 같이 이야기해요."
        sub="여기까지 읽어주셨다면, 그것만으로도 감사합니다. 더 궁금한 얘기가 있다면 직접 만나서 나누고 싶어요." />
      
    </div>);

}

// ============================================================
// App router
// ============================================================
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "timelineMode": "gantt",
  "accent": "#287099"
} /*EDITMODE-END*/;

function App() {
  const [persona, setPersona] = useState(null);
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', t.accent);
  }, [t.accent]);

  useEffect(() => {window.scrollTo({ top: 0, behavior: 'instant' });}, [persona]);
  useEffect(() => {
    const onHash = () => {
      const h = window.location.hash.slice(1);
      if (["hire", "collab", "builder", "curious"].includes(h)) setPersona(h);else
      setPersona(null);
    };
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const pick = (key) => {window.location.hash = key;setPersona(key);};
  const back = () => {window.location.hash = "";setPersona(null);};

  let body;
  if (persona === "hire") body = <HireView onBack={back} />;else
  if (persona === "collab") body = <CollabView onBack={back} />;else
  if (persona === "builder") body = <BuilderView onBack={back} />;else
  if (persona === "curious") body = <CuriousView onBack={back} timelineMode={t.timelineMode} accent={t.accent} />;else
  body = <Home onPick={pick} />;

  return (
    <div className={"app-layout" + (persona !== null ? " has-dock" : "")}>
      <div className="shell">
        {body}
        <Foot />
      </div>
      <ChatDock defaultOpen={persona !== null} inline={persona !== null} />
      <TweaksPanel>
        <TweakSection label="Timeline" />
        <TweakRadio
          label="Render mode"
          value={t.timelineMode}
          options={["gantt", "vertical"]}
          onChange={(v) => setTweak("timelineMode", v)} />
        
        <TweakSection label="Theme" />
        <TweakColor
          label="Accent"
          value={t.accent}
          options={["#287099", "#5e93b1", "#1a1a1a", "#c14a2b"]}
          onChange={(v) => setTweak("accent", v)} />
        
      </TweaksPanel>
    </div>);

}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);