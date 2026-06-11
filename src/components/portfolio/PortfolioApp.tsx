"use client";

import { usePathname, useRouter } from "next/navigation";
import { lazy } from "@/lib/lazy-dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Foot, Plate, SiteDataProvider } from "@/components/portfolio/Atoms";
import { DeferredChatDock } from "@/components/DeferredChatDock";
import type { SiteData } from "@/content/schema";
import type { AskHansolPageContext } from "@/lib/ask-hansol/client";
import { personaFromPathname, type AskDraft, type PersonaKey } from "@/components/portfolio/portfolio-types";
import { useReportAskVisibleSection } from "@/components/portfolio/use-report-ask-visible-section";
import { HomeView } from "@/components/portfolio/views/HomeView";

const HireView = lazy(() =>
  import("@/components/portfolio/views/HireView").then((m) => ({ default: m.HireView })),
);
const CollabView = lazy(() =>
  import("@/components/portfolio/views/CollabView").then((m) => ({ default: m.CollabView })),
);
const BuilderView = lazy(() =>
  import("@/components/portfolio/views/BuilderView").then((m) => ({ default: m.BuilderView })),
);
const CuriousView = lazy(() =>
  import("@/components/portfolio/views/CuriousView").then((m) => ({ default: m.CuriousView })),
);

const DEFAULT_ACCENT = "#287099";

function PortfolioAppBody() {
  const pathname = usePathname();
  const router = useRouter();
  const persona = useMemo(() => personaFromPathname(pathname), [pathname]);

  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [askVisibleSection, setAskVisibleSection] = useState<string | undefined>();
  const [chatOpenSignal, setChatOpenSignal] = useState(0);
  const [draftToAsk, setDraftToAsk] = useState<AskDraft | null>(null);
  const [selectionNudge, setSelectionNudge] = useState<{
    text: string;
    x: number;
    y: number;
    placeAbove: boolean;
  } | null>(null);
  const [askTrackingReady, setAskTrackingReady] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.style.setProperty("--accent", DEFAULT_ACCENT);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 768px)");
    const apply = () => setIsMobileViewport(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  const pick = useCallback(
    (key: PersonaKey) => {
      router.push(`/${key}`);
    },
    [router],
  );
  const back = useCallback(() => {
    router.push("/");
  }, [router]);

  const viewKey = persona ?? "home";
  useReportAskVisibleSection(shellRef, viewKey, setAskVisibleSection, askTrackingReady);

  useEffect(() => {
    const run = () => setAskTrackingReady(true);
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(run, { timeout: 3000 });
      return () => cancelIdleCallback(id);
    }
    const t = window.setTimeout(run, 1500);
    return () => window.clearTimeout(t);
  }, []);

  const pageContext: AskHansolPageContext = useMemo(
    () => ({
      view: persona ?? "home",
      section: persona === null ? "home" : "detail",
      hash: pathname || "/",
      detail: askVisibleSection,
    }),
    [persona, askVisibleSection, pathname],
  );

  useEffect(() => {
    if (!askTrackingReady) return;

    const normalizeSelectedText = (value: string) => value.replace(/\s+/g, " ").trim();
    const extractElement = (node: Node | null): Element | null => {
      if (!node) return null;
      return node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
    };

    const updateSelectionNudge = () => {
      const shell = shellRef.current;
      if (!shell) return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        setSelectionNudge(null);
        return;
      }

      const anchorEl = extractElement(sel.anchorNode);
      const focusEl = extractElement(sel.focusNode);
      if (!anchorEl || !focusEl || !shell.contains(anchorEl) || !shell.contains(focusEl)) {
        setSelectionNudge(null);
        return;
      }

      const common = extractElement(sel.getRangeAt(0).commonAncestorContainer);
      if (common?.closest("input, textarea, button, [contenteditable='true']")) {
        setSelectionNudge(null);
        return;
      }

      const text = normalizeSelectedText(sel.toString());
      if (!text || text.length < 4) {
        setSelectionNudge(null);
        return;
      }

      const rect = sel.getRangeAt(0).getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        setSelectionNudge(null);
        return;
      }

      const margin = 16;
      const x = Math.min(Math.max(rect.left + rect.width / 2, margin), window.innerWidth - margin);
      const placeAbove = rect.top > 88;
      const y = placeAbove ? rect.top - 10 : rect.bottom + 10;
      setSelectionNudge({ text, x, y, placeAbove });
    };

    const hideNudge = () => setSelectionNudge(null);
    const scheduleNudge = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(updateSelectionNudge);
      });
    };
    const onMouseUp = () => scheduleNudge();
    const onKeyUp = () => scheduleNudge();

    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("keyup", onKeyUp);
    document.addEventListener("scroll", hideNudge, true);
    window.addEventListener("resize", hideNudge);

    return () => {
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("scroll", hideNudge, true);
      window.removeEventListener("resize", hideNudge);
    };
  }, [askTrackingReady]);

  const handleAskFromSelection = useCallback(() => {
    if (!selectionNudge) return;
    const selectedText = selectionNudge.text;
    const selectedTextPreview =
      selectedText.length > 220 ? `${selectedText.slice(0, 220)}...` : selectedText;
    setDraftToAsk({
      id: crypto.randomUUID(),
      displayQuery: `이 부분을 조금 더 자세히 설명해 주세요: "${selectedTextPreview}"`,
      selectedText,
    });
    setChatOpenSignal((prev) => prev + 1);
    setSelectionNudge(null);
    window.getSelection()?.removeAllRanges();
  }, [selectionNudge]);

  let body;
  if (persona === "hire") body = <HireView onBack={back} />;
  else if (persona === "collab") body = <CollabView onBack={back} />;
  else if (persona === "builder") body = <BuilderView onBack={back} />;
  else if (persona === "curious")
    body = <CuriousView onBack={back} accent={DEFAULT_ACCENT} />;
  else body = <HomeView onPick={pick} />;

  return (
    <div className={"app-layout" + (persona !== null ? " has-dock" : "")}>
      <div className="shell" ref={shellRef}>
        {/* 사이트 신원 바를 <main> 밖에 두어 banner 랜드마크로 인식되게 한다(홈에서만 노출). */}
        {persona === null && <Plate />}
        <main id="main-content">{body}</main>
        <Foot />
      </div>
      {selectionNudge && (
        <div
          className={"selection-ask-nudge" + (selectionNudge.placeAbove ? " is-above" : " is-below")}
          style={{ left: selectionNudge.x, top: selectionNudge.y }}
          role="dialog"
          aria-label="Ask Hansol nudging"
        >
          <div className="selection-ask-nudge-text">이 부분이 궁금하신가요?</div>
          <button type="button" className="selection-ask-nudge-btn" onClick={handleAskFromSelection}>
            질문하기
          </button>
        </div>
      )}
      <DeferredChatDock
        defaultOpen={persona !== null && !isMobileViewport}
        inline={persona !== null}
        pageContext={pageContext}
        openSignal={chatOpenSignal}
        draftToAsk={draftToAsk}
      />
    </div>
  );
}

export default function PortfolioApp({ siteData }: { siteData: SiteData }) {
  return (
    <SiteDataProvider data={siteData}>
      <PortfolioAppBody />
    </SiteDataProvider>
  );
}
