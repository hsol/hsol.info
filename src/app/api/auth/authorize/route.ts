import crypto from "node:crypto";

import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const TEMP_MAX_AGE = 10 * 60; // 10분

function secureCookie() {
  return process.env.NODE_ENV === "production";
}

/** 43자 URL-safe 랜덤 문자열 (Vercel 문서 샘플과 동일). */
function randomString(length: number): string {
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => charset[b % charset.length]).join("");
}

export async function GET(req: NextRequest) {
  const state = randomString(43);
  const nonce = randomString(43);
  const codeVerifier = crypto.randomBytes(43).toString("hex");
  const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");

  const from = req.nextUrl.searchParams.get("from");
  const safeFrom = from && from.startsWith("/manage") ? from : "/manage";

  const params = new URLSearchParams({
    client_id: process.env.NEXT_PUBLIC_VERCEL_APP_CLIENT_ID as string,
    redirect_uri: `${req.nextUrl.origin}/api/auth/callback`,
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    response_type: "code",
    scope: "openid email profile",
  });

  const res = NextResponse.redirect(`https://vercel.com/oauth/authorize?${params.toString()}`);
  const opts = { httpOnly: true, secure: secureCookie(), sameSite: "lax" as const, maxAge: TEMP_MAX_AGE, path: "/" };
  res.cookies.set("oauth_state", state, opts);
  res.cookies.set("oauth_nonce", nonce, opts);
  res.cookies.set("oauth_code_verifier", codeVerifier, opts);
  res.cookies.set("oauth_from", safeFrom, opts);
  return res;
}
