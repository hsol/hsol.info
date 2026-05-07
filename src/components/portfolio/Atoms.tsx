"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { HSOL_DATA } from "@/data/site";
import type { SiteData } from "@/data/site";

type CareerItem = SiteData["career"][number];

export function Plate() {
  const d = HSOL_DATA.identity;
  return (
    <div className="plate">
      <div className="plate-cell plate-id">
        <img src="/signature.svg" alt="" className="plate-sig" width={36} height={36} />
        <div>
          <div className="plate-key">Person</div>
          <div className="plate-val">임한솔 · Hansol Lim</div>
        </div>
      </div>
      <div className="plate-cell">
        <div className="plate-key">Site</div>
        <div className="plate-val">hsol.info</div>
      </div>
      <a href={d.calendly} target="_blank" rel="noopener noreferrer" className="plate-cell plate-cell-link">
        <div className="plate-key">Status</div>
        <div className="plate-status">
          <span className="dot"></span>Open for coffee
        </div>
      </a>
    </div>
  );
}

type RoomSpec = {
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
  lx: number;
  ly: number;
  ax: number;
  ay: number;
  label: string;
  area: string;
  furniture: ReactNode;
};

export function PlanDiagram({
  onPick,
  hovered,
  onHover,
}: {
  onPick?: (key: string) => void;
  hovered?: string | null;
  onHover?: (key: string | null) => void;
}) {
  const rooms: RoomSpec[] = [
    {
      key: "hire",
      x: 20,
      y: 20,
      w: 180,
      h: 160,
      lx: 50,
      ly: 55,
      ax: 50,
      ay: 68,
      label: "01 / HIRE",
      area: "— 26.4 m²",
      furniture: (
        <g>
          <rect x="50" y="100" width="120" height="22" fill="none" stroke="#f4c977" strokeWidth="0.8" />
          <circle cx="110" cy="142" r="9" fill="none" stroke="#f4c977" strokeWidth="0.8" />
          <line x1="50" y1="111" x2="170" y2="111" stroke="#f4c977" strokeWidth="0.4" strokeDasharray="2 2" />
        </g>
      ),
    },
    {
      key: "collab",
      x: 200,
      y: 20,
      w: 140,
      h: 260,
      lx: 225,
      ly: 55,
      ax: 225,
      ay: 68,
      label: "02 / COLLAB",
      area: "— 38.0 m²",
      furniture: (
        <g>
          <rect x="240" y="120" width="60" height="100" fill="none" stroke="#f4c977" strokeWidth="0.8" />
          <circle cx="225" cy="140" r="6" fill="none" stroke="#f4c977" strokeWidth="0.6" />
          <circle cx="225" cy="170" r="6" fill="none" stroke="#f4c977" strokeWidth="0.6" />
          <circle cx="225" cy="200" r="6" fill="none" stroke="#f4c977" strokeWidth="0.6" />
          <circle cx="315" cy="140" r="6" fill="none" stroke="#f4c977" strokeWidth="0.6" />
          <circle cx="315" cy="170" r="6" fill="none" stroke="#f4c977" strokeWidth="0.6" />
          <circle cx="315" cy="200" r="6" fill="none" stroke="#f4c977" strokeWidth="0.6" />
        </g>
      ),
    },
    {
      key: "builder",
      x: 200,
      y: 280,
      w: 140,
      h: 160,
      lx: 225,
      ly: 305,
      ax: 225,
      ay: 318,
      label: "03 / BUILDER",
      area: "— 22.4 m²",
      furniture: (
        <g>
          <rect x="220" y="350" width="46" height="22" fill="none" stroke="#f4c977" strokeWidth="0.8" />
          <rect x="276" y="350" width="46" height="22" fill="none" stroke="#f4c977" strokeWidth="0.8" />
          <line x1="243" y1="372" x2="243" y2="384" stroke="#f4c977" strokeWidth="0.6" />
          <line x1="299" y1="372" x2="299" y2="384" stroke="#f4c977" strokeWidth="0.6" />
        </g>
      ),
    },
    {
      key: "curious",
      x: 120,
      y: 280,
      w: 80,
      h: 160,
      lx: 130,
      ly: 305,
      ax: 130,
      ay: 318,
      label: "04 / CURIOUS",
      area: "— 14.4 m²",
      furniture: (
        <g>
          <circle cx="145" cy="370" r="10" fill="none" stroke="#f4c977" strokeWidth="0.8" />
          <circle cx="180" cy="400" r="10" fill="none" stroke="#f4c977" strokeWidth="0.8" />
          <line x1="135" y1="350" x2="195" y2="350" stroke="#f4c977" strokeWidth="0.4" strokeDasharray="2 2" />
        </g>
      ),
    },
  ];

  return (
    <div className="plan">
      <div className="plan-label">FLOOR PLAN · 1:50</div>
      <div className="plan-label-r">N ↑</div>
      <svg
        className="plan-svg"
        viewBox="0 0 360 460"
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="20" y="20" width="320" height="420" fill="none" stroke="#5e93b1" strokeWidth="2" />
        <line x1="20" y1="180" x2="200" y2="180" stroke="#5e93b1" strokeWidth="1.2" />
        <line x1="200" y1="20" x2="200" y2="280" stroke="#5e93b1" strokeWidth="1.2" />
        <line x1="200" y1="280" x2="340" y2="280" stroke="#5e93b1" strokeWidth="1.2" />
        <line x1="120" y1="280" x2="120" y2="440" stroke="#5e93b1" strokeWidth="1.2" />
        <line x1="120" y1="280" x2="200" y2="280" stroke="#5e93b1" strokeWidth="1.2" />

        {rooms.map((r) => {
          const active = hovered === r.key;
          return (
            <g
              key={r.key}
              onClick={() => onPick?.(r.key)}
              onMouseEnter={() => onHover?.(r.key)}
              onMouseLeave={() => onHover?.(null)}
              style={{ cursor: onPick ? "pointer" : "default" }}
            >
              <rect
                x={r.x}
                y={r.y}
                width={r.w}
                height={r.h}
                fill={active ? "rgba(244,201,119,0.18)" : "rgba(94,147,177,0.04)"}
                stroke={active ? "#f4c977" : "transparent"}
                strokeWidth={active ? 1.5 : 0}
                style={{ transition: "fill 200ms ease, stroke 200ms ease" }}
              />
              <text
                x={r.lx}
                y={r.ly}
                fill={active ? "#f4c977" : "#7fb4d0"}
                fontFamily="JetBrains Mono, monospace"
                fontSize="9"
                letterSpacing="1"
                style={{ transition: "fill 200ms ease", pointerEvents: "none" }}
              >
                {r.label}
              </text>
              <text
                x={r.ax}
                y={r.ay}
                fill={active ? "#f4c977" : "#8fb1c4"}
                fontFamily="JetBrains Mono, monospace"
                fontSize="7"
                style={{ transition: "fill 200ms ease", pointerEvents: "none" }}
              >
                {r.area}
              </text>
              <g
                style={{
                  opacity: active ? 1 : 0,
                  transform: active ? "scale(1)" : "scale(0.92)",
                  transformOrigin: `${r.x + r.w / 2}px ${r.y + r.h / 2}px`,
                  transition: "opacity 280ms ease, transform 320ms cubic-bezier(.2,.8,.2,1)",
                  pointerEvents: "none",
                }}
              >
                {r.furniture}
              </g>
            </g>
          );
        })}

        <line x1="100" y1="180" x2="130" y2="180" stroke="#0e2a3d" strokeWidth="3" pointerEvents="none" />
        <line x1="200" y1="100" x2="200" y2="130" stroke="#0e2a3d" strokeWidth="3" pointerEvents="none" />
        <line x1="200" y1="220" x2="200" y2="250" stroke="#0e2a3d" strokeWidth="3" pointerEvents="none" />
        <line x1="160" y1="280" x2="190" y2="280" stroke="#0e2a3d" strokeWidth="3" pointerEvents="none" />
        <g pointerEvents="none">
          <path d="M 100 180 A 30 30 0 0 1 130 150" fill="none" stroke="#3d7a9c" strokeWidth="0.7" strokeDasharray="2 2" />
          <path d="M 200 100 A 30 30 0 0 1 230 130" fill="none" stroke="#3d7a9c" strokeWidth="0.7" strokeDasharray="2 2" />
          <path d="M 200 220 A 30 30 0 0 0 230 250" fill="none" stroke="#3d7a9c" strokeWidth="0.7" strokeDasharray="2 2" />
          <path d="M 160 280 A 30 30 0 0 0 190 310" fill="none" stroke="#3d7a9c" strokeWidth="0.7" strokeDasharray="2 2" />
        </g>

        <g pointerEvents="none">
          <circle cx="155" cy="225" r="3" fill="#f4c977" />
          <circle cx="155" cy="225" r="9" fill="none" stroke="#f4c977" strokeWidth="0.6" opacity="0.7" />
          <text x="170" y="228" fill="#f4c977" fontFamily="JetBrains Mono, monospace" fontSize="8" letterSpacing="1">
            ENTRY
          </text>
          <line x1="20" y1="450" x2="340" y2="450" stroke="#3d7a9c" strokeWidth="0.5" />
          <line x1="20" y1="445" x2="20" y2="455" stroke="#3d7a9c" strokeWidth="0.5" />
          <line x1="340" y1="445" x2="340" y2="455" stroke="#3d7a9c" strokeWidth="0.5" />
          <text x="180" y="448" fill="#5b819a" fontFamily="JetBrains Mono, monospace" fontSize="7" textAnchor="middle">
            10 yr · since 2014
          </text>
        </g>
      </svg>
    </div>
  );
}

