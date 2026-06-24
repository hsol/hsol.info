import { readFile } from "node:fs/promises";
import path from "node:path";
import { HSOL_DATA } from "@/data/site";
import { siteDataSchema, type SiteData } from "@/content/schema";
import { getBlobPrefix, getBlobToken, resolveBlobUrl } from "@/lib/content/blob";

const SITE_DATA_PATH = "vault/object-views/site-data.json";
const CACHE_TTL_MS = Number(process.env.SITE_DATA_CACHE_TTL_MS ?? 5 * 60 * 1000);

let cached: { data: SiteData; expiresAt: number } | null = null;
let inflight: Promise<SiteData> | null = null;

async function fetchSiteDataFromBlob(): Promise<SiteData> {
  const token = getBlobToken();
  if (!token) {
    throw new Error("Blob token is missing. Set BLOB_READ_WRITE_TOKEN or BLOB_READ_TOKEN.");
  }

  const basePrefix = getBlobPrefix();
  const blobUrl = await resolveBlobUrl(token, basePrefix, SITE_DATA_PATH);
  if (!blobUrl) {
    throw new Error(`Blob file not found: ${SITE_DATA_PATH}`);
  }

  const response = await fetch(blobUrl, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "force-cache",
  }).catch(() => null);

  if (!response || !response.ok) {
    throw new Error(`Failed to fetch blob site data: ${blobUrl}`);
  }

  const json = await response.json();
  return siteDataSchema.parse(json);
}

async function fetchSiteDataFromLocalVault(): Promise<SiteData> {
  const localPath = path.join(process.cwd(), "hsol-info-blob/vault/object-views/site-data.json");
  const raw = await readFile(localPath, "utf8");
  return siteDataSchema.parse(JSON.parse(raw));
}

/** Committed baseline (`src/data/site.ts`) — used when Blob + local vault are unavailable (e.g. Vercel CI without submodule). */
function fetchSiteDataFromBundled(): SiteData {
  return HSOL_DATA;
}

export async function getSiteData(): Promise<SiteData> {
  const now = Date.now();
  if (cached && now < cached.expiresAt) return cached.data;

  if (inflight) return inflight;

  inflight = fetchSiteDataFromBlob()
    .catch(async () => fetchSiteDataFromLocalVault())
    .catch(async () => fetchSiteDataFromBundled())
    .then((data) => {
      cached = { data, expiresAt: Date.now() + CACHE_TTL_MS };
      return data;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}
