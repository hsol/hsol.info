import { redirect } from "next/navigation";

import { MANAGE_NAV } from "./nav";

/** 콘솔 진입점 — 사이드바 첫 메뉴로 보낸다. */
export default function ManageIndex() {
  redirect(MANAGE_NAV[0].href);
}
