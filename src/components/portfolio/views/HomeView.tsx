"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Plate, PlanDiagram, useSiteData } from "@/components/portfolio/Atoms";
import { COORDS, type PersonaKey } from "@/components/portfolio/portfolio-types";
import { HomeBuiltFlowDiagram } from "@/components/portfolio/HomeBuiltFlowDiagram";

export function HomeView({ onPick }: { onPick: (key: PersonaKey) => void }) {
  const D = useSiteData();
  const [hovered, setHovered] = useState<PersonaKey | null>(null);
  const [autoIdx, setAutoIdx] = useState(0);
  const lastInteractRef = useRef(0);
  const bumpInteract = useCallback(() => {
    lastInteractRef.current = Date.now();
  }, []);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const keys = D.personas.map((p) => p.key);
    const tick = window.setInterval(() => {
      if (document.hidden || hovered) return;
      if (Date.now() - lastInteractRef.current < 1000) return;
      setAutoIdx((i) => (i + 1) % keys.length);
    }, 2000);
    return () => window.clearInterval(tick);
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
            <span>
              <b>{D.portfolioCopy.home.heroMetaSinceLabel}</b> {D.portfolioCopy.home.heroMetaSinceValue}
            </span>
            <span>
              <b>{D.portfolioCopy.home.heroMetaNowLabel}</b> {D.portfolioCopy.home.heroMetaNowValue}
            </span>
            <span>
              <b>{D.portfolioCopy.home.heroMetaBaseLabel}</b> {D.portfolioCopy.home.heroMetaBaseValue}
            </span>
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
          {D.personas.map((p) => (
            <button
              className={"persona" + (activeKey === p.key ? " is-hover" : "")}
              key={p.key}
              type="button"
              onClick={() => onPick(p.key as PersonaKey)}
              onMouseEnter={() => {
                setHovered(p.key as PersonaKey);
                bumpInteract();
              }}
              onMouseLeave={() => setHovered(null)}
            >
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
          ))}
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
        <HomeBuiltFlowDiagram />
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
            <picture>
              <source srcSet="/hansol.avif" type="image/avif" />
              <source srcSet="/hansol.webp" type="image/webp" />
              <Image
                src="/hansol.png"
                alt={D.identity.name}
                width={189}
                height={172}
                loading="lazy"
                sizes="(max-width: 720px) 120px, 200px"
              />
            </picture>
          </div>
        </div>
      </section>
    </div>
  );
}
