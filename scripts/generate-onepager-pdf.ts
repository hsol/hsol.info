import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { put } from "@vercel/blob";
import { wrapOnePagerHtml } from "../src/lib/content/onepager-html";

/**
 * 원페이저 HTML(onepager-ko.html) -> A4 PDF 변환 후 Vercel Blob 업로드.
 * refresh(html 생성) 다음 CI 스텝에서 실행. Playwright 인쇄 엔진이라 텍스트 선택 가능·벡터 출력.
 * BLOB 토큰이 없으면 로컬 파일만 남기고 업로드는 건너뛴다(빌드 실패시키지 않음).
 */
const HTML_PATH =
  process.env.VAULT_ONEPAGER_HTML_PATH ?? "hsol-info-blob/vault/object-views/onepager-ko.html";
const BLOB_PREFIX = (process.env.BLOB_PREFIX || "info").replace(/^\/+|\/+$/g, "");
const BLOB_PDF_PATH = `${BLOB_PREFIX}/resume/onepager-ko.pdf`;
// HTML 도 Blob 에 올려 런타임(getOnePagerHtml)이 submodule 없이도 읽게 한다.
const BLOB_HTML_PATH = `${BLOB_PREFIX}/vault/object-views/onepager-ko.html`;
const LOCAL_PDF_PATH = process.env.ONEPAGER_PDF_OUT ?? "generated/onepager-ko.pdf";

async function main() {
  const fragment = await readFile(HTML_PATH, "utf8").catch(() => "");
  if (!fragment.trim()) {
    console.log(`[onepager-pdf] No HTML at ${HTML_PATH}; skip.`);
    return;
  }

  const html = wrapOnePagerHtml(fragment);
  console.log("[onepager-pdf] Rendering A4 PDF with Playwright...");
  const browser = await chromium.launch();
  let pdf: Buffer;
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
  } finally {
    await browser.close();
  }

  await mkdir(path.dirname(LOCAL_PDF_PATH), { recursive: true });
  await writeFile(LOCAL_PDF_PATH, pdf);
  console.log(`[onepager-pdf] Wrote local PDF: ${LOCAL_PDF_PATH} (${pdf.length} bytes).`);

  const token = process.env.BLOB_READ_WRITE_TOKEN ?? process.env.ASK_HANSOL_BLOB_TOKEN;
  if (!token) {
    console.log("[onepager-pdf] No BLOB_READ_WRITE_TOKEN; skipped Blob upload (local only).");
    return;
  }
  const pdfResult = await put(BLOB_PDF_PATH, pdf, {
    access: "public",
    token,
    allowOverwrite: true,
    addRandomSuffix: false,
    contentType: "application/pdf",
  });
  console.log(`[onepager-pdf] Uploaded PDF to Blob: ${pdfResult.url}`);

  const htmlResult = await put(BLOB_HTML_PATH, fragment, {
    access: "public",
    token,
    allowOverwrite: true,
    addRandomSuffix: false,
    contentType: "text/html; charset=utf-8",
  });
  console.log(`[onepager-pdf] Uploaded HTML to Blob: ${htmlResult.url}`);
}

main().catch((error) => {
  console.error("Failed to generate one-pager PDF.");
  console.error(error);
  process.exit(1);
});
