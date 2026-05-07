/* hsol.info — persona views */

// ============================================================
// 01 HIRE — 채용·영입 검토자
// ============================================================
function HireView({ onBack }) {
  const D = window.HSOL_DATA;
  const tier1 = D.career.filter(c => c.tier === 1);
  return (
    <div className="view">
      <Back onBack={onBack} />
      <div className="view-eyebrow">For — 01 / Considering hiring</div>
      <h1 className="view-title">10년 차 엔지니어,<br/>제품·운영·창업을 거친 사람.</h1>
      <p className="view-lede">
        엔지니어로 시작해 토스 인터널 제품 4년 10개월, 두 번의 창업, 옴니채널 플랫폼 리드까지 — 
        "기능을 잘 만드는 사람"보다 "무엇을 만들지 정하고 끝까지 가져가는 사람"으로 자랐습니다.
      </p>

      <div className="sec">
        <SecHead title="Strengths" num="3 pillars" />
        <Pillars />
      </div>

      <div className="sec">
        <SecHead title="Selected experience" num={`${tier1.length} roles`} />
        <CareerList items={tier1} />
      </div>

      <div className="sec">
        <SecHead title="Facts" num="basic" />
        <div className="facts">
          <div className="fact"><div className="fact-label">Years</div><div className="fact-value">10년+ (since 2014)</div></div>
          <div className="fact"><div className="fact-label">Base</div><div className="fact-value">{D.identity.location}</div></div>
          <div className="fact"><div className="fact-label">Education</div><div className="fact-value">{D.education[0].school} · {D.education[0].degree}</div></div>
          <div className="fact"><div className="fact-label">Languages</div><div className="fact-value">{D.languages.map(l => `${l.name}(${l.level.split(' ')[0]})`).join(' · ')}</div></div>
        </div>
      </div>

      <CoffeeCTA
        title="이력서 한 장으로는 다 담기지 않는 이야기가 있습니다."
        sub="30분 커피챗으로, 어떤 자리에 어떤 기여가 가능할지 직접 이야기 나눠요."
      />
    </div>
  );
}

// ============================================================
// 02 COLLAB — 창업·협업·자문
// ============================================================
function CollabView({ onBack }) {
  const D = window.HSOL_DATA;
  return (
    <div className="view">
      <Back onBack={onBack} />
      <div className="view-eyebrow">For — 02 / Looking for collaboration</div>
      <h1 className="view-title">기술과 운영 사이,<br/>다리를 놓는 일을 합니다.</h1>
      <p className="view-lede">
        지금 세 곳에서 — 프루퍼(대표), PPB Studios(팀장), 라이트형제(자문) — 동시에 움직이고 있습니다.
        공통점은 모두 "흩어진 부서·채널·역할을 하나의 시스템으로 묶는 일"이라는 점입니다.
      </p>

      <div className="sec">
        <SecHead title="What I'm building now" num="active" />
        <CareerList items={D.career.filter(c => c.period.includes("현재"))} />
      </div>

      <div className="sec">
        <SecHead title="How I work" num="approach" />
        <div className="pillars">
          <div className="pillar">
            <div className="pillar-name">
              <span className="ko">문제부터 다시 그린다</span>
              <span className="en">Reframe before build</span>
            </div>
            <div className="pillar-blurb">의뢰가 들어와도 "그게 정말 그 문제냐"부터 묻습니다. 토스 인터널 제품도, PPB의 옴니채널도 의뢰받은 명세 그대로가 아니라 한 단계 위에서 다시 정의한 결과였습니다.</div>
          </div>
          <div className="pillar">
            <div className="pillar-name">
              <span className="ko">가설을 가장 작게 잘라낸다</span>
              <span className="en">Smallest viable test</span>
            </div>
            <div className="pillar-blurb">한 번에 큰 시스템을 만들지 않습니다. 가장 작고 가장 빨리 검증 가능한 형태로 잘라낸 뒤, 진짜 사용 데이터를 보고 다음 한 걸음을 정합니다.</div>
          </div>
          <div className="pillar">
            <div className="pillar-name">
              <span className="ko">AI를 도구가 아닌 문화로</span>
              <span className="en">AI as culture</span>
            </div>
            <div className="pillar-blurb">PPB에서는 Claude Code + Linear 기반 바이브 코딩 프로토콜을 설계해 도입했습니다. 도메인별 반복 업무의 AI 전환을 코칭하며, 팀이 AI Native하게 일하게 만드는 일을 합니다.</div>
          </div>
        </div>
      </div>

      <div className="sec">
        <SecHead title="Past advisory" num="reference" />
        <CareerList items={D.career.filter(c => c.tags && c.tags.includes("자문")).concat(D.career.filter(c => c.org === "Antler"))} />
      </div>

      <CoffeeCTA
        title="협업의 형태는 자유입니다."
        sub="자문 · 공동 창업 · 기술 파트너십 · 단발성 컨설팅 — 무엇이든 30분 통화부터 시작해요."
      />
    </div>
  );
}

