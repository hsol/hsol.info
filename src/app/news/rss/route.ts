import { buildNewsFeedResponse } from "@/lib/news/feed";

/**
 * 뉴스룸 RSS 피드 별칭 (`/news/rss`).
 * `news.hsol.info/rss` 는 미들웨어가 `/news/rss` 로 rewrite 하므로 이 라우트가 응답한다.
 * `/news/feed.xml`·`/rss` 와 동일한 본문을 반환한다.
 */
export const revalidate = 600;

export function GET(): Promise<Response> {
  return buildNewsFeedResponse();
}
