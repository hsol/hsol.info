import type { SiteData } from "@/content/schema";
import type { PersonaKey } from "./portfolio-types";

export function filterCareerForPersona(
  career: SiteData["career"],
  personaKey: PersonaKey,
  predicate: (item: SiteData["career"][number], index: number) => boolean,
): { items: SiteData["career"]; itemTiers: number[] } {
  const items: SiteData["career"] = [];
  const itemTiers: number[] = [];
  career.forEach((item, index) => {
    if (predicate(item, index)) {
      items.push(item);
      const t = item.tier[personaKey];
      itemTiers.push(
        typeof t === "number" && Number.isFinite(t) ? Math.max(1, Math.floor(t)) : 1,
      );
    }
  });
  return { items, itemTiers };
}