// ============================================================
// 03 BUILDER — 동료 빌더
// ============================================================
function BuilderView({ onBack }) {
  const D = window.HSOL_DATA;
  return (
    <div className="view">
      <Back onBack={onBack} />
      <div className="view-eyebrow">For — 03 / Fellow builder</div>
      <h1 className="view-title">코드도 짜고, 무엇을 만들지도 정합니다.</h1>
      <p className="view-lede">
        2014년 외주개발사 풀스택부터, 리디·토스 인터널 제품, 그리고 지금은 AI Native 워크플로우와 
        개발자 생산성 — 10년 동안 \"제품을 만든다는 것"의 정의를 계속 갱신해 왔습니다.
      </p>

      <div className="sec">
        <SecHead title="Stack & domain" num="practical" />
        <div className="facts">
          <div className="fact">
            <div className="fact-label">언어 / 런타임</div>
            <div className="fact-value">TypeScript · Python · Java · PHP · ASP.NET (legacy)</div>
          </div>
          <div className="fact">
            <div className="fact-label">관심 도메인</div>
            <div className="fact-value">Internal tools · Developer productivity · Omni-channel · AX</div>
          </div>
          <div className="fact">
            <div className="fact-label">AI workflow</div>
            <div className="fact-value">Claude Code · Linear · Vibe coding protocol</div>
          </div>
          <div className="fact">
            <div className="fact-label">자격</div>
            <div className="fact-value">{D.certifications.join(' · ')}</div>
          </div>
        </div>
      </div>

      <div className="sec">
        <SecHead title="Career as engineer" num="full timeline" />
        <CareerList items={D.career} />
      </div>

      <div className="sec">
        <SecHead title="Writing" num="publications" />
        <div className="pillars">
          {D.publications.map((p, i) => (
            <div className="pillar" key={i}>
              <div className="pillar-name">
                <span className="ko">{p.title}</span>
                <span className="en">Publication</span>
              </div>
              <div className="pillar-blurb">{p.desc}</div>
            </div>
          ))}
          <div className="pillar">
            <div className="pillar-name">
              <span className="ko">Measurable Developer</span>
              <span className="en">Newsletter</span>
            </div>
            <div className="pillar-blurb">개발자 생산성을 측정 가능한 형태로 다루는 뉴스레터. 프루퍼 CTO 시절부터 발행해 왔습니다.</div>
          </div>
        </div>
      </div>

      <CoffeeCTA
        title="비슷한 문제를 풀고 있다면, 이야기해봐요."
        sub="개발자 생산성, 인터널 툴, AI 도입, 옴니채널 — 한쪽이 일방적으로 가르치는 자리가 아니라 서로의 지도를 나누는 자리로 만들고 싶어요."
      />
    </div>
  );
}

