/**
 * 개인 OneDrive 콘텐츠 배치(레이아웃) 정본. 사이트 런타임, CI, 감시 스크립트가 모두 이 표 하나로 경로를 푼다.
 * (src 아래에 둔 이유: Vercel 업로드가 ops/ 를 제외한다. ops 스크립트는 여기서 import 한다.)
 *
 * - legacy: 2026-11 이전 배치. 모든 콘텐츠가 OneDrive `hsol-info-blob/` 아래에 있고 vault 는 `hsol-info-blob/vault/`.
 * - ws:     OneDrive 루트가 context-protocol 워크스페이스다. 폴더는 국문 개념 폴더(인물/, 조직/, 프로젝트/ ...).
 *
 * 코드 안의 경로는 계속 legacy 상대경로("vault/objects/people/임한솔.md", "assets/public/..")로 쓴다(논리 경로).
 * toWs() 가 논리 경로를 ws 실제 경로로, toLegacy() 가 ws 실제 경로를 논리 경로로 바꾼다.
 * 이동 매핑표 정본: OneDrive `프로젝트/OneDrive-WS-마이그레이션/이동-매핑표.md`.
 *
 * 레이아웃 선택: 환경변수 ONEDRIVE_LAYOUT = legacy | ws | dual.
 *   dual 은 파일 하나씩 ws 를 먼저 보고 없으면 legacy 를 본다(이동 중에도 사이트가 끊기지 않게). 사이트 런타임 기본값.
 *   폴더를 통째로 다루는 CI 와 감시 스크립트는 legacy 또는 ws 중 하나를 명시한다(기본 legacy).
 */

export const LEGACY_ROOT = (process.env.ONEDRIVE_ROOT || "hsol-info-blob").replace(/^\/+|\/+$/g, "");

/** 프로젝트 폴더로 승격되면서 인덱스가 `프로젝트/<이름>/<이름>.md` 로 가는 프로젝트. legacy 에서는 평평한 `<이름>.md`. */
const PROMOTED_PROJECTS = ["hsol-info", "AI-Native-취재노트", "온톨로지-빌더"];

/**
 * 원본 자료를 함께 두려고 폴더로 승격한 객체(2026-11 기존 폴더 재정리). 인덱스 노트는 예전 평평한 논리 경로 그대로 읽는다.
 * 원페이저 근거 글롭이 `objects/<타입>/*.md` 한 단계만 보기 때문에, 경로가 바뀌면 경력 핵심 노트가 근거에서 빠진다.
 * 폴더 안 나머지(원본, 수업 노트 md 등)는 사이트 콘텐츠가 아니다(NON_VAULT_PREFIXES).
 */
const PROMOTED_WITH_ORIGINALS = [
  ["organizations", "조직", ["RIDI", "Toss", "PPB-Studios", "라이트형제", "타르트", "건국대학교", "앤틀러-코리아", "다윗", "제로원리퍼블릭", "넥슨"]],
  ["projects", "프로젝트", ["Tagit", "템플레터"]],
];

/** 파일 단위 규칙 [논리 경로, ws 경로]. 디렉터리 규칙보다 먼저, 양방향으로 쓴다. */
export const FILE_RULES = [
  ["vault/README.md", "_context-protocol/_deprecated_vault/README.md"],
  ["vault/objects/concepts/임한솔-persona.md", "memory/임한솔-persona.md"],
  ["vault/objects/concepts/임한솔-writing-style.md", "memory/임한솔-writing-style.md"],
  ["vault/objects/concepts/임한솔-self-presentation-preferences.md", "memory/임한솔-self-presentation-preferences.md"],
  ["vault/objects/concepts/뉴스룸-기자.md", "뉴스룸/뉴스룸-기자.md"],
  ...PROMOTED_PROJECTS.map((p) => [`vault/objects/projects/${p}.md`, `프로젝트/${p}/${p}.md`]),
  ...PROMOTED_WITH_ORIGINALS.flatMap(([type, dir, names]) =>
    names.map((n) => [`vault/objects/${type}/${n}.md`, `${dir}/${n}/${n}.md`]),
  ),
  // 승격된 프로젝트 폴더로 함께 들어가는 기존 부속 노트(legacy 에서는 projects/ 바로 아래 평평하게 있었다).
  ...[
    "AI-Native-취재노트-섭외메시지-템플릿",
    "AI-Native-취재노트-질문지-윤동현",
    "AI-Native-취재노트-창간호-구성안",
    "AI-Native-취재노트-큐시트-종훈님편-2026-07-28",
    "AI-Native-취재노트-큐카드-게스트용",
    "AI-Native-취재노트-큐카드",
  ].map((n) => [`vault/objects/projects/${n}.md`, `프로젝트/AI-Native-취재노트/${n}.md`]),
];

