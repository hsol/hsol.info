import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import type {
  ArticleReference,
  ArticleRow,
  ArticleStatus,
  CloneInterview,
} from "@/types/article";

/**
 * 로컬 프리뷰 폴백 — DB(Neon) 미구성 시 vault 기사 마크다운을 직접 읽어 렌더한다.
 * (site-data 가 blob 없을 때 로컬 vault 를 읽는 것과 같은 dev 편의 패턴.)
 *
 * 프로덕션은 DATABASE_URL 이 있어 이 경로를 타지 않는다. `npm run dev` 처럼 DB 없이
 * 돌릴 때만 동작하며, sync 없이도 `/news` 를 미리 볼 수 있게 한다.
 */

const ARTICLES_DIR =
  process.env.VAULT_ARTICLES_DIR ?? "hsol-info-blob/vault/objects/news-articles";

function asString(v: unknown): string | null {
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number") return String(v);
  if (v instanceof Date) return v.toISOString();
  return null;
}
function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(asString).filter((x): x is string => Boolean(x));
  return [];
}
function asStatus(v: unknown): ArticleStatus {
  return v === "published" ? "published" : "draft";
}
function asReferences(v: unknown): ArticleReference[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((item): ArticleReference | null => {
      if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        const title = asString(o.title);
        return title ? { title, url: asString(o.url) } : null;
      }
      const title = asString(item);
      return title ? { title, url: null } : null;
    })
    .filter((r): r is ArticleReference => r !== null);
}
function asCloneInterview(v: unknown): CloneInterview | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const question = asString(o.question);
  const answer = asString(o.answer);
  return question && answer ? { question, answer } : null;
}

function toIso(v: string | null): string {
  if (!v) return new Date(0).toISOString();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? new Date(0).toISOString() : d.toISOString();
}

/** vault 디렉터리의 모든 Article 을 ArticleRow[] 로 파싱(프리뷰용, 멱등). */
export async function readArticlesFromVault(): Promise<ArticleRow[]> {
  const dir = path.resolve(process.cwd(), ARTICLES_DIR);
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }
  const files = names.filter((n) => n.endsWith(".md") && !n.startsWith("_"));
  const rows: ArticleRow[] = [];
  for (let i = 0; i < files.length; i += 1) {
    try {
      const raw = await readFile(path.join(dir, files[i]), "utf8");
      const { data, content } = matter(raw);
      const d = data as Record<string, unknown>;
      if (d.type !== "NewsArticle") continue;
      const slug = asString(d.slug);
      const headline = asString(d.headline);
      const summary = asString(d.summary);
      const section = asString(d.section);
      const publishedAt = asString(d.publishedAt);
      if (!slug || !headline || !summary || !section || !publishedAt) continue;
      const dbId = d.dbId != null ? Number(asString(d.dbId)) : NaN;
      rows.push({
        id: Number.isFinite(dbId) ? dbId : i + 1,
        slug,
        status: asStatus(d.status),
        headline,
        dek: asString(d.dek),
        summary,
        section,
        tags: asStringArray(d.tags),
        keywords: asStringArray(d.keywords),
        byline: asString(d.byline) ?? "한솔닷컴 뉴스룸",
        body: content.trim(),
        sourcingNote: asString(d.sourcingNote),
        references: asReferences(d.references),
        cloneInterview: asCloneInterview(d.cloneInterview),
        coverImage: asString(d.coverImage),
        coverImageAlt: asString(d.coverImageAlt),
        publishedAt: toIso(publishedAt),
        updatedAt: asString(d.updatedAt) ? toIso(asString(d.updatedAt)) : null,
        createdAt: toIso(publishedAt),
        syncedAt: new Date().toISOString(),
      });
    } catch {
      // 개별 파일 파싱 실패는 건너뛴다(프리뷰).
    }
  }
  rows.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return rows;
}