export function Foot() {
  const d = HSOL_DATA.identity;
  return (
    <footer className="foot">
      <div>
        © {new Date().getFullYear()} · {d.location}
      </div>
      <div className="foot-mid">— hsol.info — a living portfolio —</div>
      <div className="foot-links">
        <a href={d.linkedin} target="_blank" rel="noopener noreferrer">
          LinkedIn
        </a>
        <a href={`mailto:${d.email}`}>Email</a>
        <a href={d.calendly} target="_blank" rel="noopener noreferrer">
          Calendly
        </a>
        <a href={d.company} target="_blank" rel="noopener noreferrer">
          Proofer
        </a>
      </div>
    </footer>
  );
}

export function SecHead({
  title,
  num,
  meta,
}: {
  title: string;
  num?: string | number | null;
  meta?: string | null;
}) {
  return (
    <div className="sec-head">
      <div className="sec-title">
        {num != null && <span className="num">§ {num}</span>}
        {title}
      </div>
      {meta && <div className="sec-meta">{meta}</div>}
    </div>
  );
}

export function CoffeeCTA({ title, sub }: { title?: string; sub?: string }) {
  const d = HSOL_DATA.identity;
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!document.querySelector("link[data-calendly]")) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://assets.calendly.com/assets/external/widget.css";
      link.dataset.calendly = "1";
      document.head.appendChild(link);
    }
    const ensureWidget = () => {
      if (!window.Calendly || !ref.current) return false;
      ref.current.innerHTML = "";
      window.Calendly.initInlineWidget({
        url:
          d.calendly +
          "?hide_gdpr_banner=1&background_color=0e2a3d&text_color=f2f7fa&primary_color=7fb4d0",
        parentElement: ref.current,
      });
      return true;
    };
    if (!ensureWidget()) {
      let s = document.querySelector(
        "script[data-calendly]",
      ) as HTMLScriptElement | null;
      if (!s) {
        s = document.createElement("script");
        s.src = "https://assets.calendly.com/assets/external/widget.js";
        s.async = true;
        s.dataset.calendly = "1";
        document.body.appendChild(s);
      }
      s.addEventListener("load", ensureWidget, { once: true });
    }
  }, [d.calendly]);

  return (
    <div className="cta cta-calendly">
      <div className="cta-head">
        <div className="cta-eyebrow">Coffee chat — 30 min</div>
        <div className="cta-title">{title || "직접 이야기를 나눠봐도 좋습니다."}</div>
        <p className="cta-sub">
          {sub ||
            "채용·창업·협업·그냥 궁금함 — 어떤 주제든 환영합니다. 아래 캘린더에서 시간을 잡아주세요."}
        </p>
      </div>
      <div className="cta-cal" ref={ref} aria-label="Calendly scheduling widget" />
      <a href={d.calendly} target="_blank" rel="noopener noreferrer" className="cta-fallback">
        새 창으로 calendly 열기 →
      </a>
    </div>
  );
}

export function Back({ onBack }: { onBack: () => void }) {
  return (
    <button type="button" className="back" onClick={onBack}>
      <span className="back-arrow">←</span> 처음으로 돌아가기
    </button>
  );
}

export function CareerList({ items }: { items: readonly CareerItem[] | CareerItem[] }) {
  return (
    <div className="career">
      {items.map((c, i) => (
        <div className="career-item" key={i}>
          <div className="career-period">{c.period}</div>
          <div>
            <div className="career-org">{c.org}</div>
            <div className="career-role">{c.role}</div>
            <ul className="career-points">
              {c.points.map((p, j) => (
                <li key={j}>{p}</li>
              ))}
            </ul>
          </div>
          <div className="career-tags">
            {(c.tags ?? []).map((t, j) => (
              <span className="career-tag" key={j}>
                {t}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function Pillars() {
  return (
    <div className="pillars">
      {HSOL_DATA.pillars.map((p, i) => (
        <div className="pillar" key={p.key}>
          <div className="pillar-no">PILLAR · 0{i + 1}</div>
          <div className="pillar-name">{p.labelKo}</div>
          <div className="pillar-en">{p.label}</div>
          <div className="pillar-blurb">{p.blurb}</div>
        </div>
      ))}
    </div>
  );
}
