import PortfolioApp from "@/components/portfolio/PortfolioApp";
import { getSiteData } from "@/lib/content/site-data";

export default async function Page() {
  const siteData = await getSiteData();
  return <PortfolioApp siteData={siteData} />;
}
