/**
 * Ask Hansol 답변용: API 평문 정규화 + 클라이언트에서 클릭 가능한 <a>로 쪼개기.
 */

/** 흔한 파일 확장자·짧은 TLD 오탐 줄이기 */
const BARE_TLD_DENY = new Set([
  "ts",
  "tsx",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "json",
  "md",
  "html",
  "htm",
  "css",
  "map",
  "svg",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "ico",
  "pdf",
  "zip",
  "sh",
  "txt",
  "yml",
  "yaml",
  "xml",
  "toml",
  "lock",
  "log",
  "env",
  "vue",
  "svelte",
  "py",
  "rb",
  "go",
  "rs",
  "java",
  "kt",
  "swift",
  "c",
  "h",
  "cc",
  "cpp",
  "cs",
  "php",
  "pl",
  "r",
  "sql",
  "csv",
  "tsv",
  "git",
  "exe",
  "dmg",
  "app",
]);

function hostPartOfUrlish(raw: string): string {
  return raw.split("/")[0]!.split(":")[0]!.toLowerCase();
}

function isPlausibleBareHost(hostPart: string): boolean {
  const segments = hostPart.split(".").filter(Boolean);
  if (segments.length < 2) return false;
  const tld = segments[segments.length - 1]!;
  const sld = segments[segments.length - 2]!;
  if (tld.length < 2 || BARE_TLD_DENY.has(tld)) return false;
  if (sld.length < 2) return false;
  return true;
}

/** 마크다운 괄호로 감싼 URL 등에서 바깥쪽 `)`만 제거 */
export function balanceClosingParensFromUrl(raw: string): string {
  let u = raw;
  while (u.endsWith(")")) {
    const opens = (u.match(/\(/g) ?? []).length;
    const closes = (u.match(/\)/g) ?? []).length;
    if (closes > opens) u = u.slice(0, -1);
    else break;
  }
  return u;
}

export function trimUrlEndPunctuation(href: string): string {
  return href.replace(/[.,;:!?]+$/g, "");
}

export type AskAnswerLinkPart = { kind: "text" | "link"; value: string };

function prevCharOkForBareUrl(s: string, i: number): boolean {
  if (i === 0) return true;
  const c = s[i - 1]!;
  return !/[A-Za-z0-9]/.test(c);
}

