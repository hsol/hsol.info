import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";

import { MANAGE_COOKIE, verifySession } from "@/lib/manage-auth";
import "@/styles/manage.css";

import { MANAGE_NAV } from "./nav";
import { ManageNavLink } from "./nav-link";

/**
 * 관리 콘솔 공통 셸 — 1단 전체 LNB. 앞으로 /manage/<기능> 라우트를 추가하면
 * 이 셸이 자동으로 입혀진다. 기능별 화면(2·3단)은 각 page 가 그린다.
 */

// 봇 차단의 실효는 미들웨어의 X-Robots-Tag 헤더가 낸다(게이트 때문에 봇은 이 HTML 을
// 볼 일이 없다). 여기 metadata 는 의도를 코드에 남기는 용도.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function ManageLayout({ children }: { children: ReactNode }) {
  // 미들웨어가 이미 세션을 보장하지만, 표시용으로 한 번 더 읽는다.
  const store = await cookies();
  const token = store.get(MANAGE_COOKIE)?.value;
  const session = token
    ? await verifySession(token, process.env.MANAGE_SESSION_SECRET as string)
    : null;
  const who = session?.name ?? session?.email ?? "";

  return (
    <>
      <div className="manage-shell">
        <nav className="manage-nav">
          <div className="manage-nav-brand">CONSOLE</div>
          <ul className="manage-nav-list">
            {MANAGE_NAV.map((item) => (
              <li key={item.href}>
                <ManageNavLink {...item} />
              </li>
            ))}
          </ul>
          <div className="manage-nav-foot">
            <div className="manage-nav-who">{who}</div>
            <form action="/api/auth/signout" method="post">
              <button type="submit" className="manage-signout">
                로그아웃
              </button>
            </form>
          </div>
        </nav>
        {children}
      </div>
      <div className="manage-mobile-block">
        <div className="manage-mobile-block-title">CONSOLE</div>
        <p>관리 콘솔은 데스크톱에서 이용해주세요.</p>
      </div>
    </>
  );
}
