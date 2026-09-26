#!/usr/bin/env node
/**
 * scripts/sync-blog.mjs
 *
 * Tistory 블로그(https://hsol.tistory.com)를 vault/datasources/blog/ 로 증분 동기화한다.
 *
 * 절차:
 *   1) sitemap.xml 에서 entry id 목록 수집
 *   2) 로컬 _index.json 과 비교해 신규(또는 --full 시 전체) ID 만 추출
 *   3) 각 entry HTML 을 fetch → 본문 추출 → markdown 변환
 *   4) `<category-folder>/<id>_<slug>.md` 형식으로 저장
 *   5) _index.json / README.md 의 syncedAt / totalPosts / failedPosts 갱신
 *
 * 사용:
 *   npm run sync:blog                   # 증분 (기본)
 *   npm run sync:blog -- --full         # 전체 재동기화 (있는 파일도 덮어씀)
 *   npm run sync:blog -- --dry-run      # 변경 사항만 미리보기
 *   npm run sync:blog -- --limit 10     # 최대 10개만 처리 (테스트용)
 *
 * 환경변수: 없음 (Tistory 는 인증 불필요).
 *
 * 한계: 본문 추출은 정규식 기반이라 일부 스킨 변형에서 부정확할 수 있다.
 *       정확한 전체 백필은 README 의 fetch_blog.py 를 사용한다.
 */
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const BLOG_DIR = path.join(ROOT, "vault/datasources/blog");
const INDEX_PATH = path.join(BLOG_DIR, "_index.json");
const README_PATH = path.join(BLOG_DIR, "README.md");
const SITEMAP_URL = "https://hsol.tistory.com/sitemap.xml";
const POST_URL = (id) => `https://hsol.tistory.com/${id}`;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const CONCURRENCY = 6;

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { full: false, dryRun: false, limit: Infinity };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === "--full") opts.full = true;
    else if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--limit") opts.limit = parseInt(args[++i], 10);
  }
  return opts;
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return await res.text();
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function extractMeta(html, name) {
  const re1 = new RegExp(
    `<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']`,
    "i",
  );
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${name}["']`,
    "i",
  );
  const m = html.match(re1) || html.match(re2);
  return m ? decodeEntities(m[1]) : "";
}

function extractTitle(html) {
  const og = extractMeta(html, "og:title");
  if (og) return og;
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decodeEntities(m[1].trim()) : "";
}

