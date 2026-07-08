import type { ArticleRow } from "@/types/article";

/**
 * 관련 기사 선정 — 기사 상세 하단 크로스링크(내부 링크 클러스터)용.
 *
 * "임한솔 결혼"처럼 이름 오인으로 착지하는 트래픽이 한 페이지만 보고 이탈하지 않도록,
 * 같은 맥락의 다른 생애 기사로 이어 주는 편집 동선을 만든다.
 *
 * 점수: 공유 태그(개당 3점) > 같은 섹션(1점) 순으로 관련도를 매기고, 동점이면 최신 발행순.
 * 자기 자신은 제외하며, 관련 신호가 전혀 없어도 최신 기사로 채워 항상 limit 개를 낸다.
 */
export function pickRelatedArticles(
  current: ArticleRow,
  all: ArticleRow[],
  limit = 3,
): ArticleRow[] {
  const currentTags = new Set(current.tags);

  const scored = all
    .filter((a) => a.slug !== current.slug)
    .map((a) => {
      const sharedTags = a.tags.filter((t) => currentTags.has(t)).length;
      const sameSection = a.section === current.section ? 1 : 0;
      const score = sharedTags * 3 + sameSection;
      return { article: a, score, publishedAt: a.publishedAt };
    });

  scored.sort((x, y) => {
    if (y.score !== x.score) return y.score - x.score;
    // 동점이면 최신 발행순(문자열 ISO 비교로 충분).
    return (y.publishedAt ?? "").localeCompare(x.publishedAt ?? "");
  });

  return scored.slice(0, limit).map((s) => s.article);
}
