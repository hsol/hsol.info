import { readFile } from "node:fs/promises";
import path from "node:path";
import { getBlobPrefix, getBlobToken, resolveBlobUrl } from "@/lib/content/blob";

export { wrapOnePagerHtml } from "@/lib/content/onepager-html";

/**
 * 원페이저 HTML 조각 로더. getSiteData 와 같은 폴백 체인: Blob -> 로컬 vault -> null.
 * site-data 와 분리된 별도 아티팩트(vault/object-views/onepager-ko.html).
 */
const ONEPAGER_BLOB_PATH = "vault/object-views/onepager-ko.html";
const ONEPAGER_LOCAL_PATH = "hsol-info-blob/vault/object-views/onepager-ko.html";
const CACHE_TTL_MS = Number(process.env.ONEPAGER_CACHE_TTL_MS ?? 5 * 60 * 1000);

let cached: { html: string | null; expiresAt: number } | null = null;
let inflight: Promise<string | null> | null = null;

async function fetchFromBlob(): Promise<string | null> {
  const token = getBlobToken();
  if (!token) return null;
  const url = await resolveBlobUrl(token, getBlobPrefix(), ONEPAGER_BLOB_PATH);
  if (!url) return null;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "force-cache",
  }).catch(() => null);
  if (!response || !response.ok) return null;
  const text = await response.text();
  return text.trim() ? text : null;
}

async function fetchFromLocalVault(): Promise<string | null> {
  try {
    const localPath = path.join(process.cwd(), ONEPAGER_LOCAL_PATH);
    const text = await readFile(localPath, "utf8");
    return text.trim() ? text : null;
  } catch {
    return null;
  }
}

/** 원페이저 HTML 조각(없으면 null). 5분 캐시. */
export async function getOnePagerHtml(): Promise<string | null> {
  const now = Date.now();
  if (cached && now < cached.expiresAt) return cached.html;
  if (inflight) return inflight;

  inflight = (async () => (await fetchFromBlob()) ?? (await fetchFromLocalVault()))()
    .then((html) => {
      cached = { html, expiresAt: Date.now() + CACHE_TTL_MS };
      return html;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}
