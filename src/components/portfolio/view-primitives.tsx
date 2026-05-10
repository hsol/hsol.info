import type { ReactNode } from "react";

export function renderTitleLines(lines: string[]): ReactNode {
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

export function ViewHead({
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
    </div>
  );
}

/** 페르소나 뷰에서 풀 타임라인(또는 간트) 바로 위 자기소개형 본문 */
export function PersonaTimelineIntro({ text }: { text: string }) {
  return <p className="persona-timeline-intro">{text}</p>;
}
