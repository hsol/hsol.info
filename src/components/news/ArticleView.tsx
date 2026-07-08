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
export function ArticleView({
  article,
  related = [],
}: {
  article: ArticleRow;
  related?: ArticleRow[];
}) {
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

        <footer className="news-tags" aria-label="태그">
          {article.tags.map((tag) => (
            <Link key={tag} href={`/news?tag=${encodeURIComponent(tag)}`} className="news-tag">
              #{tag}
            </Link>
          ))}
          <Link href="/news" className="news-tags-link">
            ← 한솔닷컴 뉴스룸 전체 보기
          </Link>
        </footer>

        {related.length ? (
          <section className="news-related" aria-label="관련 기사">
            <h2 className="news-related-title">관련 기사</h2>
            <ul className="news-related-list">
              {related.map((r) => {
                const date = formatDate(r.publishedAt);
                return (
                  <li key={r.slug} className="news-related-item">
                    <Link href={`/news/${r.slug}`} className="news-related-link">
                      <span className="news-related-kicker">{r.section}</span>
                      <span className="news-related-headline">{r.headline}</span>
                      {date ? (
                        <time className="news-related-date" dateTime={date.iso}>
                          {date.label}
                        </time>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {/* 인물 카드 — "임한솔 결혼" 등 이름 오인으로 착지한 독자에게 '이 임한솔이 누구인지'를
            가시 텍스트로 밝히고(동명이인 구분), 포트폴리오·Ask Hansol 로 전환 동선을 준다. */}
        <aside className="news-person-card" aria-label="이 임한솔은 누구인가요">
          <p className="news-person-eyebrow">이 임한솔은 누구인가요?</p>
          <p className="news-person-body">
            온라인의 기술과 오프라인의 운영을 잇는 개발자이자 <strong>프루퍼 주식회사</strong> 대표
            임한솔(Hansol Lim)입니다. 정치인·변호사 임한솔과는 동명이인입니다.
          </p>
          <div className="news-person-actions">
            <a className="news-person-link" href={SITE_URL}>
              포트폴리오 보기 →
            </a>
            <AskHansolCta />
          </div>
        </aside>
      </article>
    </main>
  );
}
