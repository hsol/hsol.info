import { list } from "@vercel/blob";
import type { NextRequest } from "next/server";

import { getBlobPrefix, getBlobToken } from "@/lib/content/blob";
import { MANAGE_COOKIE, verifySession } from "@/lib/manage-auth";

/**
 * 바이너리 에셋 서빙: /files/<visibility>/<경로>
 *
 * 원본은 개인 OneDrive `hsol.info-assets/` 이고, hsol-info-blob 저장소의
 * sync-onedrive-to-blob 워크플로가 Blob `info/assets/<키>` 로 올린다. store 가 private 이라
 * 브라우저가 Blob URL 을 직접 못 열기 때문에 여기서 토큰을 붙여 대신 받아 흘려보낸다.
 *
 *  - public/...  : 누구나. CDN 캐시 허용
 *  - private/... : /manage 세션(Sign in with Vercel)이 있을 때만. 없으면 존재 여부도 숨기려고 404
 *
 * 규약 정본: hsol-info-blob vault/README.md "바이너리 에셋은 OneDrive 에 둔다"
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

async function resolveAsset(token: string, pathname: string) {
  const page = await list({ prefix: pathname, token, limit: 5 }).catch(() => null);
  return page?.blobs.find((b) => b.pathname === pathname) ?? null;
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

  const token = getBlobToken();
  if (!token) return notFound();

  const blob = await resolveAsset(token, `${getBlobPrefix()}/assets/${key}`);
  if (!blob) return notFound();

  const upstreamHeaders: Record<string, string> = { Authorization: `Bearer ${token}` };
  const range = req.headers.get("range");
  if (range) upstreamHeaders.Range = range;

  const upstream = await fetch(blob.url, {
    method: headOnly ? "HEAD" : "GET",
    headers: upstreamHeaders,
    cache: "no-store",
  }).catch(() => null);
  if (!upstream || (!upstream.ok && upstream.status !== 206)) return notFound();

  const headers = new Headers();
  for (const h of ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified"]) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  headers.set("Content-Disposition", contentDisposition(key, req.nextUrl.searchParams.has("download")));
  if (isPrivate) {
    headers.set("Cache-Control", "private, no-store");
    headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  } else {
    // 같은 키로 파일을 교체하면 늦어도 1시간 안에 반영된다.
    headers.set("Cache-Control", "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400");
  }

  return new Response(headOnly ? null : upstream.body, { status: upstream.status, headers });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  return serve(req, params, false);
}

export async function HEAD(req: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  return serve(req, params, true);
}
