#!/usr/bin/env node
/**
 * scripts/sync-medium.mjs
 *
 * Medium 글을 vault/datasources/medium/ 로 증분 동기화한다. RSS 피드의
 * <content:encoded> 가 본문 HTML 을 그대로 포함하므로 추가 fetch 없이 변환만
 * 수행한다 — TLS fingerprint 봇 차단을 우회할 필요가 없는 이유다.
 *
 * 한계:
 *   - RSS 피드는 publication 별 최신 ~10개만 노출한다. 따라서 이 스크립트는
 *     **새 글 알림용 증분 sync** 로만 적합하고, 전체 백필이 필요하면 README 의
 *     fetch_medium.py 를 사용한다.
 *   - 새로운 publication 에 글을 쓰면 FEEDS 배열에 URL/이름을 추가해야 한다.
 *
 * 사용:
 *   npm run sync:medium                # 증분
 *   npm run sync:medium -- --dry-run   # 미리보기
 *   npm run sync:medium -- --limit 5   # 최대 N개만
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const MEDIUM_DIR = path.join(ROOT, "vault/datasources/medium");
const INDEX_PATH = path.join(MEDIUM_DIR, "_index.json");
const README_PATH = path.join(MEDIUM_DIR, "README.md");
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const FEEDS = [
  { url: "https://medium.com/feed/@hsol", publication: "personal" },
  { url: "https://medium.com/feed/proofer-blog", publication: "proofer-blog" },
];

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { dryRun: false, limit: Infinity };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--limit") opts.limit = parseInt(args[++i], 10);
  }
  return opts;
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/rss+xml, application/xml, text/xml, */*",
      "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
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

function unwrapCDATA(s) {
  const m = s.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  return m ? m[1] : decodeEntities(s);
}

function getTag(item, tag) {
  // namespaced tag 도 처리 (atom:updated, content:encoded 등)
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`);
  const m = item.match(re);
  return m ? unwrapCDATA(m[1]).trim() : "";
}

function getAllTags(item, tag) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, "g");
  return [...item.matchAll(re)].map((m) => unwrapCDATA(m[1]).trim()).filter(Boolean);
}

function extractMediumId(url) {
  if (!url) return null;
  // Medium 글 URL 끝의 -<8~16자 hex> 패턴
  const m = url.match(/-([a-f0-9]{8,16})(?:[?\/#]|$)/);
  return m ? m[1] : null;
}

function parseRss(xml, publication) {
  const items = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRe.exec(xml)) !== null) {
    const it = match[1];
    const link = getTag(it, "link");
    const id = extractMediumId(link);
    if (!id) continue;
    const title = getTag(it, "title");
    const pubDate = getTag(it, "pubDate");
    const updated = getTag(it, "atom:updated");
    const content = getTag(it, "content:encoded");
    const description = getTag(it, "description");
    const categories = getAllTags(it, "category");
    let publishedAt = "";
    const rawDate = updated || pubDate;
    if (rawDate) {
      const d = new Date(rawDate);
      if (!Number.isNaN(d.getTime())) publishedAt = d.toISOString();
    }
    items.push({
      id,
      link,
      title,
      publishedAt,
      contentHtml: content,
      description: description.replace(/<[^>]+>/g, "").trim().slice(0, 500),
      keywords: categories.join(", "),
      publication,
    });
  }
  return items;
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

function extractFirstImage(html) {
  if (!html) return "";
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : "";
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

function buildFrontmatter({ id, title, publishedAt, publication, url, keywords, description, image }) {
  const esc = (v) => String(v ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ");
  const lines = [
    "---",
    "type: MediumPost",
    `id: ${id}`,
    `title: "${esc(title)}"`,
    `publishedAt: ${publishedAt || ""}`,
    `publication: ${publication}`,
    `url: ${url}`,
    `keywords: "${esc(keywords)}"`,
    `description: "${esc(description)}"`,
    image ? `image: ${image}` : "",
    "tags: [blog, medium]",
    "links:",
    `  createdBy: "[[임한솔]]"`,
    "---",
  ].filter(Boolean);
  return lines.join("\n");
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

async function main() {
  const opts = parseArgs();
  console.log(`[sync-medium] 시작 (dryRun=${opts.dryRun}, limit=${opts.limit})`);

  const localIndex = await readJSON(INDEX_PATH, {});
  const localIds = new Set(Object.keys(localIndex));
  console.log(`[sync-medium] 로컬 인덱스: ${localIds.size}개`);

  const allItems = [];
  for (const feed of FEEDS) {
    try {
      console.log(`[sync-medium] feed fetch: ${feed.url}`);
      const xml = await fetchText(feed.url);
      const items = parseRss(xml, feed.publication);
      console.log(`[sync-medium]   → ${items.length}개 아이템 (${feed.publication})`);
      allItems.push(...items);
    } catch (e) {
      console.warn(`[sync-medium] feed 실패 (${feed.url}): ${e.message}`);
    }
  }

  // 중복 ID 제거 (동일 글이 두 publication feed 에 함께 나오는 경우 방지)
  const seen = new Set();
  const dedup = [];
  for (const it of allItems) {
    if (seen.has(it.id)) continue;
    seen.add(it.id);
    dedup.push(it);
  }

  const toSync = dedup.filter((it) => !localIds.has(it.id)).slice(0, opts.limit);
  console.log(`[sync-medium] 신규: ${toSync.length}개`);

  if (toSync.length === 0) {
    console.log("[sync-medium] 새 글이 없습니다.");
    return;
  }

  if (opts.dryRun) {
    for (const it of toSync) {
      console.log(`[sync-medium] [dry-run] +${it.id} ${it.title.slice(0, 60)} (${it.publication})`);
    }
    return;
  }

  let added = 0;
  for (const it of toSync) {
    const folder = path.join(MEDIUM_DIR, it.publication);
    await mkdir(folder, { recursive: true });
    const slug = slugify(it.title || `post-${it.id}`);
    const fname = `${it.id}_${slug}.md`;
    const fpath = path.join(folder, fname);
    const image = extractFirstImage(it.contentHtml);
    const body = htmlToMarkdown(it.contentHtml);
    const fm = buildFrontmatter({
      id: it.id,
      title: it.title,
      publishedAt: it.publishedAt,
      publication: it.publication,
      url: it.link,
      keywords: it.keywords,
      description: it.description,
      image,
    });
    const md = `${fm}\n\n# ${it.title}\n\n${body}\n`;
    await writeFile(fpath, md);
    localIndex[it.id] = {
      title: it.title,
      publishedAt: it.publishedAt,
      publication: it.publication,
      url: it.link,
      keywords: it.keywords,
    };
    added += 1;
    console.log(`[sync-medium] +${it.id} ${it.title.slice(0, 60)} (${it.publication})`);
  }

  await writeJSON(INDEX_PATH, localIndex);

  const today = new Date().toISOString().slice(0, 10);
  const total = Object.keys(localIndex).length;
  try {
    let readme = await readFile(README_PATH, "utf8");
    readme = readme.replace(/^syncedAt:\s*.*$/m, `syncedAt: ${today}`);
    readme = readme.replace(/^totalPosts:\s*.*$/m, `totalPosts: ${total}`);
    await writeFile(README_PATH, readme);
  } catch (e) {
    console.warn(`[sync-medium] README 업데이트 실패: ${e.message}`);
  }

  console.log(`[sync-medium] 완료: 신규 ${added}건, 총 ${total}건`);
}

main().catch((e) => {
  console.error("[sync-medium] 에러:", e);
  process.exit(1);
});
