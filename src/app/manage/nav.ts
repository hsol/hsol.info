/**
 * 관리 콘솔 좌측 1단 LNB 항목. 세 곳이 이 순서에 합의한다:
 *  - `/manage` 진입 시 리다이렉트 대상(= 첫 항목)
 *  - LNB 렌더(layout.tsx)
 *  - 활성 표시 판정(nav-link.tsx)
 * 새 관리 기능은 여기에 항목을 추가하면 세 곳에 자동 반영된다.
 */
export type ManageNavItem = { href: string; label: string };

export const MANAGE_NAV: ManageNavItem[] = [
  { href: "/manage/ask-hansol", label: "Ask Hansol 로그" },
];
