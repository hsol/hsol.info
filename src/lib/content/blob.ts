import { list } from "@vercel/blob";

/**
 * Vercel Blob 공통 헬퍼. site-data·원페이저 등 vault 산출물을 같은 store 에서 읽는다.
 */

export function getBlobToken(): string | null {
  return (
    process.env.ASK_HANSOL_BLOB_TOKEN ??
    process.env.BLOB_READ_WRITE_TOKEN ??
    process.env.BLOB_READ_TOKEN ??
    null
  );
}

/** Blob 경로 접두사(기본 "info"). 앞뒤 슬래시 제거. */
export function getBlobPrefix(): string {
  return (process.env.BLOB_PREFIX || "info").replace(/^\/+|\/+$/g, "");
}

/**
 * `<basePrefix>/<relPath>` 와 `<relPath>` 후보로 Blob 에서 파일 URL 을 해석한다.
 * 정확히 일치하는 pathname 우선, 없으면 첫 결과. 못 찾으면 null.
 */
export async function resolveBlobUrl(
  token: string,
  basePrefix: string,
  relPath: string,
): Promise<string | null> {
  const pathCandidates = [`${basePrefix}/${relPath}`.replace(/\/+/g, "/"), relPath];

  for (const fullPath of pathCandidates) {
    const page = await list({ prefix: fullPath, token, limit: 20 }).catch(() => null);
    if (!page) continue;
    const exact = page.blobs.find((blob) => blob.pathname === fullPath);
    const picked = exact ?? page.blobs[0];
    if (picked) return picked.url;
  }

  return null;
}
