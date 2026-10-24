"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

/**
 * hsol.info 구조 그림(public/figures/hsol-flow.html, Anatomy 키트로 빌드)을 iframe 으로 싣고
 * 스크롤 진행도(0..1)를 그림의 단계에 넘긴다. 그림은 화면에 고정(sticky)된 채 스크롤 거리만큼 단계가 넘어간다.
 * 모션 줄이기 설정이면 고정하지 않고, 그림 안에서 화살표 키로 단계를 넘긴다.
 * 그림을 다시 만드는 스크립트는 docs/figures/hsol-flow/build2.mjs 에 있다.
 */
/** 그림 파일을 다시 빌드하면 올린다(브라우저 캐시 무효화). */
const SRC = "/figures/hsol-flow.html?v=3";
/** 단계 하나에 쓰는 스크롤 거리(뷰포트 높이 비율) */
const PER_STAGE_VH = 40;
const DEFAULT_STAGES = 10;
/** 자동 재생에서 단계 하나에 쓰는 시간(초) */
const AUTO_STAGE_SEC = 2.8;
/** 마지막 입력 뒤 자동 재생을 다시 시작하기까지(아래로 내리던 중이면 짧게, 위로 올리던 중이면 길게) */
const AUTO_RESUME_MS = 900;
const AUTO_RESUME_UP_MS = 2500;
/**
 * 진입 붙잡기: 아래로 스크롤하다 그림 구간에 들어오면 남은 관성 스크롤을 흘려보내고 첫 단계에서 멈춘다.
 * 관성 휠 입력이 CATCH_QUIET_MS 동안 끊기면 놓아주되, 최소 CATCH_MIN_MS 는 붙잡고 CATCH_MAX_MS 를 넘기지 않는다.
 */
const CATCH_MIN_MS = 450;
const CATCH_QUIET_MS = 220;
const CATCH_MAX_MS = 1800;
/** 그림 아래 진행 바 높이(px). 고정 구간의 가운데 정렬 계산에 함께 넣는다. */
const BAR_H = 44;

type FlowApi = { stages?: number; progress: (share: number) => void };
type FlowWindow = Window & { hsolFlow?: FlowApi };

export const FLOW_KEYS = [
  "지금 일하는 부품은 노란색으로 표시됩니다",
  "왼쪽 앞 책상: 블로그 1008편, Medium 49편, LinkedIn 댓글 174건 이상, 단행본 1권",
  "카드 서랍장: OneDrive vault. 왼쪽부터 원천 코퍼스, 객체, ObjectView 칸이고 위 선반은 메타 온톨로지",
  "프레스, 조판기, 게이트, 원페이저 장치: GitHub Actions 빌드와 LLM ETL",
  "단말과 키오스크: Vercel 위 Next.js 서버와 방문자 다섯 갈래",
  "오른쪽 뒤 상자: Neon Postgres 와 AI Gateway",
];

export const FLOW_CAPTION =
  "원본은 개인 OneDrive 의 vault 한 곳에만 있습니다. 블로그와 Medium, LinkedIn, 책은 원천 코퍼스로 보존되고, 사람과 Claude 가 객체 노트를 고칩니다. 감시 워크플로가 매시 17분에 바뀐 경로를 찾아 빌드를 디스패치하고, GitHub 스케줄이 빠지면 Vercel Cron 이 47분에 대신 깨웁니다. 빌드는 Claude 로 site-data 를 다시 쓰고, 페르소나 페이지 넷의 구성을 한 장씩 따로 만들고, 원페이저를 한국어로 쓴 뒤 영어로 옮겨 자기지칭 검사와 PDF 까지 마칩니다. 스키마 검증을 통과한 생성물만 object-views 로 되씁니다. 사이트는 새 배포를 기다리지 않고 Graph API 로 그 파일을 읽어 5분 동안 캐시하며, 읽지 못하면 로컬 사본, 커밋된 스냅샷 순으로 내려갑니다. Ask Hansol 은 대화창, JD 적합도, 드래그 질문 세 갈래로 들어와 vault 를 직접 찾아 답하고, 대화와 빌드 기록, 기사 사본은 Neon 에 쌓입니다.";

