/**
 * hsol-info-blob 전용: vault 뉴스룸 기사(원본) → Neon `articles`(미러) 단방향 동기화.
 * GitHub Actions(.github/workflows/sync-articles-to-db.yml)에서 실행한다.
 *
 * - 원본: vault/objects/news-articles/<slug>.md  (frontmatter `type: NewsArticle`)
 * - Neon 에 upsert(ON CONFLICT slug) 후, 최초 INSERT 면 PK 를 해당 vault 파일 frontmatter
 *   `dbId` 에 surgical 역기록한다(페어링). 워크플로가 그 변경을 vault 에 커밋한다.
 * - 사이트 런타임은 이 Neon 미러를 읽는다(blob 아님). 그래서 blob 업로드와는 별개 트랙이다.
 *
 * ⚠ 미러 스키마/upsert 컬럼은 hsol.info 의 `src/lib/db/articles.ts` 와 동일해야 한다.
 *   둘 중 하나를 바꾸면 다른 쪽도 맞춘다.
 *
 * env: DATABASE_URL (또는 POSTGRES_URL) 필수.  옵션: --dry (DB·역기록 없이 검증만)
 */
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import matter from "gray-matter";
import { neon } from "@neondatabase/serverless";

const ARTICLES_DIR = process.env.VAULT_ARTICLES_DIR ?? "vault/objects/news-articles";
const DRY_RUN = process.argv.includes("--dry");

function asString(v) {
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number") return String(v);
  if (v instanceof Date) return v.toISOString();
  return null;
}
function asStringArray(v) {
  if (Array.isArray(v)) return v.map(asString).filter(Boolean);
  return [];
}
function asStatus(v) {
  return v === "published" ? "published" : "draft";
}
function asReferences(v) {
  if (!Array.isArray(v)) return [];
  return v
    .map((item) => {
      if (item && typeof item === "object") {
        const title = asString(item.title);
        return title ? { title, url: asString(item.url) } : null;
      }
      const title = asString(item);
      return title ? { title, url: null } : null;
    })
    .filter(Boolean);
}
function asCloneInterview(v) {
  if (!v || typeof v !== "object") return null;
  const question = asString(v.question);
  const answer = asString(v.answer);
  return question && answer ? { question, answer } : null;
}
function req(file, name, value) {
  if (!value) throw new Error(`[${file}] 필수 필드 누락: ${name}`);
  return value;
}

function parseArticle(file, raw) {
  const { data, content } = matter(raw);
  if (data.type !== "NewsArticle") {
    throw new Error(`[${file}] type 이 NewsArticle 이 아닙니다 (type: ${String(data.type)}).`);
  }
  const input = {
    slug: req(file, "slug", asString(data.slug)),
    status: asStatus(data.status),
    headline: req(file, "headline", asString(data.headline)),
    dek: asString(data.dek),
    summary: req(file, "summary", asString(data.summary)),
    section: req(file, "section", asString(data.section)),
    tags: asStringArray(data.tags),
    keywords: asStringArray(data.keywords),
    byline: asString(data.byline) ?? "한솔닷컴 뉴스룸",
    publishedAt: req(file, "publishedAt", asString(data.publishedAt)),
    updatedAt: asString(data.updatedAt),
    coverImage: asString(data.coverImage),
    coverImageAlt: asString(data.coverImageAlt),
    body: content.trim(),
    sourcingNote: asString(data.sourcingNote),
    references: asReferences(data.references),
    cloneInterview: asCloneInterview(data.cloneInterview),
  };
  const dbIdNum = data.dbId == null ? null : Number(asString(data.dbId));
  return { input, dbId: Number.isFinite(dbIdNum) ? dbIdNum : null };
}

/** frontmatter 의 dbId 값을 surgical 하게 갱신/삽입(주석·순서·서식 보존). */
function writeBackDbId(raw, id) {
  const fm = raw.match(/^(---\r?\n)([\s\S]*?)(\r?\n---\r?\n?)/);
  if (!fm) return raw;
  const [, open, body, close] = fm;
  const nb = /^dbId:.*$/m.test(body)
    ? body.replace(/^dbId:.*$/m, `dbId: ${id}`)
    : `${body}\ndbId: ${id}`;
  return open + nb + close + raw.slice(fm[0].length);
}

