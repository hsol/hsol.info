import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { neon } from "@neondatabase/serverless";

/**
 * 개인 OneDrive(Microsoft Graph) 읽기 클라이언트. hsol.info 콘텐츠의 정본이자 유일한 저장소다.
 *
 * 경로는 OneDrive `hsol-info-blob/` 기준 상대경로("vault/object-views/site-data.json", "assets/public/..").
 * 토큰은 Neon `onedrive_token` 행(ops/scripts/lib/onedrive-token.mjs 와 같은 형식, AES-256-GCM)을
 * CI 와 같이 쓴다. 액세스 토큰이 만료되면 여기서 리프레시해 새 토큰을 되쓴다.
 *
 * 환경변수: DATABASE_URL, ONEDRIVE_TOKEN_KEY, ONEDRIVE_DRIVE_ID, ONEDRIVE_CLIENT_ID, ONEDRIVE_CLIENT_SECRET
 * (선택) ONEDRIVE_ROOT(기본 hsol-info-blob)
 */

const GRAPH = "https://graph.microsoft.com/v1.0";
const TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const TOKEN_ROW_ID = "personal";
const EARLY_REFRESH_MS = 3 * 60 * 1000;
const TEXT_CACHE_TTL_MS = Number(process.env.ONEDRIVE_TEXT_CACHE_TTL_MS ?? 5 * 60 * 1000);

type StoredToken = { access_token: string; token_type?: string; refresh_token: string; expiry: string };

export type DriveItem = {
  id: string;
  name: string;
  size: number;
  eTag?: string;
  lastModifiedDateTime?: string;
  file?: { mimeType?: string };
  folder?: unknown;
  "@microsoft.graph.downloadUrl"?: string;
};

let memToken: { accessToken: string; expiresAt: number } | null = null;
let inflightToken: Promise<string> | null = null;
const textCache = new Map<string, { text: string | null; expiresAt: number }>();

function env(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`${name} 미설정`);
  return v;
}

function databaseUrl(): string {
  return (process.env.DATABASE_URL || process.env.POSTGRES_URL || "").trim();
}

export function isOneDriveConfigured(): boolean {
  const names = ["ONEDRIVE_TOKEN_KEY", "ONEDRIVE_DRIVE_ID", "ONEDRIVE_CLIENT_ID", "ONEDRIVE_CLIENT_SECRET"];
  return names.every((n) => Boolean(process.env[n]?.trim())) && Boolean(databaseUrl());
}

function tokenKey(): Buffer {
  const key = Buffer.from(env("ONEDRIVE_TOKEN_KEY"), "base64");
  if (key.length !== 32) throw new Error("ONEDRIVE_TOKEN_KEY 는 32바이트 base64 여야 한다.");
  return key;
}

function sql() {
  const url = databaseUrl();
  if (!url) throw new Error("DATABASE_URL 미설정");
  return neon(url);
}

function encrypt(key: Buffer, plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
}

