"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { ManageNavItem } from "./nav";

/** 현재 경로와 정확히 일치할 때만 활성 표시. 하위 경로는 각자 자기 항목이 활성이므로 exact match. */
export function ManageNavLink({ href, label }: ManageNavItem) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link className={"manage-nav-item" + (active ? " is-active" : "")} href={href}>
      {label}
    </Link>
  );
}
