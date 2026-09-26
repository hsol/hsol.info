import { readFile } from "node:fs/promises";
import path from "node:path";
import { HSOL_DATA } from "@/data/site";
import { siteDataSchema, type SiteData } from "@/content/schema";
import { readOneDriveText } from "@/lib/content/onedrive-text";

const SITE_DATA_PATH = "vault/object-views/site-data.json";
const CACHE_TTL_MS = Number(process.env.SITE_DATA_CACHE_TTL_MS ?? 5 * 60 * 1000);

let cached: { data: SiteData; expiresAt: number } | null = null;
let inflight: Promise<SiteData> | null = null;

/** 정본: 개인 OneDrive `hsol-info-blob/vault/object-views/site-data.json` (CI 가 생성해 올린다). */
async function fetchSiteDataFromOneDrive(): Promise<SiteData> {
  const text = await readOneDriveText(SITE_DATA_PATH);
  if (!text) throw new Error(`OneDrive file not found: ${SITE_DATA_PATH}`);
  return siteDataSchema.parse(JSON.parse(text));
}

async function fetchSiteDataFromLocalVault(): Promise<SiteData> {
  const localPath = path.join(process.cwd(), "hsol-info-blob/vault/object-views/site-data.json");
  const raw = await readFile(localPath, "utf8");
  return siteDataSchema.parse(JSON.parse(raw));
}

/** Committed baseline (`src/data/site.ts`) - OneDrive 와 로컬 vault 를 모두 못 읽을 때. */
function fetchSiteDataFromBundled(): SiteData {
  return HSOL_DATA;
}

export async function getSiteData(): Promise<SiteData> {
  const now = Date.now();
  if (cached && now < cached.expiresAt) return cached.data;

  if (inflight) return inflight;

  inflight = fetchSiteDataFromOneDrive()
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
