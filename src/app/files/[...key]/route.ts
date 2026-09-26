import type { NextRequest } from "next/server";

import { getItem, isOneDriveConfigured } from "@/lib/onedrive/graph";
import { MANAGE_COOKIE, verifySession } from "@/lib/manage-auth";

/**
 * 바이너리 에셋 서빙: /files/<visibility>/<경로>
 *
 * 원본은 개인 OneDrive `hsol-info-blob/assets/<키>` 다. OneDrive 는 비공개라 서버가 Graph 로
 * 파일의 단기 다운로드 URL 을 얻어 대신 받아 흘려보낸다(Range 그대로 전달).
 *
 *  - public/...  : 누구나. CDN 캐시 허용
 *  - private/... : /manage 세션(Sign in with Vercel)이 있을 때만. 없으면 존재 여부도 숨기려고 404
 *
 * 규약 정본: OneDrive hsol-info-blob/vault/README.md "바이너리"
 */

export const runtime = "nodejs";

const VISIBILITIES = new Set(["public", "private"]);

function notFound(): Response {
  return new Response("Not Found", {
    status: 404,
    headers: { "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "no-store" },
  });
}

/** 경로 조각을 디코딩하고 NFC 로 맞춘다. 상위 이동, 빈 조각, 숨김 파일은 거부. */
function normalizeKey(parts: string[]): string | null {
  const decoded: string[] = [];
  for (const raw of parts) {
    let p: string;
    try {
      p = decodeURIComponent(raw);
    } catch {
      return null;
    }
    p = p.normalize("NFC");
    if (!p || p.startsWith(".") || p.includes("/") || p.includes("\\")) return null;
    decoded.push(p);
  }
  if (decoded.length < 2 || !VISIBILITIES.has(decoded[0])) return null;
  return decoded.join("/");
}

async function hasManageSession(req: NextRequest): Promise<boolean> {
  const secret = process.env.MANAGE_SESSION_SECRET;
  const token = req.cookies.get(MANAGE_COOKIE)?.value;
  return Boolean(secret && token && (await verifySession(token, secret)));
}

function contentDisposition(key: string, download: boolean): string {
  const filename = key.split("/").pop() ?? "file";
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const kind = download ? "attachment" : "inline";
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

async function serve(req: NextRequest, params: Promise<{ key: string[] }>, headOnly: boolean) {
  const key = normalizeKey((await params).key ?? []);
  if (!key) return notFound();

  const isPrivate = key.startsWith("private/");
  if (isPrivate && !(await hasManageSession(req))) return notFound();

  if (!isOneDriveConfigured()) return notFound();
  const item = await getItem(`assets/${key}`).catch(() => null);
  const downloadUrl = item?.["@microsoft.graph.downloadUrl"];
  if (!item || !downloadUrl) return notFound();

  const upstreamHeaders: Record<string, string> = {};
  const range = req.headers.get("range");
  if (range) upstreamHeaders.Range = range;

  const upstream = headOnly
    ? null
    : await fetch(downloadUrl, { headers: upstreamHeaders, cache: "no-store" }).catch(() => null);
  if (!headOnly && (!upstream || (!upstream.ok && upstream.status !== 206))) return notFound();

  const headers = new Headers();
  if (upstream) {
    for (const h of ["content-length", "content-range", "accept-ranges"]) {
      const v = upstream.headers.get(h);
      if (v) headers.set(h, v);
    }
  } else {
    headers.set("content-length", String(item.size));
    headers.set("accept-ranges", "bytes");
  }
  headers.set("content-type", item.file?.mimeType || upstream?.headers.get("content-type") || "application/octet-stream");
  if (item.eTag) headers.set("etag", item.eTag);
  if (item.lastModifiedDateTime) headers.set("last-modified", new Date(item.lastModifiedDateTime).toUTCString());
  headers.set("Content-Disposition", contentDisposition(key, req.nextUrl.searchParams.has("download")));
  if (isPrivate) {
    headers.set("Cache-Control", "private, no-store");
    headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  } else {
    // 같은 키로 파일을 교체하면 늦어도 1시간 안에 반영된다.
    headers.set("Cache-Control", "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400");
  }

  return new Response(upstream ? upstream.body : null, { status: upstream?.status ?? 200, headers });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  return serve(req, params, false);
}

export async function HEAD(req: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  return serve(req, params, true);
}
