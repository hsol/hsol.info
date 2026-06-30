import { neon } from "@neondatabase/serverless";
import type {
  ArticleInput,
  ArticleReference,
  ArticleRow,
  CloneInterview,
} from "@/types/article";

/**
 * 뉴스룸 기사 미러(Neon). 원본은 vault, 여기는 읽기 전용 미러다.
 * 쓰기는 오직 `scripts/sync-articles.ts`(npm run articles:sync) 한 곳에서만 일어난다.
 *
 * build_log 와 동일한 멱등 패턴: DATABASE_URL 미설정이면 조용히 빈 결과/no-op.
 */

const LIST_LIMIT = 200;

function getDbUrl(): string | null {
  const url = (process.env.DATABASE_URL || process.env.POSTGRES_URL || "").trim();
  return url || null;
}

function getSql() {
  const url = getDbUrl();
  if (!url) return null;
  return neon(url);
}

export function isArticlesDbConfigured(): boolean {
  return getDbUrl() !== null;
}

/** 테이블 보장(멱등). 마이그레이션 없이도 sync/CI 에서 동작하도록. */
export async function ensureArticlesTable(
  sql: NonNullable<ReturnType<typeof getSql>>,
): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS articles (
      id BIGSERIAL PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'draft',
      headline TEXT NOT NULL,
      dek TEXT,
      summary TEXT NOT NULL,
      section TEXT NOT NULL,
      tags JSONB NOT NULL DEFAULT '[]'::jsonb,
      keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
      byline TEXT NOT NULL DEFAULT '한솔닷컴 뉴스룸',
      body TEXT NOT NULL,
      sourcing_note TEXT,
      citations JSONB NOT NULL DEFAULT '[]'::jsonb,
      clone_interview JSONB,
      cover_image TEXT,
      cover_image_alt TEXT,
      published_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
}

type RawRow = {
  id: string;
  slug: string;
  status: string;
  headline: string;
  dek: string | null;
  summary: string;
  section: string;
  tags: unknown;
  keywords: unknown;
  byline: string;
  body: string;
  sourcing_note: string | null;
  citations: unknown;
  clone_interview: unknown;
  cover_image: string | null;
  cover_image_alt: string | null;
  published_at: string;
  updated_at: string | null;
  created_at: string;
  synced_at: string;
};

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  return [];
}

function toReferences(value: unknown): ArticleReference[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v): ArticleReference | null => {
      if (!v || typeof v !== "object") return null;
      const r = v as Record<string, unknown>;
      const title = typeof r.title === "string" ? r.title : null;
      if (!title) return null;
      return { title, url: typeof r.url === "string" && r.url ? r.url : null };
    })
    .filter((r): r is ArticleReference => r !== null);
}

function toCloneInterview(value: unknown): CloneInterview | null {
  if (!value || typeof value !== "object") return null;
  const o = value as Record<string, unknown>;
  const question = typeof o.question === "string" ? o.question.trim() : "";
  const answer = typeof o.answer === "string" ? o.answer.trim() : "";
  return question && answer ? { question, answer } : null;
}

function mapRow(r: RawRow): ArticleRow {
  return {
    id: Number(r.id),
    slug: r.slug,
    status: r.status === "published" ? "published" : "draft",
    headline: r.headline,
    dek: r.dek,
    summary: r.summary,
    section: r.section,
    tags: toStringArray(r.tags),
    keywords: toStringArray(r.keywords),
    byline: r.byline,
    body: r.body,
    sourcingNote: r.sourcing_note,
    references: toReferences(r.citations),
    cloneInterview: toCloneInterview(r.clone_interview),
    coverImage: r.cover_image,
    coverImageAlt: r.cover_image_alt,
    publishedAt: r.published_at,
    updatedAt: r.updated_at,
    createdAt: r.created_at,
    syncedAt: r.synced_at,
  };
}

const SELECT_COLS = `
  id::text AS id, slug, status, headline, dek, summary, section, tags, keywords,
  byline, body, sourcing_note, citations, clone_interview, cover_image, cover_image_alt,
  published_at::text AS published_at, updated_at::text AS updated_at,
  created_at::text AS created_at, synced_at::text AS synced_at
`;

