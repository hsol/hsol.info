import { type NextRequest, NextResponse } from "next/server";

import { MANAGE_COOKIE, SESSION_TTL_SEC, signSession, type ManageSession } from "@/lib/manage-auth";

export const dynamic = "force-dynamic";

function decodeIdToken(idToken: string): Record<string, unknown> {
  const seg = idToken.split(".")[1] ?? "";
  return JSON.parse(Buffer.from(seg, "base64url").toString("utf-8"));
}

/** 로그인한 유저가 우리 Vercel 팀 멤버인지 서버 토큰으로 실시간 조회. allowlist 없음. */
async function isTeamMember(sub: string, email: string): Promise<boolean> {
  const token = process.env.VERCEL_TOKEN;
  const teamId = process.env.VERCEL_TEAM_ID;
  if (!token || !teamId) return false;

  // ponytail: limit=100, 페이지네이션 없음 — 개인 팀은 100명 미만. 팀이 커지면 until 루프 추가.
  const res = await fetch(`https://api.vercel.com/v3/teams/${teamId}/members?limit=100`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return false;

  const data = (await res.json().catch(() => null)) as { members?: Array<{ uid?: string; email?: string }> } | null;
  const members = Array.isArray(data?.members) ? data!.members : [];
  const em = email.toLowerCase();
  return members.some((m) => m?.uid === sub || (!!em && String(m?.email ?? "").toLowerCase() === em));
}

function deny(reason: string): NextResponse {
  console.warn(`[manage-auth] denied: ${reason}`);
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><title>접근 거부</title>` +
      `<body style="font-family:system-ui;max-width:32rem;margin:auto;padding:3rem 1.5rem">` +
      `<h1>접근 거부</h1><p>이 계정은 관리 콘솔 접근 권한이 없습니다.</p>` +
      `<p><a href="/api/auth/authorize">다른 계정으로 다시 로그인</a> · <a href="/">홈으로</a></p></body>`,
    { status: 403, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const storedState = req.cookies.get("oauth_state")?.value;
  const storedNonce = req.cookies.get("oauth_nonce")?.value;
  const codeVerifier = req.cookies.get("oauth_code_verifier")?.value;
  const from = req.cookies.get("oauth_from")?.value;
  const safeFrom = from && from.startsWith("/manage") ? from : "/manage";

  if (!code || !state || !storedState || state !== storedState) return deny("state mismatch");

  const tokenRes = await fetch("https://api.vercel.com/login/oauth/token", {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.NEXT_PUBLIC_VERCEL_APP_CLIENT_ID as string,
      client_secret: process.env.VERCEL_APP_CLIENT_SECRET as string,
      code,
      code_verifier: codeVerifier ?? "",
      redirect_uri: `${url.origin}/api/auth/callback`,
    }),
  });
  if (!tokenRes.ok) return deny(`token exchange ${tokenRes.status}`);

  let claims: Record<string, unknown>;
  try {
    const tokens = (await tokenRes.json()) as { id_token?: string };
    claims = decodeIdToken(tokens.id_token ?? "");
  } catch {
    return deny("id_token parse failed");
  }

  if (!claims.nonce || claims.nonce !== storedNonce) return deny("nonce mismatch");

  const sub = String(claims.sub ?? "");
  const email = String(claims.email ?? "");
  const name = claims.name ? String(claims.name) : undefined;

  if (!(await isTeamMember(sub, email))) return deny(`not a team member (sub=${sub}, email=${email})`);

  const session: ManageSession = { sub, email, name, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SEC };
  const cookie = await signSession(session, process.env.MANAGE_SESSION_SECRET as string);

  const res = NextResponse.redirect(new URL(safeFrom, url.origin));
  res.cookies.set(MANAGE_COOKIE, cookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL_SEC,
    path: "/",
  });
  for (const k of ["oauth_state", "oauth_nonce", "oauth_code_verifier", "oauth_from"]) {
    res.cookies.set(k, "", { maxAge: 0, path: "/" });
  }
  return res;
}
