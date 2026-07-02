import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { upsertArticle } from "../src/lib/db/articles";
import type {
  ArticleInput,
  ArticleReference,
  ArticleStatus,
  CloneInterview,
} from "../src/types/article";

/**
 * 뉴스룸 기사 동기화 — vault(원본) → Neon `articles`(미러), 단방향.
 *
 * - 원본: `hsol-info-blob/vault/objects/news-articles/<slug>.md` (frontmatter `type: NewsArticle`)
 * - 최초 INSERT 후 DB PK 를 해당 vault 파일 frontmatter `dbId` 에 surgical 역기록(페어링).
 * - site-data.json/blob 자동생성과 무관한 **전용·수동** 작업. postbuild/refresh 에 끼우지 않는다.
 *
 * 실행: `npm run articles:sync`  (env: DATABASE_URL 또는 POSTGRES_URL)
 *       `--dry` 옵션이면 DB 쓰기·역기록 없이 파싱/검증만.
 */

const ARTICLES_DIR =
  process.env.VAULT_ARTICLES_DIR ?? "hsol-info-blob/vault/objects/news-articles";

const DRY_RUN = process.argv.includes("--dry");

function asString(v: unknown): string | null {
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number") return String(v);
  if (v instanceof Date) return v.toISOString();
  return null;
}

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => asString(x)).filter((x): x is string => Boolean(x));
  return [];
}

function asStatus(v: unknown): ArticleStatus {
  return v === "published" ? "published" : "draft";
}

/** frontmatter `references` (list of {title, url}) 정규화. */
function asReferences(v: unknown): ArticleReference[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((item): ArticleReference | null => {
      if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        const title = asString(o.title);
        if (!title) return null;
        return { title, url: asString(o.url) };
      }
      // 문자열 하나만 적은 경우 제목으로 취급(링크 없음).
      const title = asString(item);
      return title ? { title, url: null } : null;
    })
    .filter((r): r is ArticleReference => r !== null);
}

/** frontmatter `cloneInterview: {question, answer}` 정규화. */
function asCloneInterview(v: unknown): CloneInterview | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const question = asString(o.question);
  const answer = asString(o.answer);
  return question && answer ? { question, answer } : null;
}

type Parsed = {
  file: string;
  raw: string;
  data: Record<string, unknown>;
  input: ArticleInput;
  dbId: number | null;
};

function requireField(file: string, name: string, value: string | null): string {
  if (!value) throw new Error(`[${file}] 필수 필드 누락: ${name}`);
  return value;
}

function parseArticle(file: string, raw: string): Parsed {
  const { data, content } = matter(raw);
  const d = data as Record<string, unknown>;
  if (d.type !== "NewsArticle") {
    throw new Error(`[${file}] type 이 NewsArticle 이 아닙니다 (type: ${String(d.type)}).`);
  }
  const slug = requireField(file, "slug", asString(d.slug));
  const input: ArticleInput = {
    slug,
    status: asStatus(d.status),
    headline: requireField(file, "headline", asString(d.headline)),
    dek: asString(d.dek),
    summary: requireField(file, "summary", asString(d.summary)),
    section: requireField(file, "section", asString(d.section)),
    tags: asStringArray(d.tags),
    keywords: asStringArray(d.keywords),
    byline: asString(d.byline) ?? "한솔닷컴 뉴스룸",
    publishedAt: requireField(file, "publishedAt", asString(d.publishedAt)),
    updatedAt: asString(d.updatedAt),
    coverImage: asString(d.coverImage),
    coverImageAlt: asString(d.coverImageAlt),
    body: content.trim(),
    sourcingNote: asString(d.sourcingNote),
    references: asReferences(d.references),
    cloneInterview: asCloneInterview(d.cloneInterview),
  };
  const dbIdRaw = d.dbId;
  const dbId =
    typeof dbIdRaw === "number" ? dbIdRaw : dbIdRaw ? Number(asString(dbIdRaw)) : null;
  return { file, raw, data: d, input, dbId: Number.isFinite(dbId) ? (dbId as number) : null };
}

/** frontmatter 안의 dbId 값을 surgical 하게 갱신/삽입(주석·순서·서식 보존). */
function writeBackDbId(raw: string, id: number): string {
  const fmMatch = raw.match(/^(---\r?\n)([\s\S]*?)(\r?\n---\r?\n?)/);
  if (!fmMatch) return raw; // frontmatter 없음 — 건드리지 않음
  const [, open, body, close] = fmMatch;
  let newBody: string;
  if (/^dbId:.*$/m.test(body)) {
    newBody = body.replace(/^dbId:.*$/m, `dbId: ${id}`);
  } else {
    newBody = `${body}\ndbId: ${id}`;
  }
  return open + newBody + close + raw.slice(fmMatch[0].length);
}

async function main() {
  const dir = path.resolve(process.cwd(), ARTICLES_DIR);
  let names: string[];
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

  let published = 0;
  let drafts = 0;
  let paired = 0;
  const errors: string[] = [];

  for (const name of files) {
    const filePath = path.join(dir, name);
    try {
      const raw = await readFile(filePath, "utf8");
      const parsed = parseArticle(name, raw);

      if (DRY_RUN) {
        console.log(
          `· [dry] ${parsed.input.slug} (${parsed.input.status})` +
            (parsed.dbId ? ` ↔ dbId=${parsed.dbId}` : " ↔ 미페어링"),
        );
      } else {
        const id = await upsertArticle(parsed.input);
        if (parsed.dbId !== id) {
          const next = writeBackDbId(raw, id);
          if (next !== raw) {
            await writeFile(filePath, next, "utf8");
            paired += 1;
          }
        }
        console.log(`✓ ${parsed.input.slug} (${parsed.input.status}) → dbId=${id}`);
      }

      if (parsed.input.status === "published") published += 1;
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
      (DRY_RUN ? "  (dry-run, DB 미반영)" : ""),
  );
  if (errors.length) process.exit(1);
}

main().catch((error) => {
  console.error("기사 동기화 실패");
  console.error(error);
  process.exit(1);
});
