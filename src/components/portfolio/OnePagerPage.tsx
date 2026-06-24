"use client";

import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
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
 * 좌측에 홈·PDF 플로팅 버튼, 진입 시 흰 시트가 가운데서 쫙 퍼지며 열리는 reveal 애니메이션.
 * 인쇄 시 블루프린트 배경·플로팅 UI·푸터를 숨겨 흰 종이만 출력한다.
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
/* 흰 패널 하나가 화면 전체를 덮은 채 좌→우로 훑고 지나가며 원페이저를 드러냄.
   모션은 framer-motion 이 구동(아래 motion.div). 여기선 정적 스타일만. */
.onepager-reveal {
  position: fixed; inset: 0; background: #ffffff; z-index: 200; pointer-events: none;
  box-shadow: -24px 0 60px -10px rgba(0, 0, 0, 0.22);
}

.onepager-empty {
  max-width: 210mm; margin: 0 auto; padding: 48px 24px;
  text-align: center; color: var(--ink-mute);
}

@media (prefers-reduced-motion: reduce) {
  .onepager-sheet, .onepager-floatnav { animation: none; }
  .onepager-reveal { display: none; }
}
@media (max-width: 920px) {
  /* 좁은 화면에선 시트와 겹치므로 하단 가로 배치로 */
  .onepager-floatnav { top: auto; bottom: 18px; left: 18px; transform: none; flex-direction: row; animation: none; }
}
@media print {
  html, body { background: #ffffff !important; }
  body::before, body::after { display: none !important; }
  .onepager-floatnav, .foot, footer.foot, .resume-ask, .onepager-reveal { display: none !important; }
  .onepager-screen { padding: 0; }
  .onepager-sheet { box-shadow: none; max-width: none; margin: 0; border-radius: 0; animation: none; }
}
`;

export function OnePagerPage({ html }: { html: string | null }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  return (
    <div className="app-layout">
      <style>{STYLE}</style>
      {!reduceMotion && html ? (
        <motion.div
          className="onepager-reveal"
          aria-hidden="true"
          initial={{ x: 0 }}
          animate={{ x: "102%" }}
          transition={{ duration: 0.9, ease: [0.76, 0, 0.24, 1] }}
        />
      ) : null}

      <div className="shell">
        <main id="main-content">
          <div className="view onepager-screen">
            {html ? (
              <div className="onepager-sheet" dangerouslySetInnerHTML={{ __html: html }} />
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