// ============================================================
// 04 CURIOUS — 그냥 궁금한 사람
// ============================================================
function CuriousView({ onBack }) {
  const D = window.HSOL_DATA;
  const timeline = [
    { year: "2012 — 2014", title: "선린인터넷고등학교 정보통신과", desc: "코드를 처음 만난 시기. 웹디자인기능사·정보처리기능사를 땄습니다." },
    { year: "2014", title: "씨엔티테크 입사", desc: "프랜차이즈 도메인의 풀스택 외주 개발자로 사회생활 시작. ASP.NET, JSP, PHP — 가리지 않고 썼습니다." },
    { year: "2016", title: "리디북스로 이직", desc: "B2B 도구 — CMS와 작가/매니저 플랫폼을 만들며 \"내부 사용자\"라는 관점을 처음 익혔습니다." },
    { year: "2018 — 2023", title: "토스 인터널 제품팀, 4년 10개월", desc: "토스인터널, 티티(time-tracker), 3 month review, 비바뉴스 — 동료들이 매일 쓰는 제품을 만드는 일이 가장 즐거웠습니다." },
    { year: "2018 — 2022", title: "건국대학교 경영공학사", desc: "Advanced Industry Fusion 전공. 일하면서 학교를 다녔습니다." },
    { year: "2023.10", title: "Antler EIR", desc: "글로벌 초기 VC 프로그램. 창업의 형태에 대해 본격적으로 고민한 시기." },
    { year: "2024.01", title: "프루퍼 CTO — 첫 창업", desc: "개발자 생산성을 측정 가능한 형태로 다루는 일. 'Measurable Developer'와 '프루퍼 인사이트'를 만들었습니다." },
    { year: "2025.04", title: "프루퍼 대표(CEO) 전환", desc: "회사의 방향을 DX → AX 전환을 돕는 쪽으로 다시 그렸습니다." },
    { year: "2025.06 — 현재", title: "PPB Studios 팀장 합류", desc: "물류 — 가맹 — MD — 브랜드를 잇는 옴니채널 플랫폼 리드. AI Native 팀 문화를 함께 구축 중." },
  ];

  return (
    <div className="view">
      <Back onBack={onBack} />
      <div className="view-eyebrow">For — 04 / Just curious</div>
      <h1 className="view-title">한 사람의 10년치<br/>궤적을 펼쳐놓으면.</h1>
      <p className="view-lede">
        엔지니어 → 인터널 제품 메이커 → 자문가 → 창업가 → 옴니채널 리드 — 
        한 줄로 적으면 점프처럼 보이지만 사이사이는 이어져 있습니다. 
        시간순으로 천천히 따라가보셔도 좋습니다.
      </p>

      <div className="sec">
        <SecHead title="Timeline" num="2012 — now" />
        <div className="timeline">
          {timeline.map((t, i) => (
            <div className="tl-item" key={i}>
              <div className="tl-year">{t.year}</div>
              <div className="tl-title">{t.title}</div>
              <div className="tl-desc">{t.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="sec">
        <SecHead title="A bit personal" num="off-record" />
        <div className="pillars">
          <div className="pillar">
            <div className="pillar-name">
              <span className="ko">메이커와 엔지니어 사이</span>
              <span className="en">Maker × Engineer</span>
            </div>
            <div className="pillar-blurb">"메이커와 엔지니어 — 개발자가 됐습니다. 그 다음은요?" 라는 글을 썼습니다. 코드 그 자체보다, 코드로 만들어진 것이 누군가의 하루를 어떻게 바꾸는지가 더 흥미로워요.</div>
          </div>
          <div className="pillar">
            <div className="pillar-name">
              <span className="ko">선린 → 토스 → 창업</span>
              <span className="en">A non-linear path</span>
            </div>
            <div className="pillar-blurb">실업계 고등학교에서 시작해 외주개발사 → 사용자 제품 회사 → 사내 제품팀 → 자문 → VC 프로그램 → 창업으로 이어진 길은 처음부터 계획된 게 아니었습니다. 매 시점 가장 흥미로운 다음 한 걸음을 골랐을 뿐입니다.</div>
          </div>
        </div>
      </div>

      <CoffeeCTA
        title="시간이 맞다면, 30분만 빌려주세요."
        sub="이 페이지를 끝까지 읽어주신 게 이미 큰 일입니다. 더 듣고 싶은 얘기가 있다면 직접 만나서요."
      />
    </div>
  );
}

Object.assign(window, { HireView, CollabView, BuilderView, CuriousView });
