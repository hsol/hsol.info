import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pdfPageCount, renderOnePagerPdf } from "./lib/onepager-pdf";

/**
 * 원페이저 HTML(onepager-<lang>.html) -> A4 PDF 변환. 결과는 generated/onepager-<lang>.pdf 에 남기고,
 * OneDrive 업로드는 다음 CI 스텝(ops/scripts/publish-generated.mjs)이 한다.
 * refresh(ko html 생성) → translate(en html 생성) 다음 CI 스텝에서 실행.
 * Playwright 인쇄 엔진이라 텍스트 선택 가능·벡터 출력.
 * EN HTML 이 아직 없으면 EN 만 건너뛴다 — KO 는 그대로 나간다.
 */

type Target = { lang: "ko" | "en"; htmlPath: string; localPdfPath: string };

const TARGETS: Target[] = [
  {
    lang: "ko",
    htmlPath:
      process.env.VAULT_ONEPAGER_HTML_PATH ?? "hsol-info-blob/vault/object-views/onepager-ko.html",
    localPdfPath: process.env.ONEPAGER_PDF_OUT ?? "generated/onepager-ko.pdf",
  },
  {
    lang: "en",
    htmlPath:
      process.env.VAULT_ONEPAGER_EN_HTML_PATH ??
      "hsol-info-blob/vault/object-views/onepager-en.html",
    localPdfPath: process.env.ONEPAGER_EN_PDF_OUT ?? "generated/onepager-en.pdf",
  },
];

async function main() {
  let rendered = 0;

  for (const target of TARGETS) {
    const fragment = await readFile(target.htmlPath, "utf8").catch(() => "");
    if (!fragment.trim()) {
      console.log(`[onepager-pdf] No HTML at ${target.htmlPath}; skip ${target.lang}.`);
      continue;
    }

    console.log(`[onepager-pdf] Rendering A4 PDF (${target.lang}) with Playwright...`);
    const pdf = await renderOnePagerPdf(fragment, target.lang);
    rendered += 1;

    await mkdir(path.dirname(target.localPdfPath), { recursive: true });
    await writeFile(target.localPdfPath, pdf);
    console.log(
      `[onepager-pdf] Wrote local PDF: ${target.localPdfPath} (${pdf.length} bytes, ${pdfPageCount(pdf)} pages).`,
    );
  }

  if (rendered === 0) console.log("[onepager-pdf] Nothing to render.");
}

main().catch((error) => {
  console.error("Failed to generate one-pager PDF.");
  console.error(error);
  process.exit(1);
});