/** 디렉터리 규칙 [논리 접두, ws 접두]. 위에서부터 처음 맞는 것을 쓴다(구체적인 것이 먼저). 양방향. */
export const DIR_RULES = [
  ["vault/object-views/", "프로젝트/hsol-info/생성물/"],
  ["vault/objects/news-articles/", "뉴스룸/"],
  ["vault/objects/people/", "인물/"],
  ["vault/objects/organizations/", "조직/"],
  ["vault/objects/projects/", "프로젝트/"],
  ["vault/objects/places/", "장소/"],
  ["vault/objects/events/", "사건/"],
  ["vault/objects/artifacts/", "산출물/"],
  ["vault/objects/mentees/", "멘티/"],
  ["vault/object-sets/", "모음/"],
  ["vault/datasources/blog/", "원천/블로그/"],
  ["vault/datasources/linkedin/", "원천/링크드인/"],
  ["vault/datasources/medium/", "원천/미디엄/"],
  ["vault/datasources/gmail/", "원천/메일/"],
  ["vault/datasources/notion/", "원천/노션/"],
  ["vault/datasources/onedrive/", "원천/원드라이브-색인/"],
  ["vault/datasources/book/", "원천/책/"],
  ["vault/datasources/web/", "원천/웹/"],
  ["vault/datasources/repos/", "원천/저장소/"],
  ["vault/datasources/", "원천/"],
  ["assets/", "assets/"],
];

/** ws -> 논리 방향에만 쓰는 디렉터리 규칙. objects/concepts 가 kind 별로 쪼개진 폴더들이다. */
export const REVERSE_ONLY_DIR_RULES = [
  ["vault/objects/concepts/", "스킬/기술/"],
  ["vault/objects/concepts/", "스킬/도구/"],
  ["vault/objects/concepts/", "스킬/역량/"],
  ["vault/objects/concepts/", "스킬/프레임워크/"],
  ["vault/objects/concepts/", "가치관/"],
  ["vault/objects/concepts/", "관심사/"],
  ["vault/objects/concepts/", "운영체계/"],
  ["vault/objects/concepts/", "에이전트/런북/"],
  ["vault/objects/concepts/", "에이전트/학습로그/"],
];

const ACTION_LOG_LEGACY = /^vault\/action-log\/(\d{4})\/(\d{4}-\d{2}-\d{2}[^/]*\.md)$/;
const ACTION_LOG_WS = /^action-log\/((\d{4})-\d{2}-\d{2}[^/]*\.md)$/;

const nfc = (p) => p.normalize("NFC").replace(/^\/+/, "");

/** 논리 경로 -> ws 실제 경로(OneDrive 루트 기준). 모르는 경로면 null(예: 쪼개진 concepts 의 개별 노트). */
export function toWs(logical) {
  const p = nfc(logical);
  for (const [l, w] of FILE_RULES) if (p === l) return w;
  const al = p.match(ACTION_LOG_LEGACY);
  if (al) return `action-log/${al[2]}`;
  for (const [l, w] of DIR_RULES) if (p.startsWith(l)) return w + p.slice(l.length);
  return null;
}

/**
 * 승격된 프로젝트 폴더 안에 있지만 옛 vault 밖에서 온 자료(사이트가 읽지 않던 것). 감시와 CI 받기에서 뺀다.
 * 인덱스 노트(FILE_RULES)는 이 검사보다 먼저 맞으므로 계속 vault 로 본다.
 */
const NON_VAULT_PREFIXES = [
  "프로젝트/온톨로지-빌더/",
  ...PROMOTED_WITH_ORIGINALS.flatMap(([, dir, names]) => names.map((n) => `${dir}/${n}/`)),
  // 재정리로 생긴 원본 전용 폴더(에이전트 열람 등급 2단계 자료가 md 로도 있다).
  "프로젝트/부캐-SNS/",
  "프로젝트/스토키-매매봇/stocky-agents/",
];