/** 발행된 기사 최신순. DB 미설정/테이블 없음이면 빈 배열. */
export async function listPublishedArticles(limit = LIST_LIMIT): Promise<ArticleRow[]> {
  const sql = getSql();
  if (!sql) {
    const { readArticlesFromVault } = await import("./articles-local");
    const rows = await readArticlesFromVault();
    return rows.filter((r) => r.status === "published").slice(0, limit);
  }
  try {
    const rows = await sql.query(
      `SELECT ${SELECT_COLS} FROM articles
       WHERE status = 'published'
       ORDER BY published_at DESC
       LIMIT $1`,
      [limit],
    );
    return (rows as RawRow[]).map(mapRow);
  } catch {
    return [];
  }
}

/** slug 로 발행 기사 1건. 없거나 draft 면 null. */
export async function getPublishedArticleBySlug(slug: string): Promise<ArticleRow | null> {
  const sql = getSql();
  if (!sql) {
    const { readArticlesFromVault } = await import("./articles-local");
    const rows = await readArticlesFromVault();
    return rows.find((r) => r.slug === slug && r.status === "published") ?? null;
  }
  try {
    const rows = await sql.query(
      `SELECT ${SELECT_COLS} FROM articles WHERE slug = $1 AND status = 'published' LIMIT 1`,
      [slug],
    );
    const row = (rows as RawRow[])[0];
    return row ? mapRow(row) : null;
  } catch {
    return null;
  }
}

/** 발행 기사 slug + 최종수정 시각 — sitemap/generateStaticParams 용. */
export async function listPublishedArticleRefs(): Promise<
  Array<{ slug: string; lastmod: string }>
> {
  const sql = getSql();
  if (!sql) {
    const { readArticlesFromVault } = await import("./articles-local");
    const rows = await readArticlesFromVault();
    return rows
      .filter((r) => r.status === "published")
      .map((r) => ({ slug: r.slug, lastmod: r.updatedAt ?? r.publishedAt }));
  }
  try {
    const rows = await sql.query(
      `SELECT slug, COALESCE(updated_at, published_at)::text AS lastmod
       FROM articles WHERE status = 'published' ORDER BY published_at DESC`,
      [],
    );
    return rows as Array<{ slug: string; lastmod: string }>;
  } catch {
    return [];
  }
}

/**
 * vault 기사 1건을 미러로 upsert. slug 충돌 시 갱신.
 * 반환: 이 기사의 DB PK(id) — sync 가 vault frontmatter `dbId` 에 역기록한다.
 * **쓰기는 sync 스크립트 전용.** 페이지 런타임에서 호출하지 않는다.
 */
export async function upsertArticle(input: ArticleInput): Promise<number> {
  const sql = getSql();
  if (!sql) throw new Error("DATABASE_URL/POSTGRES_URL 미설정 — 동기화할 수 없습니다.");
  await ensureArticlesTable(sql);
  const rows = await sql.query(
    `INSERT INTO articles
       (slug, status, headline, dek, summary, section, tags, keywords, byline, body,
        sourcing_note, citations, clone_interview, cover_image, cover_image_alt, published_at, updated_at, synced_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11,$12::jsonb,$13::jsonb,$14,$15,$16,$17, now())
     ON CONFLICT (slug) DO UPDATE SET
       status = EXCLUDED.status,
       headline = EXCLUDED.headline,
       dek = EXCLUDED.dek,
       summary = EXCLUDED.summary,
       section = EXCLUDED.section,
       tags = EXCLUDED.tags,
       keywords = EXCLUDED.keywords,
       byline = EXCLUDED.byline,
       body = EXCLUDED.body,
       sourcing_note = EXCLUDED.sourcing_note,
       citations = EXCLUDED.citations,
       clone_interview = EXCLUDED.clone_interview,
       cover_image = EXCLUDED.cover_image,
       cover_image_alt = EXCLUDED.cover_image_alt,
       published_at = EXCLUDED.published_at,
       updated_at = EXCLUDED.updated_at,
       synced_at = now()
     RETURNING id::text AS id`,
    [
      input.slug,
      input.status,
      input.headline,
      input.dek,
      input.summary,
      input.section,
      JSON.stringify(input.tags),
      JSON.stringify(input.keywords),
      input.byline,
      input.body,
      input.sourcingNote,
      JSON.stringify(input.references),
      input.cloneInterview ? JSON.stringify(input.cloneInterview) : null,
      input.coverImage,
      input.coverImageAlt,
      input.publishedAt,
      input.updatedAt,
    ],
  );
  return Number((rows as Array<{ id: string }>)[0].id);
}
