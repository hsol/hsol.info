import { buildNewsFeedResponse } from "@/lib/news/feed";

/**
 * 한솔닷컴 뉴스룸 RSS 2.0 피드 (`/news/feed.xml`).
 * 본문 생성은 `@/lib/news/feed` 가 담당하며 `/rss` 와 공유한다. DB(미러)를 읽으므로 ISR 재검증.
 */
export const revalidate = 600;

export function GET(): Promise<Response> {
  return buildNewsFeedResponse();
}