/**
 * 개념 폴더에서 md 가 아닌 파일을 사이트 콘텐츠로 받는 예외 위치. 나머지 개념 폴더의 비-md 파일은 원본 자료
 * (계약서, 사진, 발표 파일 등. 워크스페이스 규칙상 노트와 같은 폴더에 둔다)라서 사이트가 읽지 않는다.
 * 원본은 에이전트 열람 등급 2단계라 CI 와 감시가 받지도 않게 한다(팀 프루퍼 `업무자료/에이전트운영/에이전트-열람-등급.md`).
 */
export const NON_MD_PASS_PREFIXES = ["프로젝트/hsol-info/생성물/", "원천/", "assets/"];

const isMd = (p) => p.toLowerCase().endsWith(".md");

/** ws 실제 경로 -> 논리 경로. vault 와 무관한 경로(사진/, 문서/, memory 의 다른 노트, 개념 폴더의 원본 파일 등)면 null. */
export function toLegacy(wsPath) {
  const p = nfc(wsPath);
  for (const [l, w] of FILE_RULES) if (p === w) return l;
  if (NON_VAULT_PREFIXES.some((x) => p.startsWith(x))) return null;
  if (!isMd(p) && !NON_MD_PASS_PREFIXES.some((x) => p.startsWith(x))) return null;
  const aw = p.match(ACTION_LOG_WS);
  if (aw) return `vault/action-log/${aw[2]}/${aw[1]}`;
  for (const [l, w] of [...DIR_RULES, ...REVERSE_ONLY_DIR_RULES]) if (p.startsWith(w)) return l + p.slice(w.length);
  return null;
}

/** ws 에서 vault 콘텐츠가 사는 최상위 소스들(폴더는 '/' 로 끝남). 감시와 CI 가 이것만 훑는다(사진/, 음악/ 등은 안 본다). */
export function wsSources({ includeDatasources = false, includeAssets = false } = {}) {
  const set = new Set();
  for (const [l, w] of [...DIR_RULES, ...REVERSE_ONLY_DIR_RULES]) {
    if (!includeDatasources && l.startsWith("vault/datasources/")) continue;
    if (!includeAssets && l.startsWith("assets/")) continue;
    set.add(w);
  }
  set.add("action-log/");
  for (const [, w] of FILE_RULES) set.add(w);
  // 상위 폴더가 이미 있으면 하위 소스는 뺀다(프로젝트/ 가 프로젝트/hsol-info/생성물/ 을 덮는다).
  const all = [...set];
  return all.filter((s) => !all.some((o) => o !== s && o.endsWith("/") && s.startsWith(o))).sort();
}

/**
 * wsSources() 의 소스 하나를 rclone 으로 훑거나 받을 때 붙일 필터 인자. toLegacy() 와 같은 기준으로 md 와 예외 위치만 남겨,
 * 개념 폴더에 같이 사는 원본 파일(수 GB 가 될 수 있다)을 내려받지도 나열하지도 않는다.
 * 소스 자체가 예외 위치 안이면 필터가 없다. 파일 소스(FILE_RULES)는 필터가 필요 없다.
 */
export function rcloneFilterArgs(src) {
  const s = nfc(src);
  if (!s.endsWith("/")) return [];
  if (NON_MD_PASS_PREFIXES.some((x) => s.startsWith(x))) return [];
  const args = [];
  for (const x of NON_MD_PASS_PREFIXES) if (x.startsWith(s) && x !== s) args.push("--filter", `+ /${x.slice(s.length)}**`);
  args.push("--filter", "+ *.md", "--filter", "+ *.MD", "--filter", "- *");
  return args;
}

export function layoutMode(fallback = "legacy") {
  const v = (process.env.ONEDRIVE_LAYOUT || fallback).trim().toLowerCase();
  if (v !== "legacy" && v !== "ws" && v !== "dual") throw new Error(`ONEDRIVE_LAYOUT 값이 이상하다: ${v}`);
  return v;
}

/** 논리 경로를 레이아웃에 따라 OneDrive 루트 기준 실제 경로 후보들로(앞의 것부터 시도). */
export function candidates(logical, mode = layoutMode("dual")) {
  const legacy = `${LEGACY_ROOT}/${nfc(logical)}`;
  const ws = toWs(logical);
  if (mode === "legacy") return [legacy];
  if (mode === "ws") return ws ? [ws] : [];
  return ws ? [ws, legacy] : [legacy];
}
