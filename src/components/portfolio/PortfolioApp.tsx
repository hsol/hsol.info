"use client";

import { usePathname, useRouter } from "next/navigation";
import { lazy } from "@/lib/lazy-dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Foot, Plate, SiteDataProvider } from "@/components/portfolio/Atoms";
import { DeferredChatDock } from "@/components/DeferredChatDock";
import type { SiteData } from "@/content/schema";
import type { AskHansolPageContext } from "@/lib/ask-hansol/client";
import { AskFeatureDialog } from "@/components/portfolio/ask/AskFeatureDialog";
import {
  AskFeatureProvider,
  useAskFeatureController,
} from "@/components/portfolio/ask/ask-feature-context";
import { personaFromPathname, type PersonaKey } from "@/components/portfolio/portfolio-types";
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
const AboutView = lazy(() =>
  import("@/components/portfolio/views/AboutView").then((m) => ({ default: m.AboutView })),
);

const DEFAULT_ACCENT = "#287099";

function PortfolioAppBody() {
  const pathname = usePathname();
  const router = useRouter();
  const persona = useMemo(() => personaFromPathname(pathname), [pathname]);
  // /about 도 같은 app 셸 안에서 렌더한다(standalone 셸 중복 제거). persona 가 아니므로 별도 판별.
  const isAbout = pathname === "/about";
  const isHome = persona === null && !isAbout;

  const [isMobileViewport, setIsMobileViewport] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches,
  );
  const [askVisibleSection, setAskVisibleSection] = useState<string | undefined>();
  // 본문 상세 CTA(자문/JD)는 화면 중앙 모달 + 우측 도크 패널을 함께 연다(입력·제출 싱크).
  const askFeature = useAskFeatureController();
  const [askTrackingReady, setAskTrackingReady] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);

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
  const { openDialog } = askFeature;
  const triggerJdAnalysis = useCallback(() => openDialog("jd"), [openDialog]);
  const triggerAdvice = useCallback(() => openDialog("advice"), [openDialog]);

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
    () =>
      isAbout
        ? { view: "home", section: "about", hash: "/about", detail: "about/profile" }
        : {
            view: persona ?? "home",
            section: persona === null ? "home" : "detail",
            hash: pathname || "/",
            detail: askVisibleSection,
          },
    [isAbout, persona, askVisibleSection, pathname],
  );

  let body;
  if (persona === "hire") body = <HireView onBack={back} onAnalyzeJd={triggerJdAnalysis} />;
  else if (persona === "collab") body = <CollabView onBack={back} onAskAdvice={triggerAdvice} />;
  else if (persona === "builder") body = <BuilderView onBack={back} />;
  else if (persona === "curious")
    body = <CuriousView onBack={back} accent={DEFAULT_ACCENT} />;
  else if (isAbout) body = <AboutView onBack={back} />;
  else body = <HomeView onPick={pick} />;

  return (
    <AskFeatureProvider value={askFeature}>
      <div className={"app-layout" + (persona !== null ? " has-dock" : "")}>
        <div className="shell" ref={shellRef}>
          {/* 사이트 신원 바를 <main> 밖에 두어 banner 랜드마크로 인식되게 한다(홈에서만 노출). */}
          {isHome && <Plate />}
          <main id="main-content">{body}</main>
          <Foot />
        </div>
        <DeferredChatDock
          defaultOpen={persona !== null && !isMobileViewport}
          inline={persona !== null}
          pageContext={pageContext}
          openSignal={askFeature.dockOpenSignal}
        />
        <AskFeatureDialog />
      </div>
    </AskFeatureProvider>
  );
}

export default function PortfolioApp({ siteData }: { siteData: SiteData }) {
  return (
    <SiteDataProvider data={siteData}>
      <PortfolioAppBody />
    </SiteDataProvider>
  );
}
