import { useEffect, type RefObject } from "react";

/** `.shell` 안의 `[data-ask-section]` 중 뷰포트와 겹침이 가장 큰 블록 id를 Ask API `pageContext.detail`로 넘깁니다. */
export function useReportAskVisibleSection(
  shellRef: RefObject<HTMLDivElement | null>,
  viewKey: string,
  onPick: (detail: string | undefined) => void,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled) return;
    const root = shellRef.current;
    if (!root) return;

    const nodes = root.querySelectorAll<HTMLElement>("[data-ask-section]");
    if (nodes.length === 0) {
      onPick(undefined);
      return;
    }

    const ratios = new Map<Element, number>();
    let raf = 0;
    const apply = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        let bestEl: Element | null = null;
        let best = -1;
        for (const el of nodes) {
          const v = ratios.get(el) ?? 0;
          if (v > best) {
            best = v;
            bestEl = el;
          }
        }
        const label = bestEl?.getAttribute("data-ask-section")?.trim();
        onPick(label || undefined);
      });
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          ratios.set(e.target, e.intersectionRatio);
        }
        apply();
      },
      { root: null, threshold: [0, 0.5, 1] },
    );
    nodes.forEach((n) => io.observe(n));
    apply();

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ratios.clear();
    };
  }, [shellRef, viewKey, onPick, enabled]);
}
