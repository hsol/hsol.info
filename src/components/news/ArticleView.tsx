import Link from "next/link";
import type { ArticleRow } from "@/types/article";
import { SITE_URL } from "@/lib/news/seo";
import { MarkdownBody } from "@/components/portfolio/ask/MarkdownBody";
import { AskHansolCta } from "@/components/news/AskHansolCta";

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

/**
 * 기사 상세 — 시맨틱 <article> 마크업. SEO 신호(시간·작성자·섹션)를 가시 텍스트로도 노출하고,
 * 본문은 마크다운으로 렌더한다. JSON-LD 는 라우트에서 별도 주입.
 */
export function ArticleView({ article }: { article: ArticleRow }) {
  const published = formatDate(article.publishedAt);
  const modified = formatDate(article.updatedAt);

  return (
    <main id="main-content" className="news-page">
      <article className="news-article" itemScope itemType="https://schema.org/NewsArticle">
        {/* 화면 breadcrumb 를 JSON-LD BreadcrumbList 와 동일하게: 홈 › 뉴스 › [기사 제목].
            섹션은 아래 kicker 로 별도 표시한다. */}
        <nav className="news-breadcrumb" aria-label="breadcrumb">
          {/* 메인 사이트로 나가는 링크 — 다른 호스트라 절대 URL + 일반 <a>. */}
          <a href={SITE_URL}>홈</a>
          <span aria-hidden="true">›</span>
          <Link href="/news">뉴스</Link>
          <span aria-hidden="true">›</span>
          <span className="news-breadcrumb-current" aria-current="page">
            {article.headline}
          </span>
        </nav>

        <header className="news-header">
          <p className="news-kicker">{article.section}</p>
          <h1 className="news-headline" itemProp="headline">
            {article.headline}
          </h1>
          {article.dek ? <p className="news-dek">{article.dek}</p> : null}
          <div className="news-byline">
            <span itemProp="author">{article.byline}</span>
            {published ? (
              <>
                <span aria-hidden="true">·</span>
                <time dateTime={published.iso} itemProp="datePublished">
                  {published.label}
                </time>
              </>
            ) : null}
            {modified && modified.iso !== published?.iso ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="news-updated">
                  수정{" "}
                  <time dateTime={modified.iso} itemProp="dateModified">
                    {modified.label}
                  </time>
                </span>
              </>
            ) : null}
          </div>
        </header>

        {/* 본문 커버는 실제 시각 자료(coverImage)가 있을 때만 — 동적 OG 이미지는 헤드라인이
            든 카드라 h1 바로 아래 중복돼 보여 상세에서는 폴백하지 않는다(og·허브·RSS 만 폴백). */}
        {article.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="news-cover"
            src={article.coverImage}
            alt={article.coverImageAlt ?? article.headline}
            width={1200}
            height={630}
            itemProp="image"
          />
        ) : null}


        <div className="news-body" itemProp="articleBody">
          <MarkdownBody text={article.body} />
        </div>

        {article.cloneInterview ? (
          <aside className="news-clone" aria-label="AI 클론 인터뷰">
            <p className="news-clone-label">🤖 임한솔 AI 클론 인터뷰</p>
            <p className="news-clone-q">{article.cloneInterview.question}</p>
            <blockquote className="news-clone-a">{article.cloneInterview.answer}</blockquote>
            <p className="news-clone-cta">
              <AskHansolCta />
            </p>
          </aside>
        ) : null}

        {article.sourcingNote || article.references.length ? (
          <section className="news-sources" aria-label="출처">
            <h2 className="news-sources-title">출처</h2>
            {article.sourcingNote ? (
              <p className="news-sources-note">{article.sourcingNote}</p>
            ) : null}
            {article.references.length ? (
              <ol className="news-sources-list">
                {article.references.map((ref, i) => (
                  <li key={`${ref.title}-${i}`} className="news-source-item" itemProp="citation">
                    {ref.url ? (
                      <a href={ref.url} target="_blank" rel="noopener noreferrer">
                        {ref.title}
                      </a>
                    ) : (
                      <span>{ref.title}</span>
                    )}
                  </li>
                ))}
              </ol>
            ) : null}
          </section>
        ) : null}

        {article.tags.length ? (
          <footer className="news-tags" aria-label="태그">
            {article.tags.map((tag) => (
              <span key={tag} className="news-tag">
                #{tag}
              </span>
            ))}
          </footer>
        ) : null}

        <aside className="news-footer-nav">
          <Link href="/news">← 한솔닷컴 뉴스룸 전체 보기</Link>
        </aside>
      </article>
    </main>
  );
}
