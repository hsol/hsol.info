import Link from "next/link";
import { PAGE_PARAM } from "@/lib/pagination";
import styles from "./Pagination.module.css";

/**
 * 페이지네이션 UI — 뉴스룸·빌드 로그가 공유하는 단일 모듈.
 *
 * - 서버/클라이언트 어느 트리에서도 렌더 가능("use client" 없음, next/link 사용).
 * - `?page=` 쿼리 기반이라 딥링크·SEO·JS 미동작 환경 모두에서 동작한다.
 * - 색은 currentColor 파생(모듈 CSS)이라 각 페이지 테마에 자동으로 녹아든다.
 */

type PaginationProps = {
  /** 1-기반 현재 페이지. */
  page: number;
  /** 전체 페이지 수. */
  pageCount: number;
  /**
   * 페이지 링크의 기준 경로. 1페이지는 `basePath`, 그 외는 `basePath?page=N`.
   *   뉴스룸: "/news" (서브도메인에선 미들웨어가 표시 경로를 "/"로 정규화)
   *   빌드 로그: "/build-log"
   */
  basePath: string;
  /** nav 의 aria-label(스크린리더용). */
  label?: string;
};

/** 현재 페이지 주변 + 양 끝만 남기고 나머지는 생략(…)하는 페이지 번호 목록. */
function pageWindow(page: number, pageCount: number): (number | "…")[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  }
  const out: (number | "…")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(pageCount - 1, page + 1);
  if (start > 2) out.push("…");
  for (let p = start; p <= end; p++) out.push(p);
  if (end < pageCount - 1) out.push("…");
  out.push(pageCount);
  return out;
}

function hrefFor(basePath: string, page: number): string {
  return page <= 1 ? basePath : `${basePath}?${PAGE_PARAM}=${page}`;
}

export function Pagination({ page, pageCount, basePath, label = "페이지" }: PaginationProps) {
  // 페이지가 하나뿐이면 렌더하지 않는다.
  if (pageCount <= 1) return null;

  const prevDisabled = page <= 1;
  const nextDisabled = page >= pageCount;

  return (
    <nav className={styles.nav} aria-label={label}>
      <ul className={styles.list}>
        <li>
          {prevDisabled ? (
            <span className={`${styles.item} ${styles.disabled}`} aria-hidden="true">
              ‹<span className={styles.edgeLabel}>이전</span>
            </span>
          ) : (
            <Link
              className={styles.item}
              href={hrefFor(basePath, page - 1)}
              rel="prev"
              aria-label="이전 페이지"
            >
              ‹<span className={styles.edgeLabel}>이전</span>
            </Link>
          )}
        </li>

        {pageWindow(page, pageCount).map((p, i) =>
          p === "…" ? (
            <li key={`gap-${i}`}>
              <span className={`${styles.item} ${styles.ellipsis}`}>…</span>
            </li>
          ) : p === page ? (
            <li key={p}>
              <span className={`${styles.item} ${styles.current}`} aria-current="page">
                {p}
              </span>
            </li>
          ) : (
            <li key={p}>
              <Link
                className={styles.item}
                href={hrefFor(basePath, p)}
                aria-label={`${p}페이지`}
              >
                {p}
              </Link>
            </li>
          ),
        )}

        <li>
          {nextDisabled ? (
            <span className={`${styles.item} ${styles.disabled}`} aria-hidden="true">
              <span className={styles.edgeLabel}>다음</span>›
            </span>
          ) : (
            <Link
              className={styles.item}
              href={hrefFor(basePath, page + 1)}
              rel="next"
              aria-label="다음 페이지"
            >
              <span className={styles.edgeLabel}>다음</span>›
            </Link>
          )}
        </li>
      </ul>
    </nav>
  );
}
