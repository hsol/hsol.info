import Link from "next/link";
import type { ArticleRow } from "@/types/article";
import { SITE_URL } from "@/lib/news/seo";

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
        {/* 뉴스룸(서브도메인)에서 메인 사이트로 나가는 링크 — 다른 호스트라 절대 URL + 일반 <a>.
            href="/" 로 두면 news.hsol.info/ 로만 돌아와 버린다. */}
        <a href={SITE_URL}>← hsol.info 홈</a>
      </nav>

      <header className="news-hub-header">
        <h1 className="news-hub-title">한솔닷컴 Newsroom</h1>
        <p className="news-hub-sub">
          임한솔이 살아오면서 보고 겪은 일과 사건들을 임한솔 AI 클론을 취재하여 순차적으로 기록해 나갑니다.<br/>
          뉴스룸의 이름은 임한솔의 옛 블로그명을 딴 개인 매체 <strong>한솔닷컴</strong>에서 따왔습니다.
        </p>
      </header>

      {articles.length === 0 ? (
        <p className="news-empty">아직 발행된 기사가 없습니다.</p>
      ) : (
        <ul className="news-list">
          {articles.map((a) => {
            const date = formatDate(a.publishedAt);
            // coverImage 없으면 동적 OG 이미지 폴백(기사 상세·og 카드와 동일 이미지).
            const thumb = a.coverImage ?? `/news/${a.slug}/opengraph-image/og`;
            return (
              <li key={a.slug} className="news-list-item">
                <Link href={`/news/${a.slug}`} className="news-card">
                  <span className="news-card-text">
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
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="news-card-thumb"
                    src={thumb}
                    alt={a.coverImageAlt ?? a.headline}
                    width={1200}
                    height={630}
                    loading="lazy"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