function consumeHttpUrl(s: string, i: number): { raw: string; end: number } | null {
  if (!s.startsWith("http://", i) && !s.startsWith("https://", i)) return null;
  const m = s.slice(i).match(/^https?:\/\/[^\s<>"']+/i);
  if (!m) return null;
  return { raw: m[0], end: i + m[0].length };
}

function consumeWwwUrl(s: string, i: number): { raw: string; end: number } | null {
  if (!s.startsWith("www.", i) || !prevCharOkForBareUrl(s, i)) return null;
  const m = s.slice(i).match(/^www\.[^\s<>"']+/i);
  if (!m) return null;
  return { raw: m[0], end: i + m[0].length };
}

function consumeMailtoUrl(s: string, i: number): { raw: string; end: number } | null {
  if (!s.startsWith("mailto:", i) || !prevCharOkForBareUrl(s, i)) return null;
  const m = s.slice(i).match(/^mailto:[^\s<>"']+/i);
  if (!m) return null;
  return { raw: m[0], end: i + m[0].length };
}

/** `calendly.com/…` 등 스킴 없는 호스트(이메일 `@` 뒤·파일 확장자 오탐 제외) */
function consumeBareHostnameUrl(s: string, i: number): { raw: string; end: number } | null {
  if (!prevCharOkForBareUrl(s, i)) return null;
  if (i > 0 && s[i - 1] === "@") return null;
  const rest = s.slice(i);
  if (/^https?:\/\//i.test(rest) || /^www\./i.test(rest) || /^mailto:/i.test(rest)) return null;
  const m = rest.match(
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+(?::[0-9]{1,5})?(?:\/[^\s<>"']*)?/i,
  );
  if (!m) return null;
  const raw = m[0];
  if (!isPlausibleBareHost(hostPartOfUrlish(raw))) return null;
  return { raw, end: i + raw.length };
}

/** `href`는 클릭용(스킴 보정), `raw`는 원문에서 잘린 토큰 길이 계산용 */
function toClickableHref(raw: string): string {
  const body = trimUrlEndPunctuation(balanceClosingParensFromUrl(raw));
  if (!body) return "";
  if (/^mailto:/i.test(body)) return body;
  if (/^https?:\/\//i.test(body)) return body;
  if (/^www\./i.test(body)) return `https://${body}`;
  return `https://${body}`;
}

/**
 * `https?://`, `www.…`, `mailto:…`, 스킴 없는 `호스트.도메인/…`(예: calendly.com/…) 링크 분리.
 */
export function splitTextForAskHansolLinks(input: string): AskAnswerLinkPart[] {
  const parts: AskAnswerLinkPart[] = [];
  let last = 0;
  let i = 0;
  while (i < input.length) {
    const http = consumeHttpUrl(input, i);
    const www = http ? null : consumeWwwUrl(input, i);
    const mail = http || www ? null : consumeMailtoUrl(input, i);
    const bare = http || www || mail ? null : consumeBareHostnameUrl(input, i);
    const hit = http ?? www ?? mail ?? bare;
    if (!hit) {
      i += 1;
      continue;
    }
    if (i > last) parts.push({ kind: "text", value: input.slice(last, i) });
    const raw = hit.raw;
    const href = toClickableHref(raw);
    const body = trimUrlEndPunctuation(balanceClosingParensFromUrl(raw));
    if (!href) {
      parts.push({ kind: "text", value: raw });
    } else {
      parts.push({ kind: "link", value: href });
      const tail = raw.slice(body.length);
      if (tail) parts.push({ kind: "text", value: tail });
    }
    last = hit.end;
    i = hit.end;
  }
  if (last < input.length) parts.push({ kind: "text", value: input.slice(last) });
  return parts;
}

function expandBareMarkdownAngle(text: string): string {
  let s = text;
  s = s.replace(/<(([a-z0-9][-a-z0-9]*\.)+[a-z]{2,}(?::[0-9]+)?(?:\/[^>\s]*)?)>/gi, (_, u: string) => {
    if (/^https?:|^www\.|^mailto:/i.test(u)) return `<${u}>`;
    const h = hostPartOfUrlish(u);
    return isPlausibleBareHost(h) ? `https://${u}` : `<${u}>`;
  });
  s = s.replace(
    /\[([^\]]+)\]\((([a-z0-9][-a-z0-9]*\.)+[a-z]{2,}(?::[0-9]+)?(?:\/[^\)\s]*)?)\)/gi,
    (full, label: string, u: string) => {
      if (/^https?:|^www\.|^mailto:/i.test(u)) return full;
      return isPlausibleBareHost(hostPartOfUrlish(u)) ? `${label} (https://${u})` : full;
    },
  );
  return s;
}

/**
 * AI가 흔히 쓰는 특수문자를 일반 문장부호로 치환한다(엠/엔대시·말줄임표·불릿·곡선따옴표).
 * 링크는 위에서 이미 분리하므로 URL에는 영향이 없다(대시·따옴표는 URL에 안 쓰임).
 */
function stripAiTypography(text: string): string {
  return text
    .replace(/[—–―]/g, "-") // em/en/horizontal dash → 하이픈
    .replace(/…/g, "...") // 말줄임표 문자 → 마침표 3개
    .replace(/[“”]/g, '"') // 곡선 큰따옴표 → 곧은 따옴표
    .replace(/[‘’]/g, "'") // 곡선 작은따옴표 → 곧은 따옴표
    .replace(/^[ \t]*[•·]\s+/gm, "- "); // 줄머리 불릿(•·) → 마크다운 "- "
}

/** API 응답 후처리: 마크다운 서식은 유지하고, 링크만 클릭 가능 형태로 정규화 */
export function normalizeAskAnswerPlainText(text: string): string {
  let s = expandBareMarkdownAngle(text);
  s = stripAiTypography(s)
    // Autolink 문법의 <www...>를 <https://www...>로 보정
    .replace(/<(www\.[^>\s]+)>/gi, "<https://$1>")
    // 마크다운 링크의 www.는 명시적 스킴으로 보정
    .replace(/\[([^\]]+)\]\((www\.[^)\s]+)\)/gi, "[$1](https://$2)")
    // 모델이 넣는 이스케이프(\*\*, \_, \`)는 렌더 전 복원
    .replace(/\\([*_`~[\]()])/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return s;
}
