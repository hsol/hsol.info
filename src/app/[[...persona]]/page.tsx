import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PortfolioApp from "@/components/portfolio/PortfolioApp";
import {
  PERSONA_PATH_KEYS,
  type PersonaKey,
} from "@/components/portfolio/portfolio-types";
import { getSiteData } from "@/lib/content/site-data";

/** 페르소나별 검색 진입점 메타데이터. 동일 콘텐츠 셸이지만 URL/타깃 청중이 달라 별도 노출. */
const PERSONA_META: Record<
  PersonaKey,
  { title: string; description: string; path: string }
> = {
  hire: {
    title: "임한솔에게 채용·영입 제안 — hsol.info",
    description:
      "프루퍼 대표·PPB Studios 팀장 임한솔의 채용·영입 제안용 페르소나 뷰. 경력 요약과 협업 가능 영역을 한 화면에서 살펴보세요.",
    path: "/hire",
  },
  collab: {
    title: "임한솔과 협업하기 — hsol.info",
    description:
      "프로덕트·창업 협업을 검토하는 분을 위한 임한솔 페르소나 뷰. 함께 일했던 결과물과 관심 영역을 정리했습니다.",
    path: "/collab",
  },
  builder: {
    title: "메이커 임한솔의 만든 것들 — hsol.info",
    description:
      "엔지니어 출신 메이커 임한솔이 만든 프로덕트와 시도를 모은 페르소나 뷰. AI 클론 Ask Hansol과 직접 대화할 수 있습니다.",
    path: "/builder",
  },
  curious: {
    title: "그냥 궁금한 분을 위한 임한솔 — hsol.info",
    description:
      "임한솔이 누구인지, 어떤 생각을 하는지 가볍게 둘러보고 싶은 분을 위한 페르소나 뷰. Ask Hansol에게 무엇이든 물어보세요.",
    path: "/curious",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ persona?: string[] }>;
}): Promise<Metadata> {
  const { persona: segments } = await params;
  const key = segments?.[0] as PersonaKey | undefined;
  if (!key || !PERSONA_PATH_KEYS.includes(key)) {
    return { alternates: { canonical: "/" } };
  }
  const meta = PERSONA_META[key];
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: meta.path },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: meta.path,
    },
    twitter: { title: meta.title, description: meta.description },
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ persona?: string[] }>;
}) {
  const { persona: segments } = await params;
  if (segments && segments.length > 0) {
    const ok =
      segments.length === 1 &&
      (PERSONA_PATH_KEYS as readonly string[]).includes(segments[0] ?? "");
    if (!ok) notFound();
  }
  const siteData = await getSiteData();
  return <PortfolioApp siteData={siteData} />;
}
