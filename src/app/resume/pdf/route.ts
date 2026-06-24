import { NextResponse } from "next/server";
import { getBlobPrefix, getBlobToken, resolveBlobUrl } from "@/lib/content/blob";

/**
 * /resume/pdf — CI 에서 사전 생성해 Blob 에 올린 원페이저 PDF 를 내려준다.
 * Blob store 가 private 라 브라우저 직접 접근이 안 되므로, 서버가 토큰으로 가져와 스트리밍한다
 * (site-data 읽기와 동일한 private read 패턴).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ONEPAGER_PDF_PATH = "resume/onepager-ko.pdf";
const DOWNLOAD_FILENAME = "hansol-lim-onepager.pdf";

export async function GET() {
  const token = getBlobToken();
  if (token) {
    const url = await resolveBlobUrl(token, getBlobPrefix(), ONEPAGER_PDF_PATH);
    if (url) {
      const upstream = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }).catch(() => null);
      if (upstream && upstream.ok) {
        const body = await upstream.arrayBuffer();
        return new NextResponse(body, {
          status: 200,
          headers: {
            "content-type": "application/pdf",
            "content-disposition": `attachment; filename="${DOWNLOAD_FILENAME}"`,
            "cache-control": "public, max-age=300",
          },
        });
      }
    }
  }
  return new NextResponse(
    "원페이저 PDF가 아직 생성되지 않았습니다. /resume 에서 인쇄 기능으로 PDF를 저장할 수 있습니다.",
    { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } },
  );
}
