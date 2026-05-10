import { notFound } from "next/navigation";
import PortfolioApp from "@/components/portfolio/PortfolioApp";
import { PERSONA_PATH_KEYS } from "@/components/portfolio/portfolio-types";
import { getSiteData } from "@/lib/content/site-data";

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
