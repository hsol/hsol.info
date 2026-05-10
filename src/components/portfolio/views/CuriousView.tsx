"use client";

import { useState } from "react";
import { Back, CoffeeCTA, SecHead, useSiteData } from "@/components/portfolio/Atoms";
import { renderTitleLines, ViewHead } from "@/components/portfolio/view-primitives";

function parseTimelineRange(t: { year: string }) {
  const NOW = 2025 + 11 / 12;
  const m = t.year.match(/(\d{4})(?:\.(\d{1,2}))?\s*(?:[—\-~]\s*(현재|now|(\d{4})(?:\.(\d{1,2}))?))?/);
  if (!m) return { start: NOW, end: NOW };
  const sY = parseInt(m[1], 10);
  const sM = m[2] ? parseInt(m[2], 10) : 1;
  const start = sY + (sM - 1) / 12;
  let end;
  if (!m[3]) {
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
  const ranges = items.map(parseTimelineRange);
  const minY = Math.floor(Math.min(...ranges.map((r) => r.start)));
  const lastY = Math.ceil(Math.max(...ranges.map((r) => r.end)));
  const now = new Date();
  const currentY = now.getFullYear() + now.getMonth() / 12;
  const FUTURE_YEARS = 3;
  const maxY = Math.max(lastY, Math.ceil(currentY) + FUTURE_YEARS);
  const span = maxY - minY;
  const years = [];
  for (let y = minY; y <= maxY; y++) years.push(y);
  const YEAR_W = 64;
  const chartW = span * YEAR_W;
  const span_pct = (v: number) => ((v - minY) / span) * 100;

  const placed = items.map((it, i) => ({ ...it, ...ranges[i], row: i }));
  const rowCount = items.length;
  const ROW_H = 44;
  const HEAD_H = 28;
  const totalH = HEAD_H + rowCount * ROW_H + 16;

  return (
    <div className="gantt-scroll">
      <div className="gantt" style={{ height: totalH, width: chartW }}>
        <div className="gantt-axis" style={{ height: HEAD_H }}>
          {years.map((y) => (
            <div className="gantt-tick" key={y} style={{ left: `${span_pct(y)}%` }}>
              <span className={"gantt-tick-y" + (y > lastY ? " future" : "")}>{`'${String(y).slice(2)}`}</span>
            </div>
          ))}
        </div>
        <div className="gantt-grid" style={{ top: HEAD_H, height: rowCount * ROW_H }}>
          {years.map((y) => (
            <div
              className={"gantt-gline" + (y > lastY ? " future" : "")}
              key={y}
              style={{ left: `${span_pct(y)}%` }}
            />
          ))}
        </div>
        <div
          className="gantt-now"
          style={{
            left: `${span_pct((() => {
              const d = new Date();
              return d.getFullYear() + d.getMonth() / 12;
            })())}%`,
            top: HEAD_H,
            height: rowCount * ROW_H + 16,
          }}
        >
          <span>NOW</span>
        </div>
        {placed.map((p, i) => {
          const left = span_pct(p.start);
          const width = Math.max(1.2, span_pct(p.end) - span_pct(p.start));
          const top = HEAD_H + p.row * ROW_H + 4;
          return (
            <div
              key={i}
              className={
                "gantt-bar" + (p.row >= rowCount - 2 ? " bottom" : "") + (active === i ? " active" : "")
              }
              style={{ left: `${left}%`, width: `${width}%`, top }}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
            >
              <div className="gantt-bar-inner" style={{ borderColor: accent || "#5e93b1" }}>
                <div className="gantt-bar-title">{p.title}</div>
                <div className="gantt-bar-year">{p.year}</div>
              </div>
              {active === i && (
                <div className="gantt-pop">
                  <div className="gantt-pop-year">{p.year}</div>
                  <div className="gantt-pop-title">{p.title}</div>
                  <div className="gantt-pop-desc">{p.desc}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CuriousView({
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
        lede={D.viewHeaders.curious.lede}
      />

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
      <CoffeeCTA title={D.portfolioCopy.curious.coffee.title} sub={D.portfolioCopy.curious.coffee.sub} />
    </div>
  );
}
