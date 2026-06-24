"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { animate, stagger, useReducedMotion } from "framer-motion";
import { Foot } from "@/components/portfolio/Atoms";
import { DeferredChatDock } from "@/components/DeferredChatDock";
import type { AskHansolPageContext } from "@/lib/ask-hansol/client";

// 이력서 독자는 채용·협업 평가 맥락이라 Ask Hansol 을 hire 관점으로 띄운다.
const ASK_CONTEXT: AskHansolPageContext = {
  view: "hire",
  section: "resume",
  hash: "/resume",
  detail: "onepager",
};

/**
 * /resume — vault 온톨로지로 생성된 이력서/포트폴리오 원페이저(자기완결형 HTML 조각)를 렌더.
 * 진입 시 원페이저의 각 블록이 차분히 떠오르며(fade + 미세 상승 + blur→선명) 스태거로 드러나는
 * 절제된 entrance(framer-motion). 좌측 홈·PDF 플로팅. 인쇄 시 크롬·애니메이션 제외.
 */
const STYLE = `
.onepager-screen { padding: 40px 0 64px; }

/* 좌측 플로팅 내비 */
.onepager-floatnav {
  position: fixed; left: 18px; top: 50%; transform: translateY(-50%);
  display: flex; flex-direction: column; gap: 10px; z-index: 60;
}
.op-fab {
  display: inline-flex; align-items: center; gap: 7px;
  border: 1px solid var(--bp-line-2); color: var(--ink);
  background: rgba(14, 42, 61, 0.72); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
  padding: 10px 15px; border-radius: 999px; font-size: 0.86rem; font-family: var(--mono);
  text-decoration: none; white-space: nowrap; cursor: pointer;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.28);
  transition: background 160ms ease, border-color 160ms ease, transform 160ms ease;
}
.op-fab:hover { background: rgba(40, 112, 153, 0.55); border-color: var(--bp-glow); transform: translateX(3px); }
.op-fab.primary { border-color: var(--accent); color: var(--accent); }
.op-fab.primary:hover { background: rgba(244, 201, 119, 0.16); }

.onepager-sheet {
  background: #ffffff; color: #16242c;
  max-width: 210mm; margin: 0 auto;
  box-shadow: 0 6px 40px rgba(0, 0, 0, 0.4);
  border-radius: 4px; overflow: hidden;
}

.onepager-empty {
  max-width: 210mm; margin: 0 auto; padding: 48px 24px;
  text-align: center; color: var(--ink-mute);
}

@media (max-width: 920px) {
  /* 좁은 화면에선 시트와 겹치므로 하단 가로 배치로 */
  .onepager-floatnav { top: auto; bottom: 18px; left: 18px; transform: none; flex-direction: row; }
}
@media print {
  html, body { background: #ffffff !important; }
  body::before, body::after { display: none !important; }
  .onepager-floatnav, .foot, footer.foot, .resume-ask { display: none !important; }
  .onepager-screen { padding: 0; }
  .onepager-sheet { box-shadow: none; max-width: none; margin: 0; border-radius: 0; }
}
`;

export function OnePagerPage({ html }: { html: string | null }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduceMotion || !html) return;
    const root = sheetRef.current?.querySelector(".onepager");
    if (!root) return;
    // 원페이저 최상위 블록(헤더·섹션 등)만 대상. inline <style> 는 제외.
    const blocks = (Array.from(root.children) as HTMLElement[]).filter(
      (el) => el.tagName !== "STYLE",
    );
    if (blocks.length === 0) return;

    // 깜빡임 방지를 위해 시작 상태를 먼저 적용한 뒤 스태거로 차오르게 한다.
    for (const el of blocks) {
      el.style.opacity = "0";
      el.style.transform = "translateY(18px)";
      el.style.filter = "blur(5px)";
    }
    const controls = animate(
      blocks,
      { opacity: [0, 1], transform: ["translateY(18px)", "translateY(0px)"], filter: ["blur(5px)", "blur(0px)"] },
      { delay: stagger(0.07, { startDelay: 0.1 }), duration: 0.6, ease: [0.16, 1, 0.3, 1] },
    );
    return () => {
      controls.stop();
      // 정리: 애니메이션 잔여 인라인 스타일 제거(인쇄·재실행 안전)
      for (const el of blocks) {
        el.style.opacity = "";
        el.style.transform = "";
        el.style.filter = "";
      }
    };
  }, [html, reduceMotion]);

  return (
    <div className="app-layout">
      <style>{STYLE}</style>

      <div className="shell">
        <main id="main-content">
          <div className="view onepager-screen">
            {html ? (
              <div
                ref={sheetRef}
                className="onepager-sheet"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            ) : (
              <div className="onepager-empty">
                원페이저가 아직 준비되지 않았습니다. 다음 갱신에서 생성됩니다.
              </div>
            )}
          </div>
        </main>
        <Foot />
      </div>

      <nav className="onepager-floatnav" aria-label="원페이저 작업">
        <button type="button" className="op-fab" onClick={() => router.push("/")}>
          ← 홈
        </button>
        <a className="op-fab primary" href="/resume/pdf" download>
          ↓ PDF 다운로드
        </a>
      </nav>

      <div className="resume-ask">
        <DeferredChatDock pageContext={ASK_CONTEXT} />
      </div>
    </div>
  );
}
