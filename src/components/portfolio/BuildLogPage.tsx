"use client";

import { useRouter } from "next/navigation";
import { Back, Foot, Plate, SecHead } from "@/components/portfolio/Atoms";
import { ViewHead } from "@/components/portfolio/view-primitives";
import type { BuildLogRow } from "@/lib/db/build-log";

/**
 * /build-log — 매 리프레시마다 에이전트가 레이아웃을 "무엇을 어떤 의도로" 개선했는지의 누적 로그.
 * 데이터 출처는 DB(build_log). footer 의 빌드 버전을 누르면 여기로 온다.
 */

function formatAt(at: string): string {
  // postgres 타임스탬프 텍스트("2026-06-23 04:59:37.1+00")를 분 단위 UTC 표기로.
  const iso = at.includes("T") ? at : at.replace(" ", "T");
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return at;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`;
}

export function BuildLogPage({ entries }: { entries: BuildLogRow[] }) {
  const router = useRouter();
  return (
    <div className="app-layout">
      <div className="shell">
        <main id="main-content">
          <div className="view">
            <Back onBack={() => router.push("/")} />
            <Plate />
            <ViewHead
              room="META · BUILD"
              coord="Z2"
              title="빌드 로그"
              lede="이 사이트는 배포할 때마다 에이전트가 잘 만든 포트폴리오를 리서치해 레이아웃을 조금씩 다듬습니다. 회차별로 무엇을 어떤 의도로 바꿨는지 남깁니다."
            />

            {entries.length === 0 ? (
              <p className="career-curation-note">아직 기록된 빌드 로그가 없습니다.</p>
            ) : (
              entries.map((e, i) => (
                <div className="sec" key={e.id}>
                  <SecHead
                    title={`build ${e.version}`}
                    num={String(entries.length - i).padStart(2, "0")}
                    meta={e.lens ?? undefined}
                  />
                  <p className="career-curation-note">{formatAt(e.created_at)}</p>
                  <ul className="career-points">
                    {e.changes.map((c, j) => (
                      <li key={j}>{c}</li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        </main>
        <Foot />
      </div>
    </div>
  );
}
