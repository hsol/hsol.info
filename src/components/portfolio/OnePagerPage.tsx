"use client";

import { useRouter } from "next/navigation";
import { Foot } from "@/components/portfolio/Atoms";

/**
 * /resume — vault 온톨로지로 생성된 이력서/포트폴리오 원페이저(자기완결형 HTML 조각)를 렌더.
 * 화면에서는 A4 비율 시트로 보여주고, "PDF 다운로드"(CI 사전 생성본)와 "인쇄"(window.print)를 제공.
 * 인쇄 시 블루프린트 배경·툴바·푸터를 숨겨 흰 종이 한 장만 출력한다.
 */
const STYLE = `
.onepager-screen { padding: 24px 0 48px; }
.onepager-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; margin: 0 auto 20px; max-width: 210mm; flex-wrap: wrap;
}
.onepager-toolbar .op-back { color: var(--ink-2); font-size: 0.95rem; }
.onepager-toolbar .op-back:hover { color: var(--ink); }
.onepager-actions { display: flex; gap: 10px; }
.op-btn {
  border: 1px solid var(--bp-line-2); color: var(--ink);
  background: rgba(20, 56, 79, 0.35);
  padding: 8px 14px; border-radius: 6px; font-size: 0.9rem;
  text-decoration: none; transition: background 160ms ease, border-color 160ms ease;
}
.op-btn:hover { background: rgba(40, 112, 153, 0.4); border-color: var(--bp-glow); }
.op-btn.primary { border-color: var(--accent); color: var(--accent); }
.op-btn.primary:hover { background: rgba(244, 201, 119, 0.14); }
.onepager-sheet {
  background: #ffffff; color: #16242c;
  max-width: 210mm; margin: 0 auto;
  box-shadow: 0 6px 32px rgba(0, 0, 0, 0.35);
  border-radius: 4px; overflow: hidden;
}
.onepager-empty {
  max-width: 210mm; margin: 0 auto; padding: 48px 24px;
  text-align: center; color: var(--ink-mute);
}
@media print {
  html, body { background: #ffffff !important; }
  body::before, body::after { display: none !important; }
  .onepager-toolbar, .foot, footer.foot { display: none !important; }
  .onepager-screen { padding: 0; }
  .onepager-sheet { box-shadow: none; max-width: none; margin: 0; border-radius: 0; }
}
`;

export function OnePagerPage({ html }: { html: string | null }) {
  const router = useRouter();
  return (
    <div className="app-layout">
      <style>{STYLE}</style>
      <div className="shell">
        <main id="main-content">
          <div className="view onepager-screen">
            <div className="onepager-toolbar">
              <button type="button" className="op-back" onClick={() => router.push("/")}>
                ← 홈으로
              </button>
              <div className="onepager-actions">
                <a className="op-btn primary" href="/resume/pdf" download>
                  PDF 다운로드
                </a>
                <button type="button" className="op-btn" onClick={() => window.print()}>
                  인쇄
                </button>
              </div>
            </div>
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
    </div>
  );
}
