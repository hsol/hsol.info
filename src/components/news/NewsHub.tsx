import Link from "next/link";
import type { ArticleRow } from "@/types/article";

const DATE_FMT = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

function formatDate(value: string | null): { iso: string; label: string } | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return { iso: d.toISOString(), label: DATE_FMT.format(d) };
}

/** 뉴스룸 허브 — 발행 기사 목록(내부 링크 클러스터의 중심). */
export function NewsHub({ articles }: { articles: ArticleRow[] }) {
  return (
    <main id="main-content" className="news-page">
      <nav className="news-back" aria-label="뒤로">
        <Link href="/">← hsol.info 홈</Link>
      </nav>

      <header className="news-hub-header">
        <h1 className="news-hub-title">한솔닷컴 뉴스룸</h1>
        <p className="news-hub-sub">
          한솔닷컴 뉴스룸이 임한솔의 일과 사건을 취재해 기록합니다.
        </p>
      </header>

      {articles.length === 0 ? (
        <p className="news-empty">아직 발행된 기사가 없습니다.</p>
      ) : (
        <ul className="news-list">
          {articles.map((a) => {
            const date = formatDate(a.publishedAt);
            return (
              <li key={a.slug} className="news-list-item">
                <Link href={`/news/${a.slug}`} className="news-card">
                  <span className="news-card-kicker">{a.section}</span>
                  <h2 className="news-card-headline">{a.headline}</h2>
                  {a.dek ? <p className="news-card-dek">{a.dek}</p> : null}
                  <span className="news-card-meta">
                    {a.byline}
                    {date ? (
                      <>
                        {" · "}
                        <time dateTime={date.iso}>{date.label}</time>
                      </>
                    ) : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
