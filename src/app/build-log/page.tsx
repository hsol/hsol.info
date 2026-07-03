import type { Metadata } from "next";
import { SiteDataProvider } from "@/components/portfolio/Atoms";
import { BuildLogPage } from "@/components/portfolio/BuildLogPage";
import { getSiteData } from "@/lib/content/site-data";
import { listBuildLog } from "@/lib/db/build-log";
import { paginate, resolvePage } from "@/lib/pagination";

// DB(build_log)를 읽어 렌더하므로 빌드·CDN에 고정하지 않고 요청 시 동적 렌더한다.
export const dynamic = "force-dynamic";

/** 한 페이지에 노출할 빌드 로그 회차 수. */
const PER_PAGE = 15;

export const metadata: Metadata = {
  title: "빌드 로그 — hsol.info",
  description: "이 사이트가 매 배포마다 레이아웃을 무엇을·어떤 의도로 개선했는지의 회차별 기록.",
  alternates: { canonical: "/build-log" },
  // 진단/메타 페이지이므로 검색 색인은 하지 않는다.
  robots: { index: false, follow: true },
};

export default async function BuildLogRoutePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const [siteData, entries, { page }] = await Promise.all([
    getSiteData(),
    listBuildLog(),
    searchParams,
  ]);
  const { items, page: current, pageCount, total, offset } = paginate(
    entries,
    resolvePage(page),
    PER_PAGE,
  );
  return (
    <SiteDataProvider data={siteData}>
      <BuildLogPage
        entries={items}
        page={current}
        pageCount={pageCount}
        total={total}
        offset={offset}
      />
    </SiteDataProvider>
  );
}
