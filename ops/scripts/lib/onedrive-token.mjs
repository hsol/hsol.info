/**
 * 개인 OneDrive(Microsoft Graph) 토큰 저장소. Neon `onedrive_token` 테이블에 AES-256-GCM 으로 암호화해 둔다.
 *
 * 토큰은 rclone 형식 JSON({access_token, token_type, refresh_token, expiry}) 그대로다.
 * CI(rclone)와 사이트 런타임(src/lib/onedrive/token.ts)이 같은 행을 읽고 쓴다. 리프레시 토큰이 쓸 때마다
 * 새로 나오므로, 쓰는 쪽은 항상 최신 토큰을 되써야 한다. 앱은 rclone 기본 앱(client id 는 공개값)이다.
 *
 * 환경변수
 *   DATABASE_URL (또는 POSTGRES_URL)  Neon
 *   ONEDRIVE_TOKEN_KEY                32바이트 base64. 잃으면 재인증(rclone authorize onedrive)
 *   ONEDRIVE_BOOTSTRAP_TOKEN          (선택) 저장된 토큰이 없을 때만 쓰는 rclone authorize 출력 JSON
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { neon } from "@neondatabase/serverless";

export const TOKEN_ROW_ID = "personal";

export function getSql() {
  const url = (process.env.DATABASE_URL || process.env.POSTGRES_URL || "").trim();
  if (!url) throw new Error("DATABASE_URL 이 없다.");
  return neon(url);
}

export function keyFrom(b64, name = "ONEDRIVE_TOKEN_KEY") {
  if (!b64) throw new Error(`${name} 이 없다.`);
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) throw new Error(`${name} 는 base64 로 인코딩한 32바이트여야 한다.`);
  return key;
}

export function encrypt(key, plaintext) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
}

export function decrypt(key, payloadB64) {
  const buf = Buffer.from(payloadB64, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
}

export async function ensureTables(sql) {
  await sql`CREATE TABLE IF NOT EXISTS onedrive_token (
    id text PRIMARY KEY,
    payload text NOT NULL,
    expires_at timestamptz,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS onedrive_sync_state (
    key text PRIMARY KEY,
    value jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;
}

/** 저장된 토큰(rclone JSON 문자열). 없으면 ONEDRIVE_BOOTSTRAP_TOKEN, 그것도 없으면 에러. */
export async function loadToken(sql, key) {
  const rows = await sql`SELECT payload FROM onedrive_token WHERE id = ${TOKEN_ROW_ID}`;
  if (rows[0]) return decrypt(key, rows[0].payload);
  const boot = process.env.ONEDRIVE_BOOTSTRAP_TOKEN?.trim();
  if (boot) {
    console.log("토큰: 저장된 토큰이 없어 ONEDRIVE_BOOTSTRAP_TOKEN 사용");
    return boot;
  }
  throw new Error("OneDrive 토큰이 없다. ONEDRIVE_BOOTSTRAP_TOKEN 을 넣고 다시 실행해야 한다.");
}

export async function saveToken(sql, key, tokenJson) {
  let expiresAt = null;
  try {
    const t = JSON.parse(tokenJson);
    if (t.expiry) expiresAt = new Date(t.expiry).toISOString();
  } catch {
    throw new Error("저장하려는 토큰이 JSON 이 아니다.");
  }
  const payload = encrypt(key, tokenJson);
  await sql`INSERT INTO onedrive_token (id, payload, expires_at, updated_at)
    VALUES (${TOKEN_ROW_ID}, ${payload}, ${expiresAt}, now())
    ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, expires_at = EXCLUDED.expires_at, updated_at = now()`;
}

export async function getState(sql, key) {
  const rows = await sql`SELECT value FROM onedrive_sync_state WHERE key = ${key}`;
  return rows[0]?.value ?? null;
}

export async function setState(sql, key, value) {
  await sql`INSERT INTO onedrive_sync_state (key, value, updated_at) VALUES (${key}, ${JSON.stringify(value)}::jsonb, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
}
