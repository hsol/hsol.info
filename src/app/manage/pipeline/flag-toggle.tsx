"use client";

import { useState } from "react";

/**
 * 플래그 하나의 토글. 클릭 → 낙관적 반영 → PATCH → 성공 시 서버 권위값으로 확정, 실패 시 복귀.
 * router.refresh() 로 재조회하지 않는다 — Edge Config 는 write 직후 read 가 stale 일 수 있어
 * 방금 쓴 값(응답)이 가장 정확하다.
 */
export function FlagToggle({
  flagKey,
  value,
  locked,
}: {
  flagKey: string;
  value: boolean;
  locked: boolean;
}) {
  const [on, setOn] = useState(value);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function toggle() {
    if (locked || pending) return;
    const next = !on;
    setOn(next); // 낙관적
    setPending(true);
    setFailed(false);
    try {
      const res = await fetch("/api/manage/pipeline", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: flagKey, value: next }),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { flags?: Record<string, boolean> };
      setOn(Boolean(data.flags?.[flagKey])); // 서버 권위값으로 확정
    } catch {
      setOn(!next); // 되돌리기
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="manage-toggle-wrap">
      {failed && <span className="manage-toggle-error">저장 실패</span>}
      {locked && <span className="manage-toggle-note">고정됨</span>}
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={flagKey}
        className={"manage-toggle" + (on ? " is-on" : "") + (locked ? " is-locked" : "")}
        disabled={locked || pending}
        onClick={toggle}
      >
        <span className="manage-toggle-knob" />
      </button>
    </div>
  );
}