function extractCategory(html) {
  const section = extractMeta(html, "article:section");
  if (section) return section;
  const m = html.match(/<a[^>]+href=["'][^"']*\/category\/([^"']+)["'][^>]*>([\s\S]*?)<\/a>/);
  if (m) {
    const text = decodeEntities(m[2].replace(/<[^>]+>/g, "")).trim();
    if (text) return text;
    return decodeURIComponent(m[1]).replace(/\+/g, " ");
  }
  return "uncategorized";
}

function extractPublishedAt(html) {
  const og = extractMeta(html, "article:published_time");
  if (og) return og;
  const m = html.match(/<time[^>]+datetime=["']([^"']+)["']/i);
  return m ? m[1] : "";
}

function extractDescription(html) {
  return extractMeta(html, "og:description") || extractMeta(html, "description");
}

function extractImage(html) {
  return extractMeta(html, "og:image");
}

function extractArticleHtml(html) {
  const article = html.match(/<article[\s\S]*?<\/article>/i);
  if (article) return article[0];
  const entry = html.match(/<div[^>]+class=["'][^"']*(?:entry-content|article-view|tt_article_useless_p_margin)[^"']*["'][\s\S]*?<\/div>\s*(?=<\/?(?:div|section|article|footer|aside|nav))/i);
  if (entry) return entry[0];
  return "";
}

function htmlToMarkdown(html) {
  if (!html) return "";
  let s = html;
  s = s.replace(/<script[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, "");
  s = s.replace(/<figure[^>]*>/gi, "\n").replace(/<\/figure>/gi, "\n");
  s = s.replace(
    /<figcaption[^>]*>([\s\S]*?)<\/figcaption>/gi,
    (_, c) => `\n*${c.replace(/<[^>]+>/g, "").trim()}*\n`,
  );
  s = s.replace(
    /<img[^>]+src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][^>]*\/?\s*>/gi,
    (_, src, alt) => `![${alt}](${src})`,
  );
  s = s.replace(/<img[^>]+src=["']([^"']+)["'][^>]*\/?\s*>/gi, (_, src) => `![](${src})`);
  for (let h = 1; h <= 6; h += 1) {
    const re = new RegExp(`<h${h}[^>]*>([\\s\\S]*?)<\\/h${h}>`, "gi");
    s = s.replace(re, (_, c) => `\n${"#".repeat(h)} ${c.replace(/<[^>]+>/g, "").trim()}\n`);
  }
  s = s.replace(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, text) => {
    const t = text.replace(/<[^>]+>/g, "").trim();
    return t ? `[${t}](${href})` : `<${href}>`;
  });
  s = s.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, "**$2**");
  s = s.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, "*$2*");
  s = s.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`");
  s = s.replace(
    /<pre[^>]*>([\s\S]*?)<\/pre>/gi,
    (_, c) => `\n\`\`\`\n${c.replace(/<[^>]+>/g, "")}\n\`\`\`\n`,
  );
  s = s.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, c) =>
    c
      .replace(/<[^>]+>/g, "")
      .split("\n")
      .map((l) => `> ${l}`)
      .join("\n"),
  );
  s = s.replace(/<br\s*\/?\s*>/gi, "\n");
  s = s.replace(/<p[^>]*>/gi, "\n").replace(/<\/p>/gi, "\n");
  s = s.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, c) => `\n- ${c.replace(/<[^>]+>/g, "").trim()}`);
  s = s.replace(/<\/?(ul|ol)[^>]*>/gi, "\n");
  s = s.replace(/<\/?[^>]+>/g, "");
  s = decodeEntities(s);
  s = s.replace(/\n{3,}/g, "\n\n").trim();
  return s;
}

function categoryToFolder(cat) {
  return cat
    .replace(/[\\/:]+/g, "_-")
    .replace(/\s+/g, "_")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 80) || "uncategorized";
}

function slugify(title, max = 80) {
  return (
    title
      .replace(/\s+/g, "-")
      .replace(/[\\/:*?"<>|]+/g, "")
      .replace(/[​-‍﻿]/g, "")
      .slice(0, max) || "post"
  );
}

function buildFrontmatter({ id, title, publishedAt, category, url, description, image }) {
  const esc = (v) => String(v ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ");
  const lines = [
    "---",
    "type: BlogPost",
    `id: ${id}`,
    `title: "${esc(title)}"`,
    `publishedAt: ${publishedAt || ""}`,
    `category: "${esc(category)}"`,
    `url: ${url}`,
    `description: "${esc(description)}"`,
    image ? `image: ${image}` : "",
    "tags: [blog, tistory]",
    "links:",
    `  createdBy: "[[임한솔]]"`,
    "---",
  ].filter(Boolean);
  return lines.join("\n");
}

async function fetchSitemap() {
  const xml = await fetchText(SITEMAP_URL);
  const ids = [...xml.matchAll(/<loc>https?:\/\/hsol\.tistory\.com\/(\d+)<\/loc>/g)].map((m) =>
    parseInt(m[1], 10),
  );
  return [...new Set(ids)].sort((a, b) => b - a);
}

async function fetchPost(id) {
  const url = POST_URL(id);
  let html;
  try {
    html = await fetchText(url);
  } catch (e) {
    return { id, ok: false, error: e.message };
  }
  return {
    id,
    ok: true,
    url,
    title: extractTitle(html),
    category: extractCategory(html),
    publishedAt: extractPublishedAt(html),
    description: extractDescription(html),
    image: extractImage(html),
    body: htmlToMarkdown(extractArticleHtml(html)),
  };
}

async function pMap(items, fn, concurrency) {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (cursor < items.length) {
        const i = cursor++;
        try {
          results[i] = await fn(items[i], i);
        } catch (e) {
          results[i] = { error: e.message, item: items[i] };
        }
      }
    }),
  );
  return results;
}

