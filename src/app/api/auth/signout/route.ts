import { type NextRequest, NextResponse } from "next/server";

import { MANAGE_COOKIE } from "@/lib/manage-auth";

/** POST 전용 — GET 로그아웃은 링크 prefetch 로 의도치 않게 트리거될 수 있어 form POST 로 받는다. */
export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/", req.nextUrl.origin), 303);
  res.cookies.set(MANAGE_COOKIE, "", { maxAge: 0, path: "/" });
  return res;
}
