/**
 * /manage 게이트용 세션 쿠키 서명/검증.
 * 미들웨어(엣지 런타임)와 콜백 라우트(Node)가 함께 쓰므로 Node crypto 대신
 * Web Crypto(crypto.subtle)와 btoa/atob 만 사용한다.
 */

export const MANAGE_COOKIE = "manage_session";
export const SESSION_TTL_SEC = 8 * 60 * 60; // 8h

export type ManageSession = {
  sub: string; // Vercel user id
  email: string;
  name?: string;
  exp: number; // unix seconds
};

function bytesToB64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signSession(session: ManageSession, secret: string): Promise<string> {
  const body = bytesToB64url(new TextEncoder().encode(JSON.stringify(session)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), new TextEncoder().encode(body));
  return `${body}.${bytesToB64url(new Uint8Array(sig))}`;
}

export async function verifySession(token: string, secret: string): Promise<ManageSession | null> {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  let ok = false;
  try {
    ok = await crypto.subtle.verify("HMAC", await hmacKey(secret), b64urlToBytes(sig), new TextEncoder().encode(body));
  } catch {
    return null;
  }
  if (!ok) return null;
  try {
    const session = JSON.parse(new TextDecoder().decode(b64urlToBytes(body))) as ManageSession;
    if (typeof session.exp !== "number" || session.exp * 1000 < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}