export function FlowFigure({ showKeys = false, className = "" }: { showKeys?: boolean; className?: string }) {
  const track = useRef<HTMLDivElement>(null);
  const sticky = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLDivElement>(null);
  const thumb = useRef<HTMLDivElement>(null);
  const count = useRef<HTMLSpanElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [stages, setStages] = useState(DEFAULT_STAGES);
  const [still, setStill] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setStill(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  // iframe 높이를 그림 카드 높이에 맞춘다(같은 출처라 문서를 직접 잰다).
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    let ro: ResizeObserver | null = null;
    const fit = () => {
      const doc = el.contentDocument;
      const card = doc?.querySelector(".iso-figure");
      if (card) setHeight(Math.ceil(card.getBoundingClientRect().height));
      const n = (el.contentWindow as FlowWindow | null)?.hsolFlow?.stages;
      if (n) setStages(n);
    };
    const attach = () => {
      fit();
      ro?.disconnect();
      const doc = el.contentDocument;
      if (doc?.body) {
        ro = new ResizeObserver(fit);
        ro.observe(doc.body);
      }
    };
    el.addEventListener("load", attach);
    if (el.contentDocument?.querySelector(".iso-figure")) attach();
    return () => {
      el.removeEventListener("load", attach);
      ro?.disconnect();
    };
  }, [still]);

  // 스크롤 위치 -> 단계 진행도.
  // 그림이 화면에 고정된 구간에서 손을 떼고 있으면 페이지를 천천히 아래로 내려 자동 재생하고,
  // 끝 단계를 지나면 고정이 풀리며 다음 내용으로 이어진다. 직접 스크롤하면 그만큼 빠르게 넘어간다.
  useEffect(() => {
    if (still || height === null) return;
    let raf = 0;
    let loop = 0;
    let last = 0;
    let carry = 0;
    let lastInput = 0;
    let lastDir = 1;
    let prevShare: number | null = null;
    let catchY = -1;
    let catchStart = 0;
    let dragging = false;
    const catching = () => {
      if (catchY < 0) return false;
      const now = performance.now();
      const age = now - catchStart;
      const quiet = now - lastInput > CATCH_QUIET_MS;
      if (age > CATCH_MAX_MS || (age > CATCH_MIN_MS && quiet)) {
        catchY = -1;
        return false;
      }
      return true;
    };
    const hold = () => window.scrollTo({ top: catchY, behavior: "instant" as ScrollBehavior });
    const measure = () => {
      const t = track.current;
      const s = sticky.current;
      if (!t || !s) return null;
      const box = t.getBoundingClientRect();
      const top = parseFloat(getComputedStyle(s).top) || 0;
      const span = box.height - s.offsetHeight;
      return { span, share: span > 0 ? (top - box.top) / span : 0 };
    };
    const update = () => {
      raf = 0;
      const win = frame.current?.contentWindow as FlowWindow | null | undefined;
      const m = measure();
      if (!m || !win?.hsolFlow) return;
      paintBar(m.share);
      if (dragging) {
        prevShare = m.share;
        win.hsolFlow.progress(Math.min(1, Math.max(0, m.share)));
        return;
      }
      // 위에서 내려오다 구간에 들어선 순간: 들어선 지점(첫 단계)으로 되돌리고 잠시 붙잡는다.
      if (prevShare !== null && prevShare < 0 && m.share > 0 && m.share < 1 && catchY < 0) {
        catchY = Math.round(window.scrollY - m.share * m.span);
        catchStart = performance.now();
        hold();
        prevShare = 0;
        win.hsolFlow.progress(0);
        return;
      }
      if (catching()) {
        if (window.scrollY > catchY + 1) hold();
        else if (window.scrollY < catchY - 1) catchY = -1; // 위로 올리면 놓아준다
        prevShare = 0;
        win.hsolFlow.progress(0);
        return;
      }
      prevShare = m.share;
      win.hsolFlow.progress(Math.min(1, Math.max(0, m.share)));
    };
    const queue = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    // 진행 바: 스크롤 위치를 그리고, 바를 끌거나 누르면 그 지점으로 페이지를 스크롤한다(양방향).
    const paintBar = (share: number) => {
      const v = Math.min(1, Math.max(0, share));
      const pct = `${(v * 100).toFixed(2)}%`;
      if (fill.current) fill.current.style.width = pct;
      if (thumb.current) thumb.current.style.left = pct;
      const n = Math.min(stages, Math.floor(v * stages) + 1);
      const text = `${String(n).padStart(2, "0")} / ${String(stages).padStart(2, "0")}`;
      if (count.current && count.current.textContent !== text) count.current.textContent = text;
      bar.current?.setAttribute("aria-valuenow", String(n));
    };
    const scrollToShare = (share: number) => {
      const t = track.current;
      const s = sticky.current;
      const m = measure();
      if (!t || !s || !m) return;
      const top = parseFloat(getComputedStyle(s).top) || 0;
      const trackTop = t.getBoundingClientRect().top + window.scrollY;
      const v = Math.min(1, Math.max(0, share));
      window.scrollTo({ top: Math.round(trackTop - top + v * m.span), behavior: "instant" as ScrollBehavior });
    };
    const shareAt = (clientX: number) => {
      const rail = bar.current?.querySelector(".flow-figure-bar-rail");
      if (!rail) return 0;
      const r = rail.getBoundingClientRect();
      return Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    };
    const onBarDown = (e: PointerEvent) => {
      dragging = true;
      catchY = -1;
      touched(1);
      bar.current?.setPointerCapture(e.pointerId);
      scrollToShare(shareAt(e.clientX));
      e.preventDefault();
    };
    const onBarMove = (e: PointerEvent) => {
      if (!dragging) return;
      touched(1);
      scrollToShare(shareAt(e.clientX));
    };
    const onBarUp = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      touched(1);
      if (bar.current?.hasPointerCapture(e.pointerId)) bar.current.releasePointerCapture(e.pointerId);
    };
    const onBarKey = (e: KeyboardEvent) => {
      const m = measure();
      if (!m) return;
      const here = Math.min(stages - 1, Math.floor(Math.min(1, Math.max(0, m.share)) * stages));
      let to: number | null = null;
      if (e.key === "ArrowRight" || e.key === "ArrowUp") to = Math.min(stages - 1, here + 1);
      if (e.key === "ArrowLeft" || e.key === "ArrowDown") to = Math.max(0, here - 1);
      if (e.key === "Home") to = 0;
      if (e.key === "End") to = stages - 1;
      if (to === null) return;
      e.preventDefault();
      e.stopPropagation();
      catchY = -1;
      touched(to < here ? -1 : 1);
      scrollToShare((to + 0.5) / stages);
    };
    // 자동 재생: 고정 구간 안에서 입력이 잠시 없으면 정해진 속도로 스크롤을 내린다.
    const tick = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 0;
      last = now;
      const m = measure();
      const quiet = now - lastInput > (lastDir < 0 ? AUTO_RESUME_UP_MS : AUTO_RESUME_MS);
      if (catching() || dragging) {
        carry = 0;
      } else if (m && m.span > 0 && m.share >= -0.002 && m.share < 0.999 && quiet && document.visibilityState === "visible") {
        carry += (m.span / (stages * AUTO_STAGE_SEC)) * dt;
        const step = Math.floor(carry);
        if (step >= 1) {
          carry -= step;
          window.scrollBy(0, step);
        }
      } else {
        carry = 0;
      }
      loop = requestAnimationFrame(tick);
    };
    const touched = (dir = 1) => {
      lastInput = performance.now();
      lastDir = dir;
    };
    const onWheel = (e: WheelEvent) => {
      touched(e.deltaY < 0 ? -1 : 1);
      // 붙잡는 동안 아래로 미는 관성 휠은 먹는다(위로 올리는 입력은 통과)
      if (catching() && e.deltaY > 0 && e.cancelable) e.preventDefault();
    };
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowUp", "PageUp", "Home"].includes(e.key)) touched(-1);
      else if (["ArrowDown", "PageDown", "End", " "].includes(e.key)) touched(1);
    };
    let touchY = 0;
    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0]?.clientY ?? 0;
      touched();
    };
    const onTouchMove = (e: TouchEvent) => touched((e.touches[0]?.clientY ?? 0) > touchY ? -1 : 1);
    const targets: (Window | null | undefined)[] = [window, frame.current?.contentWindow];
    const listen = () => {
      for (const w of targets) {
        w?.addEventListener("wheel", onWheel, { passive: false });
        w?.addEventListener("keydown", onKey);
        w?.addEventListener("touchstart", onTouchStart, { passive: true });
        w?.addEventListener("touchmove", onTouchMove, { passive: true });
      }
    };
    const unlisten = () => {
      for (const w of targets) {
        w?.removeEventListener("wheel", onWheel);
        w?.removeEventListener("keydown", onKey);
        w?.removeEventListener("touchstart", onTouchStart);
        w?.removeEventListener("touchmove", onTouchMove);
      }
    };
    const el = frame.current;
    const win = el?.contentWindow;
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    win?.addEventListener("hsolflow:ready", queue);
    el?.addEventListener("load", queue);
    listen();
    const b = bar.current;
    b?.addEventListener("pointerdown", onBarDown);
    b?.addEventListener("pointermove", onBarMove);
    b?.addEventListener("pointerup", onBarUp);
    b?.addEventListener("pointercancel", onBarUp);
    b?.addEventListener("keydown", onBarKey);
    queue();
    loop = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(loop);
      unlisten();
      b?.removeEventListener("pointerdown", onBarDown);
      b?.removeEventListener("pointermove", onBarMove);
      b?.removeEventListener("pointerup", onBarUp);
      b?.removeEventListener("pointercancel", onBarUp);
      b?.removeEventListener("keydown", onBarKey);
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
      win?.removeEventListener("hsolflow:ready", queue);
      el?.removeEventListener("load", queue);
    };
  }, [still, height, stages]);

  const pinned = !still && height !== null;
  const src = still ? SRC : `${SRC}&scroll`;

  return (
    <div className={"flow-figure " + className}>
      <div
        ref={track}
        className="flow-figure-track"
        style={pinned ? { height: `calc(${height + BAR_H}px + ${stages * PER_STAGE_VH}vh)` } : undefined}
      >
        <div
          ref={sticky}
          className={"flow-figure-sticky" + (pinned ? " is-pinned" : "")}
          style={height !== null ? ({ "--fig-h": `${height + (pinned ? BAR_H : 0)}px` } as CSSProperties) : undefined}
        >
          <iframe
            ref={frame}
            key={src}
            className="flow-figure-frame"
            src={src}
            title="hsol.info 구조 그림"
            style={height !== null ? { height } : undefined}
          />
          {pinned ? (
            <div
              ref={bar}
              className="flow-figure-bar"
              role="slider"
              tabIndex={0}
              aria-label="구조 그림 진행. 끌거나 화살표 키로 단계를 옮기면 페이지도 함께 스크롤됩니다"
              aria-valuemin={1}
              aria-valuemax={stages}
              aria-valuenow={1}
            >
              <div className="flow-figure-bar-rail">
                {Array.from({ length: stages - 1 }, (_, i) => (
                  <span key={i} className="flow-figure-bar-tick" style={{ left: `${((i + 1) / stages) * 100}%` }} />
                ))}
                <div ref={fill} className="flow-figure-bar-fill" />
                <div ref={thumb} className="flow-figure-bar-thumb" />
              </div>
              <span ref={count} className="flow-figure-bar-count">
                01 / {String(stages).padStart(2, "0")}
              </span>
            </div>
          ) : null}
        </div>
      </div>
      {showKeys ? (
        <ul className="flow-figure-keys">
          {FLOW_KEYS.map((key) => (
            <li key={key}>{key}</li>
          ))}
        </ul>
      ) : null}
      {/* 같은 설명은 그림 안에서 단계별 자막으로 나온다. 화면에서는 숨기고 검색과 스크린리더용으로 남긴다. */}
      <p className="flow-figure-caption">{FLOW_CAPTION}</p>
    </div>
  );
}
