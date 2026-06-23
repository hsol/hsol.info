import { NextResponse } from "next/server";
import { getBlobPrefix, getBlobToken, resolveBlobUrl } from "@/lib/content/blob";

/**
 * /resume/pdf — CI 에서 사전 생성해 Blob 에 올린 원페이저 PDF 로 302 리다이렉트.
 * site-data 와 같은 Blob store 에서 해석한다(resolveBlobUrl 재사용).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ONEPAGER_PDF_PATH = "resume/onepager-ko.pdf";

export async function GET() {
  const token = getBlobToken();
  if (token) {
    const url = await resolveBlobUrl(token, getBlobPrefix(), ONEPAGER_PDF_PATH);
    if (url) return NextResponse.redirect(url, 302);
  }
  return new NextResponse(
    "원페이저 PDF가 아직 생성되지 않았습니다. /resume 에서 인쇄 기능으로 PDF를 저장할 수 있습니다.",
    { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } },
  );
}
