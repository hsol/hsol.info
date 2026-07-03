<?xml version="1.0" encoding="UTF-8"?>
<!--
  뉴스룸 RSS 피드용 브라우저 스타일시트.
  피드 XML(`/news/feed.xml`, `/rss`)을 사람이 브라우저로 열면 이 XSLT 1.0 변환이 적용돼
  구독 안내 + 최근 기사 목록이 담긴 읽을 수 있는 페이지로 렌더된다. 피드 리더는 이 PI 를 무시한다.
  XSLT 는 same-origin 에서만 로드되므로 hsol.info / news.hsol.info 양쪽에서 `/feed.xsl` 로 참조된다.
-->
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:media="http://search.yahoo.com/mrss/"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <xsl:output method="html" encoding="UTF-8" indent="yes"
    doctype-system="about:legacy-compat" />

  <xsl:template match="/rss/channel">
    <html lang="ko">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title><xsl:value-of select="title" /> · RSS</title>
        <style>
          :root {
            --bg: #fff; --fg: #14202b; --muted: #5b6b78;
            --accent: #1d6fa5; --accent-dark: #0e2a3d;
            --border: #e7ecef; --soft: #f5f8fa;
          }
          * { box-sizing: border-box; }
          body {
            margin: 0; background: var(--bg); color: var(--fg);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
              "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
            line-height: 1.6; -webkit-font-smoothing: antialiased;
          }
          .wrap { max-width: 720px; margin: 0 auto; padding: 2.5rem 1.25rem 5rem; }
          .kicker {
            font-size: 0.78rem; font-weight: 700; letter-spacing: 0.08em;
            text-transform: uppercase; color: var(--accent); margin: 0 0 0.6rem;
          }
          h1 { font-size: 1.9rem; line-height: 1.25; margin: 0 0 0.5rem; letter-spacing: -0.01em; }
          .lede { color: var(--muted); margin: 0 0 1.75rem; font-size: 1.02rem; }
          .note {
            background: var(--soft); border: 1px solid var(--border);
            border-radius: 12px; padding: 1rem 1.15rem; margin: 0 0 2.5rem;
            font-size: 0.9rem; color: var(--muted);
          }
          .note strong { color: var(--fg); }
          .note code {
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            background: #fff; border: 1px solid var(--border); border-radius: 6px;
            padding: 0.1rem 0.4rem; font-size: 0.85em; color: var(--accent-dark);
            word-break: break-all;
          }
          .items { list-style: none; margin: 0; padding: 0; }
          .item { padding: 1.4rem 0; border-top: 1px solid var(--border); }
          .item-meta {
            display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap;
            font-size: 0.78rem; color: var(--muted); margin: 0 0 0.4rem;
          }
          .cat {
            text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700;
            color: var(--accent);
          }
          .item h2 { font-size: 1.18rem; line-height: 1.35; margin: 0 0 0.35rem; }
          .item h2 a { color: var(--fg); text-decoration: none; }
          .item h2 a:hover { color: var(--accent); text-decoration: underline; }
          .item p { margin: 0; color: var(--muted); font-size: 0.95rem; }
          .row { display: flex; gap: 1rem; align-items: flex-start; }
          .thumb {
            flex: 0 0 96px; width: 96px; height: 64px; object-fit: cover;
            border-radius: 8px; border: 1px solid var(--border); background: var(--soft);
          }
          footer {
            margin-top: 3rem; padding-top: 1.5rem; border-top: 1px solid var(--border);
            font-size: 0.82rem; color: var(--muted);
          }
          footer a { color: var(--accent); text-decoration: none; }
          footer a:hover { text-decoration: underline; }
          @media (max-width: 480px) { .thumb { display: none; } }
        </style>
      </head>
      <body>
        <div class="wrap">
          <p class="kicker">RSS 피드</p>
          <h1><xsl:value-of select="title" /></h1>
          <p class="lede"><xsl:value-of select="description" /></p>

          <div class="note">
            지금 보시는 건 <strong>RSS 피드</strong>입니다. 이 페이지 주소를
            원하시는 피드 리더(Feedly·NetNewsWire·Inoreader 등)에 붙여넣으면
            새 기사를 자동으로 받아볼 수 있습니다.<br />
            <xsl:text>구독 주소 </xsl:text>
            <code><xsl:value-of select="atom:link/@href" /></code>
          </div>

          <ul class="items">
            <xsl:for-each select="item">
              <li class="item">
                <div class="row">
                  <xsl:if test="media:thumbnail/@url">
                    <img class="thumb" src="{media:thumbnail/@url}" alt="" loading="lazy" />
                  </xsl:if>
                  <div>
                    <p class="item-meta">
                      <xsl:if test="category">
                        <span class="cat"><xsl:value-of select="category" /></span>
                      </xsl:if>
                      <span><xsl:value-of select="substring(pubDate, 1, 16)" /></span>
                    </p>
                    <h2>
                      <a href="{link}"><xsl:value-of select="title" /></a>
                    </h2>
                    <p><xsl:value-of select="description" /></p>
                  </div>
                </div>
              </li>
            </xsl:for-each>
          </ul>

          <footer>
            <a href="{link}">← <xsl:value-of select="title" /> 홈으로</a>
          </footer>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
