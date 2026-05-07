/* hsol.info — small UI atoms shared across views */

const { useState, useEffect, useRef, useCallback } = React;

// ---------- Top Bar ----------
function TopBar() {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <img src="assets/signature.svg" alt="" className="sig" />
        <div className="topbar-name">
          <div className="ko">임한솔</div>
          <div className="en">Hansol Lim · hsol.info</div>
        </div>
      </div>
      <div className="topbar-right">
        <span><span className="dot"></span>Available for coffee</span>
      </div>
    </header>
  );
}

// ---------- Footer ----------
function Foot() {
  const d = window.HSOL_DATA.identity;
  return (
    <footer className="foot">
      <div>© {new Date().getFullYear()} 임한솔 · {d.location}</div>
      <div className="foot-links">
        <a href={d.linkedin} target="_blank" rel="noopener">LinkedIn</a>
        <a href={`mailto:${d.email}`}>Email</a>
        <a href={d.calendly} target="_blank" rel="noopener">Coffee chat</a>
        <a href={d.company} target="_blank" rel="noopener">Proofer</a>
      </div>
    </footer>
  );
}

// ---------- Section heading ----------
function SecHead({ title, num }) {
  return (
    <div className="sec-head">
      <div className="sec-title">{title}</div>
      {num != null && <div className="sec-num">{num}</div>}
    </div>
  );
}

// ---------- CTA ----------
function CoffeeCTA({ title, sub }) {
  const d = window.HSOL_DATA.identity;
  return (
    <a href={d.calendly} target="_blank" rel="noopener" className="cta" style={{ textDecoration: 'none' }}>
      <div>
        <div className="cta-eyebrow">Coffee chat — 30 min</div>
        <div className="cta-title">{title || "직접 이야기를 나눠봐도 좋습니다."}</div>
        <p className="cta-sub">{sub || "채용·창업·협업·그냥 궁금함 — 어떤 주제든 환영합니다. 캘린더에서 시간을 잡아주세요."}</p>
      </div>
      <span className="cta-btn">Schedule a chat →</span>
    </a>
  );
}

// ---------- Back button ----------
function Back({ onBack }) {
  return (
    <button className="back" onClick={onBack}>
      <span className="back-arrow">←</span> 처음으로
    </button>
  );
}

// ---------- Career list (reusable) ----------
function CareerList({ items }) {
  return (
    <div className="career">
      {items.map((c, i) => (
        <div className="career-item" key={i}>
          <div className="career-period">{c.period}</div>
          <div className="career-body">
            <div className="career-org">{c.org}</div>
            <div className="career-role">{c.role}</div>
            <ul className="career-points">
              {c.points.map((p, j) => <li key={j}>{p}</li>)}
            </ul>
            {c.tags && c.tags.length > 0 && (
              <div className="career-tags">
                {c.tags.map((t, j) => <span className="career-tag" key={j}>{t}</span>)}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- Pillars ----------
function Pillars() {
  return (
    <div className="pillars">
      {window.HSOL_DATA.pillars.map(p => (
        <div className="pillar" key={p.key}>
          <div className="pillar-name">
            <span className="ko">{p.labelKo}</span>
            <span className="en">{p.label}</span>
          </div>
          <div className="pillar-blurb">{p.blurb}</div>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { TopBar, Foot, SecHead, CoffeeCTA, Back, CareerList, Pillars });
