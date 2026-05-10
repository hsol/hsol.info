"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
} from "react";

const MIN_SCALE = 0.1;
const MAX_SCALE = 3;

type View = { scale: number; tx: number; ty: number };

export function MermaidPanZoomViewport({ children }: { children: ReactElement }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<HTMLDivElement>(null);
  const userAdjustedRef = useRef(false);
  const dragRef = useRef<{ active: boolean; px: number; py: number }>({
    active: false,
    px: 0,
    py: 0,
  });
  const debounceRef = useRef<number | undefined>(undefined);

  const [view, setView] = useState<View>({ scale: 1, tx: 0, ty: 0 });
  const [dragging, setDragging] = useState(false);

  const fitBounds = useCallback((force = false) => {
    if (userAdjustedRef.current && !force) return;
    const vp = viewportRef.current;
    const layer = transformRef.current;
    if (!vp || !layer) return;
    const inner = layer.firstElementChild as HTMLElement | null;
    if (!inner) return;
    const vw = vp.clientWidth;
    const vh = vp.clientHeight;
    if (vw < 8 || vh < 8) return;
    const bw = Math.max(inner.scrollWidth, inner.offsetWidth);
    const bh = Math.max(inner.scrollHeight, inner.offsetHeight);
    if (bw < 8 || bh < 8) return;
    const s = Math.min(vw / bw, vh / bh) * 0.94;
    const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
    const tx = (vw - bw * clamped) / 2;
    const ty = (vh - bh * clamped) / 2;
    setView({ scale: clamped, tx, ty });
  }, []);

  const scheduleIdleFit = useCallback(() => {
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = undefined;
      if (!userAdjustedRef.current) fitBounds(false);
    }, 72);
  }, [fitBounds]);

  const resetView = useCallback(() => {
    userAdjustedRef.current = false;
    window.clearTimeout(debounceRef.current);
    debounceRef.current = undefined;
    queueMicrotask(() => fitBounds(true));
  }, [fitBounds]);

  useLayoutEffect(() => {
    const vp = viewportRef.current;
    const layer = transformRef.current;
    if (!vp || !layer) return;
    const inner = layer.firstElementChild as HTMLElement | null;
    if (!inner) return;

    const roVp = new ResizeObserver(() => {
      scheduleIdleFit();
    });
    roVp.observe(vp);

    const roInner = new ResizeObserver(() => {
      scheduleIdleFit();
    });
    roInner.observe(inner);

    const mo = new MutationObserver(() => {
      scheduleIdleFit();
    });
    mo.observe(inner, { subtree: true, childList: true, attributes: true });

    scheduleIdleFit();
    const t = window.setTimeout(scheduleIdleFit, 150);
    const t2 = window.setTimeout(scheduleIdleFit, 500);

    return () => {
      roVp.disconnect();
      roInner.disconnect();
      mo.disconnect();
      window.clearTimeout(debounceRef.current);
      window.clearTimeout(t);
      window.clearTimeout(t2);
    };
  }, [scheduleIdleFit]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.09 : 1 / 1.09;
      userAdjustedRef.current = true;
      setView((prev) => {
        const newS = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev.scale * factor));
        const ratio = newS / prev.scale;
        return {
          scale: newS,
          tx: mx - ratio * (mx - prev.tx),
          ty: my - ratio * (my - prev.ty),
        };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const t = e.target as HTMLElement;
    if (t.closest("button,a,input,textarea,select")) return;
    dragRef.current = { active: true, px: e.clientX, py: e.clientY };
    userAdjustedRef.current = true;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.px;
    const dy = e.clientY - dragRef.current.py;
    dragRef.current.px = e.clientX;
    dragRef.current.py = e.clientY;
    setView((v) => ({ ...v, tx: v.tx + dx, ty: v.ty + dy }));
  }, []);

  const endDrag = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <div className="mermaid-panzoom-stack">
      <div className="mermaid-panzoom-toolbar">
        <span className="mermaid-panzoom-hint">휠로 확대·축소, 드래그로 이동</span>
        <button type="button" className="mermaid-panzoom-reset" onClick={resetView}>
          초기화
        </button>
      </div>
      <div
        ref={viewportRef}
        className={"mermaid-panzoom-viewport" + (dragging ? " is-dragging" : "")}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        role="application"
        aria-label="도식 확대·이동 영역"
      >
        <div
          ref={transformRef}
          className="mermaid-panzoom-transform"
          style={{
            transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`,
            transformOrigin: "0 0",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
