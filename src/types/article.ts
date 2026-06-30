/**
 * 뉴스룸 Article 모델.
 *
 * 원본(SSOT)은 vault(`hsol-info-blob/vault/objects/articles/<slug>.md`)이고,
 * Neon `articles` 테이블은 그 **미러**다. `npm run articles:sync`가 vault → DB 로
 * 단방향 동기화하며, 최초 INSERT 시 PK(`dbId`)를 vault frontmatter 에 역기록해 페어링한다.
 *
 * 이 트랙은 site-data.json/blob 자동생성 파이프라인과 완전히 분리돼 있다.
 */

export type ArticleSection = "인물" | "비즈니스" | "기술" | "창업" | "문화";

export type ArticleStatus = "draft" | "published";

/**
 * 공개 출처(레퍼런스) — 독자가 따라갈 수 있는 **실재 외부 링크**.
 * vault 내부 추적용 `sources`(wikilink)와 다르며, 페이지·JSON-LD citation 으로 노출된다.
 */
export type ArticleReference = {
  title: string;
  url: string | null;
};

/**
 * AI 클론 인터뷰 — 한솔닷컴 뉴스룸이 임한솔의 AI 클론(Ask Hansol)을 "취재"한 한 토막.
 * 브랜딩 + Ask Hansol 유도. 답변은 1인칭이되 vault 사실과 일치해야 한다(새 사실 금지).
 */
export type CloneInterview = {
  question: string;
  answer: string;
};

/** vault frontmatter 에서 파싱한 기사 — sync 스크립트가 다루는 형태. */
export type ArticleInput = {
  slug: string;
  status: ArticleStatus;
  headline: string;
  dek: string | null;
  summary: string;
  section: string;
  tags: string[];
  keywords: string[];
  byline: string;
  publishedAt: string;
  updatedAt: string | null;
  coverImage: string | null;
  coverImageAlt: string | null;
  body: string;
  /** 취재 주석 — "어떻게 확인했는가"를 제3자 시점으로 서술한 한 문단. */
  sourcingNote: string | null;
  /** 공개 출처 링크 목록. */
  references: ArticleReference[];
  /** AI 클론(Ask Hansol) 인터뷰 한 토막. 없으면 null. */
  cloneInterview: CloneInterview | null;
};

/** Neon `articles` 한 행 — 페이지가 읽는 형태. */
export type ArticleRow = ArticleInput & {
  id: number;
  createdAt: string;
  syncedAt: string;
};