function decrypt(key: Buffer, payloadB64: string): string {
  const buf = Buffer.from(payloadB64, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
}

async function loadStoredToken(): Promise<StoredToken> {
  const rows = (await sql()`SELECT payload FROM onedrive_token WHERE id = ${TOKEN_ROW_ID}`) as {
    payload: string;
  }[];
  if (!rows[0]) throw new Error("Neon onedrive_token 에 토큰이 없다.");
  return JSON.parse(decrypt(tokenKey(), rows[0].payload)) as StoredToken;
}

async function saveStoredToken(token: StoredToken): Promise<void> {
  const payload = encrypt(tokenKey(), JSON.stringify(token));
  await sql()`INSERT INTO onedrive_token (id, payload, expires_at, updated_at)
    VALUES (${TOKEN_ROW_ID}, ${payload}, ${token.expiry}, now())
    ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, expires_at = EXCLUDED.expires_at, updated_at = now()`;
}

async function refreshToken(stored: StoredToken): Promise<StoredToken> {
  const body = new URLSearchParams({
    client_id: env("ONEDRIVE_CLIENT_ID"),
    client_secret: env("ONEDRIVE_CLIENT_SECRET"),
    grant_type: "refresh_token",
    refresh_token: stored.refresh_token,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
    error?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(`OneDrive 토큰 리프레시 실패: HTTP ${res.status} ${json.error ?? ""}`.trim());
  }
  const next: StoredToken = {
    access_token: json.access_token,
    token_type: json.token_type ?? "Bearer",
    refresh_token: json.refresh_token ?? stored.refresh_token,
    expiry: new Date(Date.now() + (json.expires_in ?? 3600) * 1000).toISOString(),
  };
  await saveStoredToken(next);
  return next;
}

async function getAccessToken(force = false): Promise<string> {
  const now = Date.now();
  if (!force && memToken && memToken.expiresAt - EARLY_REFRESH_MS > now) return memToken.accessToken;
  if (inflightToken) return inflightToken;

  inflightToken = (async () => {
    let stored = await loadStoredToken();
    const exp = Date.parse(stored.expiry);
    if (force || !Number.isFinite(exp) || exp - EARLY_REFRESH_MS <= Date.now()) {
      stored = await refreshToken(stored);
    }
    memToken = { accessToken: stored.access_token, expiresAt: Date.parse(stored.expiry) };
    return stored.access_token;
  })().finally(() => {
    inflightToken = null;
  });
  return inflightToken;
}

/** 정비용: 저장된 리프레시 토큰으로 즉시 갱신해 Neon 에 되쓴다. */
export async function refreshOneDriveToken(): Promise<void> {
  await getAccessToken(true);
}

function itemUrl(relPath: string): string {
  const root = (process.env.ONEDRIVE_ROOT || "hsol-info-blob").replace(/^\/+|\/+$/g, "");
  const full = [root, ...relPath.split("/")].filter(Boolean).map(encodeURIComponent).join("/");
  return `${GRAPH}/drives/${encodeURIComponent(env("ONEDRIVE_DRIVE_ID"))}/root:/${full}`;
}

/** Graph 호출. 401 이면 토큰을 한 번 강제 갱신해 다시 시도한다. */
async function graphFetch(url: string): Promise<Response> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await getAccessToken(attempt > 0);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (res.status !== 401) return res;
  }
  throw new Error("OneDrive 인증 실패(401)");
}

/** 한글 파일명은 올린 경로에 따라 NFC/NFD 가 섞여 있을 수 있어 둘 다 시도한다. */
function pathVariants(relPath: string): string[] {
  const nfc = relPath.normalize("NFC");
  const nfd = relPath.normalize("NFD");
  return nfc === nfd ? [nfc] : [nfc, nfd];
}

/** 파일 메타데이터(다운로드 URL 포함). 없거나 폴더면 null. */
export async function getItem(relPath: string): Promise<DriveItem | null> {
  for (const p of pathVariants(relPath)) {
    const res = await graphFetch(itemUrl(p));
    if (res.status === 404) continue;
    if (!res.ok) throw new Error(`OneDrive 조회 실패 ${relPath}: HTTP ${res.status}`);
    const item = (await res.json()) as DriveItem;
    return item.folder ? null : item;
  }
  return null;
}

/** 파일 내용을 바이트로. 없으면 null. */
export async function readBytes(relPath: string): Promise<ArrayBuffer | null> {
  const item = await getItem(relPath);
  const url = item?.["@microsoft.graph.downloadUrl"];
  if (!url) return null;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`OneDrive 다운로드 실패 ${relPath}: HTTP ${res.status}`);
  return res.arrayBuffer();
}

/** 텍스트 파일 읽기. 인스턴스 메모리에 5분 캐시(오류는 캐시하지 않는다). 없으면 null. */
export async function readText(relPath: string): Promise<string | null> {
  const now = Date.now();
  const hit = textCache.get(relPath);
  if (hit && hit.expiresAt > now) return hit.text;
  const buf = await readBytes(relPath);
  const text = buf ? new TextDecoder("utf-8").decode(buf) : null;
  textCache.set(relPath, { text, expiresAt: now + TEXT_CACHE_TTL_MS });
  return text;
}
