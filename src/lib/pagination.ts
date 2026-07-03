/**
 * 페이지네이션 공용 로직 — 뉴스룸(/news)·빌드 로그(/build-log)가 같은 규칙을 공유한다.
 * React 비의존(서버·클라이언트 어디서나 호출 가능)이라 UI 컴포넌트와 분리해 둔다.
 */

/** URL 쿼리 파라미터 이름. `?page=2`. */
export const PAGE_PARAM = "page";

export type PageState<T> = {
  /** 현재 페이지에 보여줄 항목(원본 배열의 slice). */
  items: T[];
  /** 1-기반 현재 페이지(범위를 벗어난 입력은 [1, pageCount]로 클램프). */
  page: number;
  /** 전체 페이지 수(최소 1). */
  pageCount: number;
  /** 전체 항목 수(페이지네이션 이전). */
  total: number;
  /** 현재 페이지 첫 항목의 원본 배열상 0-기반 인덱스. 전역 번호 매김에 쓴다. */
  offset: number;
};

/**
 * `?page=` 쿼리 원시값을 1-기반 정수로 정규화한다.
 * 배열(중복 쿼리)·비정수·음수·NaN 은 모두 1페이지로 처리.
 */
export function resolvePage(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/**
 * 이미 메모리에 로드된 배열을 페이지 단위로 자른다.
 * (뉴스·빌드 로그 모두 목록 전체를 한 번에 로드하므로 인메모리 slice 로 충분하다.)
 */
export function paginate<T>(items: T[], page: number, perPage: number): PageState<T> {
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const current = Math.min(Math.max(1, page), pageCount);
  const offset = (current - 1) * perPage;
  return {
    items: items.slice(offset, offset + perPage),
    page: current,
    pageCount,
    total,
    offset,
  };
}
