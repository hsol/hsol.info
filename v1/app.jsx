/* hsol.info — main app, persona router, ask box */

const D = window.HSOL_DATA;

// ============================================================
// HOME — 입장 화면
// ============================================================
function Home({ onPick }) {
  return (
    <div className="view">
      <section className="intro">
        <div className="intro-eyebrow">Hsol.info — A living portfolio</div>
        <h1 className="intro-title">
          이 페이지는 <em>이력서가 아닙니다.</em><br/>
          당신이 어떤 이유로 왔는지에 따라<br/>다른 이야기를 합니다.
        </h1>
        <p className="intro-sub">
          <span className="accent">임한솔</span>은 10년 차 엔지니어이자 두 번 창업한 메이커, 
          현재는 프루퍼 ㈜ 대표이자 PPB Studios의 팀장으로 — 
          <em> "온라인의 기술과 오프라인의 운영을 잇는 일"</em>을 하고 있습니다.
        </p>
      </section>

      <section className="invitation">
        <div className="invitation-q">어떤 이유로 오셨어요?</div>
        <div className="invitation-q-en">Why are you here today?</div>

        <div className="personas">
          {D.personas.map(p => (
            <button className="persona" key={p.key} onClick={() => onPick(p.key)}>
              <div className="persona-mark">{p.mark}</div>
              <div className="persona-body">
                <div className="persona-title">{p.title}</div>
                <div className="persona-hint">{p.hint}</div>
              </div>
              <div className="persona-arrow">→</div>
            </button>
          ))}
        </div>
      </section>

      <AskBox />
    </div>
  );
}

// ============================================================
// AskBox — Claude AI 자유 질문
// ============================================================
function AskBox() {
  const [q, setQ] = useState("");
  const [a, setA] = useState(null);
  const [loading, setLoading] = useState(false);

  const suggestions = [
    "지금 어떤 일을 하고 있나요?",
    "AI는 어떻게 활용하시나요?",
    "어떤 회사·사람과 잘 맞나요?",
    "강점이 뭐예요?",
    "코드도 짜시나요?",
  ];

  const ask = useCallback(async (query) => {
    const finalQ = (query ?? q).trim();
    if (!finalQ) return;
    setLoading(true);
    setA({ q: finalQ, text: "", streaming: true });

    // FAQ 매칭 우선 — 빠른 응답
    const matched = D.faq.find(f => {
      const a = f.q.toLowerCase().replace(/[?!.\s]/g, "");
      const b = finalQ.toLowerCase().replace(/[?!.\s]/g, "");
      return a === b || a.includes(b) || b.includes(a);
    });

    let answerText;
    if (matched) {
      answerText = matched.a;
    } else {
      // Claude API
      try {
        const profileContext = `당신은 임한솔(Hansol Lim)을 대신해 그의 포트폴리오 사이트 방문자에게 답하는 어시스턴트입니다.
한솔의 어조는 차분하고 단정합니다. 과장하지 않고, 짧고 사실 위주로 답합니다.
한국어로 3~5문장 이내로 답하세요. 모르는 것은 모른다고 말합니다.

[프로필 요약]
- 이름: 임한솔, 10년 차 엔지니어 출신, 서울 거주
- 현재: 프루퍼 ㈜ 대표 (2025.04~), PPB Studios 팀장 (2025.06~), 라이트형제 자문(~2025.04)
- 과거: 토스(인터널 제품팀, 4년 10개월), 리디북스(2년), 씨엔티테크(2년 4개월)
- Antler EIR (2023.10~12)
- 학력: 건국대 경영공학사, 선린인터넷고 정보통신과
- 대표 보유 기술 (본인이 직접 명시): 전략적 사고, 고객 중심 사고, 디자인적 사고
- 키워드: 인터널 제품, 옴니채널, 개발자 생산성, AI Native, Claude Code, Vibe coding
- 연락: molmoty@gmail.com, calendly.com/contact-hsol/coffee-chat
- 글: "메이커와 엔지니어 — 개발자가 됐습니다. 그 다음은요?" / 뉴스레터 "Measurable Developer"

[FAQ — 한솔 본인의 톤]
${D.faq.map(f => `Q: ${f.q}\nA: ${f.a}`).join("\n\n")}

방문자 질문: ${finalQ}`;

        const result = await window.claude.complete(profileContext);
        answerText = result;
      } catch (e) {
        answerText = "죄송해요, 잠깐 답변을 못 가져왔어요. 직접 묻고 싶으시면 calendly.com/contact-hsol/coffee-chat 에서 30분 시간을 잡아주세요.";
      }
    }

    // 타이핑 애니메이션
    let i = 0;
    const tick = () => {
      i += Math.max(1, Math.floor(answerText.length / 80));
      setA({ q: finalQ, text: answerText.slice(0, i), streaming: i < answerText.length });
      if (i < answerText.length) setTimeout(tick, 18);
      else setLoading(false);
    };
    tick();
  }, [q]);

  return (
    <section className="ask">
      <div className="ask-label">— Or, ask anything</div>
      <form className="ask-row" onSubmit={(e) => { e.preventDefault(); ask(); }}>
        <input
          className="ask-input"
          placeholder="한솔에게 직접 물어보세요. 예: 어떤 일을 하시나요?"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="ask-submit" type="submit" disabled={loading}>
          {loading ? "..." : "Ask"}
        </button>
      </form>
      <div className="ask-suggestions">
        {suggestions.map((s, i) => (
          <button key={i} className="ask-chip" onClick={() => { setQ(s); ask(s); }}>{s}</button>
        ))}
      </div>
      {a && (
        <div className="ask-answer">
          <span className="meta">— Hansol responds</span>
          <span className={a.streaming ? "cursor-blink" : ""}>{a.text}</span>
        </div>
      )}
    </section>
  );
}

// ============================================================
// App router
// ============================================================
function App() {
  const [persona, setPersona] = useState(null);

  // 페르소나 변경시 스크롤 위로
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [persona]);

  // hash 라우팅 (간단)
  useEffect(() => {
    const onHash = () => {
      const h = window.location.hash.slice(1);
      if (["hire", "collab", "builder", "curious"].includes(h)) setPersona(h);
      else setPersona(null);
    };
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const pick = (key) => {
    window.location.hash = key;
    setPersona(key);
  };
  const back = () => {
    window.location.hash = "";
    setPersona(null);
  };

  let body;
  if (persona === "hire") body = <HireView onBack={back} />;
  else if (persona === "collab") body = <CollabView onBack={back} />;
  else if (persona === "builder") body = <BuilderView onBack={back} />;
  else if (persona === "curious") body = <CuriousView onBack={back} />;
  else body = <Home onPick={pick} />;

  return (
    <div className="shell">
      <TopBar />
      {body}
      <Foot />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
