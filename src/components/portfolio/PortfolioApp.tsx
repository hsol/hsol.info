"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Foot, SiteDataProvider } from "@/components/portfolio/Atoms";
import { ChatDock } from "@/components/portfolio/ask/ChatDock";
import type { SiteData } from "@/content/schema";
import type { AskHansolPageContext } from "@/lib/ask-hansol/client";
import { personaFromPathname, type AskDraft, type PersonaKey } from "@/components/portfolio/portfolio-types";
import { useReportAskVisibleSection } from "@/components/portfolio/use-report-ask-visible-section";
import { BuilderView } from "@/components/portfolio/views/BuilderView";
import { CollabView } from "@/components/portfolio/views/CollabView";
import { CuriousView } from "@/components/portfolio/views/CuriousView";
import { HireView } from "@/components/portfolio/views/HireView";
import { HomeView } from "@/components/portfolio/views/HomeView";

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
  useReportAskVisibleSection(shellRef, viewKey, setAskVisibleSection);

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
    const onMouseUp = () => window.setTimeout(updateSelectionNudge, 0);
    const onKeyUp = () => window.setTimeout(updateSelectionNudge, 0);

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
  }, []);

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
        {body}
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
      <ChatDock
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