async function readJSON(p, fallback) {
  try {
    return JSON.parse(await readFile(p, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJSON(p, data) {
  await writeFile(p, `${JSON.stringify(data, null, 2)}\n`);
}

async function findExistingFile(folder, id) {
  try {
    const files = await readdir(folder);
    const prefix = `${id}_`;
    return files.find((f) => f.startsWith(prefix)) || null;
  } catch {
    return null;
  }
}

async function main() {
  const opts = parseArgs();
  console.log(`[sync-blog] 시작 (full=${opts.full}, dryRun=${opts.dryRun}, limit=${opts.limit})`);

  console.log(`[sync-blog] sitemap fetch: ${SITEMAP_URL}`);
  const remoteIds = await fetchSitemap();
  console.log(`[sync-blog] sitemap entry: ${remoteIds.length}개`);

  const localIndex = await readJSON(INDEX_PATH, {});
  const localIds = new Set(Object.keys(localIndex).map(Number));

  const candidates = opts.full ? remoteIds : remoteIds.filter((id) => !localIds.has(id));
  const targets = candidates.slice(0, opts.limit);

  console.log(
    `[sync-blog] 처리 대상: ${targets.length}개 (sitemap=${remoteIds.length}, local=${localIds.size})`,
  );

  if (targets.length === 0) {
    console.log("[sync-blog] 신규/변경 글이 없습니다.");
    return;
  }

  if (opts.dryRun) {
    console.log("[sync-blog] [dry-run] 다음 ID 가 새로 처리될 예정입니다:");
    console.log(`  ${targets.slice(0, 50).join(", ")}${targets.length > 50 ? ", …" : ""}`);
    return;
  }

  const failed = [];
  let added = 0;

  await pMap(
    targets,
    async (id) => {
      const post = await fetchPost(id);
      if (!post.ok || !post.title) {
        console.warn(`[sync-blog] FAIL ${id}: ${post.error || "본문/제목 추출 실패"}`);
        failed.push(id);
        return;
      }
      const folder = path.join(BLOG_DIR, categoryToFolder(post.category));
      await mkdir(folder, { recursive: true });

      // 이미 파일이 있으면 카테고리/슬러그가 바뀌었어도 동일 ID 파일을 찾아서 덮어씀
      const existing = await findExistingFile(folder, id);
      const slug = slugify(post.title);
      const fname = existing || `${id}_${slug}.md`;
      const fpath = path.join(folder, fname);

      const fm = buildFrontmatter({
        id,
        title: post.title,
        publishedAt: post.publishedAt,
        category: post.category,
        url: post.url,
        description: post.description,
        image: post.image,
      });
      const md = `${fm}\n\n# ${post.title}\n\n${post.body}\n`;
      await writeFile(fpath, md);

      localIndex[id] = {
        title: post.title,
        publishedAt: post.publishedAt,
        category: post.category,
        url: post.url,
      };
      added += 1;
      console.log(
        `[sync-blog] +${id} ${post.title.slice(0, 50)} (${post.category})`,
      );
    },
    CONCURRENCY,
  );

  await writeJSON(INDEX_PATH, localIndex);

  // README frontmatter 업데이트
  const today = new Date().toISOString().slice(0, 10);
  const total = Object.keys(localIndex).length;
  try {
    let readme = await readFile(README_PATH, "utf8");
    readme = readme.replace(/^syncedAt:\s*.*$/m, `syncedAt: ${today}`);
    readme = readme.replace(/^totalPosts:\s*.*$/m, `totalPosts: ${total}`);
    if (failed.length > 0) {
      readme = readme.replace(/^failedPosts:\s*\[[^\]]*\]\s*$/m, `failedPosts: [${failed.join(", ")}]`);
    }
    await writeFile(README_PATH, readme);
  } catch (e) {
    console.warn(`[sync-blog] README 업데이트 실패: ${e.message}`);
  }

  console.log(`[sync-blog] 완료: 신규 ${added}건, 실패 ${failed.length}건, 총 ${total}건`);
  if (failed.length > 0) {
    console.log(`[sync-blog] 실패 ID: ${failed.join(", ")}`);
  }
}

main().catch((e) => {
  console.error("[sync-blog] 에러:", e);
  process.exit(1);
});