async function ensureTable(sql) {
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

async function upsert(sql, a) {
  const rows = await sql.query(
    `INSERT INTO articles
       (slug, status, headline, dek, summary, section, tags, keywords, byline, body,
        sourcing_note, citations, clone_interview, cover_image, cover_image_alt, published_at, updated_at, synced_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11,$12::jsonb,$13::jsonb,$14,$15,$16,$17, now())
     ON CONFLICT (slug) DO UPDATE SET
       status = EXCLUDED.status, headline = EXCLUDED.headline, dek = EXCLUDED.dek,
       summary = EXCLUDED.summary, section = EXCLUDED.section, tags = EXCLUDED.tags,
       keywords = EXCLUDED.keywords, byline = EXCLUDED.byline, body = EXCLUDED.body,
       sourcing_note = EXCLUDED.sourcing_note, citations = EXCLUDED.citations,
       clone_interview = EXCLUDED.clone_interview,
       cover_image = EXCLUDED.cover_image, cover_image_alt = EXCLUDED.cover_image_alt,
       published_at = EXCLUDED.published_at, updated_at = EXCLUDED.updated_at, synced_at = now()
     RETURNING id::text AS id`,
    [
      a.slug, a.status, a.headline, a.dek, a.summary, a.section,
      JSON.stringify(a.tags), JSON.stringify(a.keywords), a.byline, a.body,
      a.sourcingNote, JSON.stringify(a.references),
      a.cloneInterview ? JSON.stringify(a.cloneInterview) : null,
      a.coverImage, a.coverImageAlt, a.publishedAt, a.updatedAt,
    ],
  );
  return Number(rows[0].id);
}

async function main() {
  const dir = path.resolve(process.cwd(), ARTICLES_DIR);
  let names;
  try {
    names = await readdir(dir);
  } catch {
    console.error(`기사 디렉터리를 찾을 수 없습니다: ${dir}`);
    process.exit(1);
  }
  const files = names.filter((n) => n.endsWith(".md") && !n.startsWith("_"));
  if (files.length === 0) {
    console.log("동기화할 기사가 없습니다.");
    return;
  }

  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url && !DRY_RUN) {
    console.error("DATABASE_URL/POSTGRES_URL 미설정 — 동기화할 수 없습니다.");
    process.exit(1);
  }
  const sql = url ? neon(url) : null;
  if (sql) await ensureTable(sql);

  let published = 0, drafts = 0, paired = 0;
  const errors = [];

  for (const name of files) {
    const filePath = path.join(dir, name);
    try {
      const raw = await readFile(filePath, "utf8");
      const { input, dbId } = parseArticle(name, raw);

      if (DRY_RUN || !sql) {
        console.log(`· [dry] ${input.slug} (${input.status})${dbId ? ` ↔ dbId=${dbId}` : " ↔ 미페어링"}`);
      } else {
        const id = await upsert(sql, input);
        if (dbId !== id) {
          const next = writeBackDbId(raw, id);
          if (next !== raw) {
            await writeFile(filePath, next, "utf8");
            paired += 1;
          }
        }
        console.log(`✓ ${input.slug} (${input.status}) → dbId=${id}`);
      }
      if (input.status === "published") published += 1;
      else drafts += 1;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(msg);
      console.error(`✗ ${name}: ${msg}`);
    }
  }

  console.log(
    `\n동기화 완료 — 발행 ${published} · 초안 ${drafts}` +
      (paired ? ` · dbId 역기록 ${paired}` : "") +
      (errors.length ? ` · 실패 ${errors.length}` : "") +
      (DRY_RUN || !sql ? "  (dry-run, DB 미반영)" : ""),
  );
  if (errors.length) process.exit(1);
}

main().catch((error) => {
  console.error("기사 동기화 실패");
  console.error(error);
  process.exit(1);
});
