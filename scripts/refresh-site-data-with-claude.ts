import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { generateText, jsonSchema, stepCountIs, tool, type ModelMessage, type ToolSet } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { gatewayModel } from "../src/lib/llm";
import { siteDataSchema, type SiteData } from "../src/content/schema";
import { stripAiTypographyDeep } from "../src/lib/ai-typography";
import { HSOL_DATA } from "../src/data/site";
import { layoutSchema, type SiteLayout } from "../src/content/layout-types";
import { DEFAULT_LAYOUT } from "../src/content/default-layout";
import { LAYOUT_OVERRIDES, mergeLayout } from "../src/content/layout-overrides";
import { PAGE_KEYS, SITE_STRUCTURE, type PageKey } from "../src/content/site-structure";
import { renderCatalogForPrompt } from "../src/content/layout-catalog";
import {
  pageCompositionSchema,
  siteCompositionSchema,
  type ComposeNode,
  type PageComposition,
  type SiteComposition,
} from "../src/content/compose/schema";
import { COMPOSE_MANIFEST } from "../src/content/compose/manifest";
import { renderComposeCatalog } from "../src/content/compose/catalog";
import { recordBuildLog } from "../src/lib/db/build-log";

const execFileAsync = promisify(execFile);

/** footer 에 띄울 빌드 버전(UTC 기준 YYYYMMDD.HHmmss). 매 실행 달라져 "실제로 돌았는지"를 알린다. */
function buildVersion(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}.${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
}

const MODEL =
  process.env.AI_GATEWAY_MODEL ?? process.env.ANTHROPIC_MODEL ?? "anthropic/claude-opus-4.7";
const VAULT_ROOT = process.env.VAULT_ROOT ?? "hsol-info-blob/vault";
const SITE_DATA_PATH =
  process.env.VAULT_SITE_DATA_PATH ??
  "hsol-info-blob/vault/object-views/site-data.json";
const MAX_CHARS_PER_FILE = Number(
  process.env.CLAUDE_CONTEXT_MAX_CHARS_PER_FILE ?? 9000,
);
const MAX_TOKENS = (() => {
  const raw = process.env.ANTHROPIC_MAX_TOKENS;
  if (raw === undefined || raw === "") return 64_000;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) {
    throw new Error("ANTHROPIC_MAX_TOKENS must be a positive number");
  }
  return Math.floor(n);
})();
const FAILURE_LOG_DIR =
  process.env.CONTENT_REFRESH_FAILURE_LOG_DIR ?? "generated/content-refresh-failures";
const EMIT_TOOL_NAME = "emit_site_data";
const EMIT_LAYOUT_TOOL_NAME = "emit_layout";
const EMIT_COMPOSITION_TOOL_NAME = "emit_composition";
const SITE_DATA_TEMPLATE = JSON.stringify(HSOL_DATA, null, 2);

/**
 * 컴포지션(생성형 컴포넌트-트리) 빌더 게이트. **기본 비활성(점진 도입)**.
 * COMPOSITION_BUILDER=1 일 때만 동작하고, 대상 페이지는 COMPOSITION_PAGES(CSV)로 제한(기본 curious 파일럿).
 */
const COMPOSITION_BUILDER_ENABLED = (() => {
  const v = (process.env.COMPOSITION_BUILDER ?? "0").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
})();
/** 컴포지션 빌더 대상 = 네 관점(persona) 페이지 전부. COMPOSITION_PAGES(CSV)로 좁힐 수 있다. */
const DEFAULT_COMPOSITION_PAGES: PageKey[] = ["hire", "collab", "builder", "curious"];
const COMPOSITION_PAGES: PageKey[] = (() => {
  const raw = (process.env.COMPOSITION_PAGES ?? "").trim();
  if (!raw) return DEFAULT_COMPOSITION_PAGES;
  const keys = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is PageKey => (PAGE_KEYS as readonly string[]).includes(s));
  return keys.length ? keys : DEFAULT_COMPOSITION_PAGES;
})();
const COMPOSITION_MAX_TOKENS = Number(process.env.COMPOSITION_EMIT_MAX_TOKENS ?? 16000);

/** 레이아웃 빌더 비활성화: LAYOUT_RESEARCH=0 또는 LAYOUT_BUILDER=0 이면 레이아웃 생성/리서치를 건너뛴다. */
const LAYOUT_BUILDER_ENABLED = (() => {
  const v = (process.env.LAYOUT_BUILDER ?? process.env.LAYOUT_RESEARCH ?? "1").trim().toLowerCase();
  return v !== "0" && v !== "false" && v !== "no";
})();
const RESEARCH_MAX_ROUNDS = Number(process.env.LAYOUT_RESEARCH_MAX_ROUNDS ?? 6);
const RESEARCH_MAX_TOKENS = Number(process.env.LAYOUT_RESEARCH_MAX_TOKENS ?? 6000);
const LAYOUT_MAX_TOKENS = Number(process.env.LAYOUT_EMIT_MAX_TOKENS ?? 16000);
/** 매 실행 다른 포트폴리오를 보도록 회전하는 리서치 렌즈(날짜 기반으로 고른다). */
const RESEARCH_LENSES = [
  "엔지니어·개발자 개인 포트폴리오(personal developer/engineer portfolio sites)",
  "디자이너·아트디렉터 포트폴리오(designer/art-director portfolios)",
  "스튜디오·에이전시 소개 사이트(creative studio/agency sites)",
  "Awwwards·FWA 수상 1인 포트폴리오(award-winning solo portfolios)",
  "창업가·메이커 about/소개 페이지(founder/maker about pages)",
  "프로덕트 매니저·빌더 이력형 사이트(PM/builder résumé-style sites)",
];
const REQUIRED_TOP_LEVEL_KEYS = [
  "identity",
  "pillars",
  "personas",
  "viewHeaders",
  "portfolioCopy",
  "career",
  "education",
  "certifications",
  "languages",
  "publications",
  "faq",
] as const;
/** 원페이저(이력서/포트폴리오 한 장) 빌더 설정. */
const EMIT_ONEPAGER_TOOL_NAME = "emit_one_pager";
const ONEPAGER_HTML_PATH =
  process.env.VAULT_ONEPAGER_HTML_PATH ??
  "hsol-info-blob/vault/object-views/onepager-ko.html";
/** 원페이저 빌더 비활성화: ONEPAGER_BUILDER=0 이면 건너뛴다(기존 파일 보존). */
const ONEPAGER_BUILDER_ENABLED = (() => {
  const v = (process.env.ONEPAGER_BUILDER ?? "1").trim().toLowerCase();
  return v !== "0" && v !== "false" && v !== "no";
})();
const ONEPAGER_MAX_TOKENS = Number(process.env.ONEPAGER_EMIT_MAX_TOKENS ?? 20000);
/** 원페이저 근거 = vault 온톨로지 원본. 척추(큐레이트 뷰) + objects/* 글롭. */
const ONEPAGER_SPINE_FILES = [
  `${VAULT_ROOT}/object-views/포트폴리오-요약.md`,
  `${VAULT_ROOT}/object-sets/경력-타임라인.md`,
  `${VAULT_ROOT}/object-sets/현재-역할.md`,
  `${VAULT_ROOT}/object-views/타임라인.md`,
  `${VAULT_ROOT}/object-views/hsol-info-소개-백데이터.md`,
  `${VAULT_ROOT}/object-views/작문-가이드.md`,
  `${VAULT_ROOT}/objects/people/임한솔.md`,
];
const ONEPAGER_OBJECT_DIRS = ["projects", "organizations", "concepts", "artifacts"];

const VAULT_README_PATH = `${VAULT_ROOT}/README.md`;
const HOME_BUILT_SOURCE_PATH = `${VAULT_ROOT}/objects/projects/hsol-info.md`;
const BASE_CONTEXT_FILES = [
  `${VAULT_ROOT}/object-views/작문-가이드.md`,
  `${VAULT_ROOT}/object-views/포트폴리오-요약.md`,
  `${VAULT_ROOT}/object-views/타임라인.md`,
  HOME_BUILT_SOURCE_PATH,
  `${VAULT_ROOT}/objects/people/임한솔.md`,
  `${VAULT_ROOT}/objects/concepts/임한솔-persona.md`,
];

function logStep(message: string) {
  const now = new Date().toISOString();
  console.log(`[refresh-site-data][${now}] ${message}`);
}

/** `npm run content:refresh:claude -- force` 또는 `CONTENT_REFRESH_FORCE=1` */
function isForceRefresh(): boolean {
  const env = process.env.CONTENT_REFRESH_FORCE?.trim().toLowerCase();
  if (env === "1" || env === "true" || env === "yes") return true;
  return process.argv.slice(2).includes("force");
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();

  // 1) Prefer fenced code blocks first (```json ... ``` or ``` ... ```)
  const fenced =
    trimmed.match(/`{3,}\s*json\s*([\s\S]*?)`{3,}/i) ??
    trimmed.match(/`{3,}\s*([\s\S]*?)`{3,}/);
  if (fenced?.[1]) {
    return JSON.parse(fenced[1].trim());
  }

  // 2) Fallback: extract from first "{" to last "}" if assistant added prose.
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
    return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
  }

  throw new Error("Claude response does not contain a parsable JSON object.");
}

function parseJsonWithFallback(text: string): unknown {
  const normalized = text
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u00a0/g, " ");
  return extractJson(normalized);
}

function tryParseJsonString(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed) return value;
  if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function normalizeNestedJsonLikeStrings(input: unknown): unknown {
  if (Array.isArray(input)) {
    return input.map((item) => normalizeNestedJsonLikeStrings(item));
  }
  if (typeof input === "string") {
    const parsed = tryParseJsonString(input);
    if (parsed === input) return input;
    return normalizeNestedJsonLikeStrings(parsed);
  }
  if (input && typeof input === "object") {
    return Object.fromEntries(
      Object.entries(input).map(([key, value]) => [key, normalizeNestedJsonLikeStrings(value)]),
    );
  }
  return input;
}

function coerceSiteDataCandidate(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const obj = input as Record<string, unknown>;
  const hasTopLevelShape = REQUIRED_TOP_LEVEL_KEYS.some((key) => key in obj);
  if (hasTopLevelShape) return input;

  // Sometimes tool input is wrapped (e.g. { data: {...} } or { siteData: {...} }).
  const wrapperKeys = ["siteData", "site_data", "data", "payload", "result", "output"];
  for (const key of wrapperKeys) {
    const nested = obj[key];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      const nestedObj = nested as Record<string, unknown>;
      if (REQUIRED_TOP_LEVEL_KEYS.some((k) => k in nestedObj)) return nested;
    }
  }
  return input;
}

function toRecord(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  return input as Record<string, unknown>;
}

function pickString(...values: Array<unknown>): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function toStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function normalizeCareerPoints(args: {
  rawPoints: unknown;
  fallbackDesc: string;
  role: string;
  org: string;
}): string[] {
  const base = toStringArray(args.rawPoints);
  const seed = [
    ...base,
    args.fallbackDesc.trim(),
    `${args.org}에서 ${args.role} 역할 수행`,
    "실무 맥락에서 실행과 협업을 통해 결과를 만들었다.",
    "문제 정의부터 실행·개선까지 책임지고 운영했다.",
  ]
    .map((s) => s.trim())
    .filter(Boolean);
  const deduped = [...new Set(seed)];
  while (deduped.length < 3) {
    deduped.push(`핵심 책임: ${args.role}`);
  }
  return deduped.slice(0, 5);
}

function dateRangeLabel(start: unknown, end: unknown): string {
  const s = typeof start === "string" && start.trim() ? start.trim() : "";
  const e = typeof end === "string" && end.trim() ? end.trim() : "현재";
  if (!s && !e) return "기간 미상";
  if (!s) return e;
  return `${s} - ${e}`;
}

/** `career[].tier` 를 personas 전체 키에 대해 채운다(`tier`가 숫자인 구형 입력·부분 객체·템플릿 폴백). */
function mergeCareerItemTier(args: {
  item: Record<string, unknown>;
  personaKeys: readonly string[];
  template: Record<string, number> | undefined;
}): Record<string, number> {
  const { item, personaKeys, template } = args;
  const rawTier = item.tier;
  const legacyScalar =
    typeof rawTier === "number" && Number.isFinite(rawTier)
      ? Math.max(1, Math.floor(rawTier))
      : null;
  const obj =
    rawTier && typeof rawTier === "object" && !Array.isArray(rawTier)
      ? (rawTier as Record<string, unknown>)
      : null;

  const out: Record<string, number> = {};
  for (const pk of personaKeys) {
    let v: number | null = null;
    if (obj && typeof obj[pk] === "number" && Number.isFinite(obj[pk])) {
      v = Math.max(1, Math.floor(obj[pk] as number));
    } else if (legacyScalar !== null) {
      v = legacyScalar;
    }
    if (v === null) {
      const t = template?.[pk];
      v = typeof t === "number" && Number.isFinite(t) ? Math.max(1, Math.floor(t)) : 1;
    }
    out[pk] = v;
  }
  return out;
}

/**
 * 모델이 글/레퍼런스 항목(blog·extraWritings·notes·methods 등 MethodItem)에 자율 판단으로 채운
 * 정식 href 를 큐레이트된 기존 항목에 name 기준으로 반영한다. 콘텐츠(name/blurb 등)는 건드리지 않고
 * href 만 보강 — 머지가 base(HSOL_DATA)로 리셋하느라 모델의 링크 판단이 버려지던 걸 살린다.
 */
function applyModelHrefs(
  existing: Array<{ name: string; href?: string }> | undefined,
  incoming: unknown,
): void {
  if (!Array.isArray(existing)) return;
  const inList = (Array.isArray(incoming) ? incoming : [])
    .map((x) => toRecord(x))
    .filter((x): x is Record<string, unknown> => Boolean(x));
  for (const item of existing) {
    const match = inList.find((r) => pickString(r.name) === item.name);
    const href = pickString(match?.href);
    if (href && /^https?:\/\//i.test(href)) item.href = href;
  }
}

function normalizeAlternateSiteDataShape(input: unknown): unknown {
  const src = toRecord(input);
  if (!src) return input;

  const out = structuredClone(HSOL_DATA);

  const identity = toRecord(src.identity);
  if (identity) {
    out.identity.name = pickString(identity.name, identity.nameKo, out.identity.name) ?? out.identity.name;
    out.identity.nameEn =
      pickString(identity.nameEn, out.identity.nameEn) ?? out.identity.nameEn;
    out.identity.handle =
      pickString(identity.handle, toStringArray(identity.aliases)[0], out.identity.handle) ??
      out.identity.handle;
    out.identity.tagline = pickString(identity.tagline, out.identity.tagline) ?? out.identity.tagline;
    out.identity.taglineSub =
      pickString(identity.taglineSub, identity.description, out.identity.taglineSub) ??
      out.identity.taglineSub;
    out.identity.location =
      pickString(identity.location, out.identity.location) ?? out.identity.location;
    out.identity.email = pickString(identity.email, out.identity.email) ?? out.identity.email;
    out.identity.linkedin =
      pickString(identity.linkedin, out.identity.linkedin) ?? out.identity.linkedin;
    out.identity.portfolio =
      pickString(identity.portfolio, identity.homepage, out.identity.portfolio) ??
      out.identity.portfolio;
    out.identity.company = pickString(identity.company, out.identity.company) ?? out.identity.company;
    out.identity.calendly =
      pickString(identity.calendly, out.identity.calendly) ?? out.identity.calendly;
    out.identity.gravatar =
      pickString(identity.gravatar, out.identity.gravatar) ?? out.identity.gravatar;
  }

  if (Array.isArray(src.pillars) && src.pillars.length > 0) {
    out.pillars = src.pillars
      .map((item) => toRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map((item, idx) => ({
        key: pickString(item.key, out.pillars[idx]?.key, `pillar-${idx + 1}`) ?? `pillar-${idx + 1}`,
        label: pickString(item.label, item.titleEn, item.titleKo, out.pillars[idx]?.label) ?? "Pillar",
        labelKo:
          pickString(item.labelKo, item.titleKo, item.titleEn, out.pillars[idx]?.labelKo) ?? "기둥",
        blurb: pickString(item.blurb, item.descKo, out.pillars[idx]?.blurb) ?? "",
      }))
      .filter((item) => Boolean(item.blurb));
  }

  if (Array.isArray(src.personas) && src.personas.length > 0) {
    out.personas = src.personas
      .map((item) => toRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map((item, idx) => ({
        key: pickString(item.key, out.personas[idx]?.key, `persona-${idx + 1}`) ?? `persona-${idx + 1}`,
        mark: pickString(item.mark, out.personas[idx]?.mark, String(idx + 1).padStart(2, "0")) ??
          String(idx + 1).padStart(2, "0"),
        title: pickString(item.title, item.titleKo, out.personas[idx]?.title) ?? "Persona",
        titleEn: pickString(item.titleEn, item.titleKo, out.personas[idx]?.titleEn) ?? "Persona",
        hint: pickString(item.hint, out.personas[idx]?.hint) ?? "",
      }))
      .filter((item) => Boolean(item.hint));
  }

  const portfolioCopy = toRecord(src.portfolioCopy);
  if (portfolioCopy) {
    out.portfolioCopy.home.heroEyebrow =
      pickString(portfolioCopy.heroPrimary, out.portfolioCopy.home.heroEyebrow) ??
      out.portfolioCopy.home.heroEyebrow;
    const heroSecondary =
      pickString(portfolioCopy.heroSecondary, out.portfolioCopy.home.heroSubEmphasis) ??
      out.portfolioCopy.home.heroSubEmphasis;
    out.portfolioCopy.home.heroSubEmphasis = heroSecondary;
    out.portfolioCopy.home.heroSubLead =
      pickString(portfolioCopy.heroBody, out.portfolioCopy.home.heroSubLead) ??
      out.portfolioCopy.home.heroSubLead;
    out.portfolioCopy.home.coffeeButtonLabel =
      pickString(portfolioCopy.ctaMain, out.portfolioCopy.home.coffeeButtonLabel) ??
      out.portfolioCopy.home.coffeeButtonLabel;

    // 글/레퍼런스 항목: 모델이 vault URL을 보고 채운 href를 큐레이트 항목에 자율 반영(콘텐츠는 유지).
    const pcBuilder = toRecord(portfolioCopy.builder);
    if (pcBuilder) {
      const blogHref = pickString(toRecord(pcBuilder.blog)?.href);
      if (blogHref && /^https?:\/\//i.test(blogHref)) out.portfolioCopy.builder.blog.href = blogHref;
      applyModelHrefs(out.portfolioCopy.builder.extraWritings, pcBuilder.extraWritings);
    }
    applyModelHrefs(out.portfolioCopy.curious.notes, toRecord(portfolioCopy.curious)?.notes);
    applyModelHrefs(out.portfolioCopy.collab.methods, toRecord(portfolioCopy.collab)?.methods);
  }

  if (Array.isArray(src.career) && src.career.length > 0) {
    const personaKeys = out.personas.map((p) => p.key);
    const tierTemplates = structuredClone(out.career).map((c) => c.tier);
    out.career = src.career
      .map((item) => toRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map((item, idx) => {
        const role = pickString(item.role, out.career[idx]?.role) ?? "Role";
        const org = pickString(item.org, out.career[idx]?.org, "Unknown Org") ?? "Unknown Org";
        const desc = pickString(item.descKo, out.career[idx]?.points?.[0], role) ?? role;
        return {
          org,
          orgEn: pickString(item.orgEn, org, out.career[idx]?.orgEn) ?? org,
          role,
          period: pickString(
            item.period,
            dateRangeLabel(item.startDate, item.endDate),
            out.career[idx]?.period,
          ) ?? "기간 미상",
          tags: toStringArray(item.tags).length > 0
            ? toStringArray(item.tags)
            : [pickString(item.type, "경력") ?? "경력"],
          points: normalizeCareerPoints({
            rawPoints: item.points,
            fallbackDesc: desc,
            role,
            org,
          }),
          tier: mergeCareerItemTier({
            item,
            personaKeys,
            template: tierTemplates[idx],
          }),
        };
      });
  }

  if (Array.isArray(src.education) && src.education.length > 0) {
    out.education = src.education
      .map((item) => toRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map((item, idx) => ({
        school: pickString(item.school, item.org, out.education[idx]?.school, "Unknown School") ?? "Unknown School",
        degree: pickString(item.degree, item.major, out.education[idx]?.degree, "학위") ?? "학위",
        period: pickString(item.period, dateRangeLabel(item.startDate, item.endDate), out.education[idx]?.period) ??
          "기간 미상",
      }));
  }

  if (Array.isArray(src.certifications) && src.certifications.length > 0) {
    const certs = src.certifications
      .map((item) =>
        typeof item === "string" ? item : pickString(toRecord(item)?.name, toRecord(item)?.issuer))
      .filter((item): item is string => Boolean(item));
    if (certs.length > 0) out.certifications = certs;
  }

  if (Array.isArray(src.languages) && src.languages.length > 0) {
    const langs = src.languages
      .map((item) => toRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map((item, idx) => ({
        name: pickString(item.name, out.languages[idx]?.name, "Korean") ?? "Korean",
        level: pickString(item.level, out.languages[idx]?.level, "중급") ?? "중급",
      }));
    if (langs.length > 0) out.languages = langs;
  }

  if (Array.isArray(src.publications) && src.publications.length > 0) {
    out.publications = src.publications
      .map((item) => toRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map((item, idx) => {
        // href: 모델이 vault URL을 채우면 살리고, 없으면 기존 값 유지(있어야 Writing 카드가 링크로 렌더됨).
        const href = pickString(item.href, out.publications[idx]?.href);
        return {
          title: pickString(item.title, out.publications[idx]?.title, "Untitled") ?? "Untitled",
          desc: pickString(item.desc, item.descKo, out.publications[idx]?.desc, "설명 없음") ?? "설명 없음",
          ...(href && /^https?:\/\//i.test(href) ? { href } : {}),
        };
      });
  }

  if (Array.isArray(src.faq) && src.faq.length > 0) {
    out.faq = src.faq
      .map((item) => toRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map((item, idx) => ({
        q: pickString(item.q, out.faq[idx]?.q, "질문") ?? "질문",
        a: pickString(item.a, out.faq[idx]?.a, "답변 준비 중입니다.") ?? "답변 준비 중입니다.",
      }));
  }

  return out;
}

async function writeFailureDump(args: {
  stage: string;
  initialResponse: string;
  lastCandidate: string;
  error: unknown;
}): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const baseName = `${timestamp}-${args.stage}`;
  const dir = FAILURE_LOG_DIR;
  const errorMessage =
    args.error instanceof Error ? args.error.stack ?? args.error.message : String(args.error);

  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, `${baseName}-initial.txt`),
    `${args.initialResponse}\n`,
    "utf8",
  );
  await writeFile(
    path.join(dir, `${baseName}-last-candidate.txt`),
    `${args.lastCandidate}\n`,
    "utf8",
  );
  await writeFile(
    path.join(dir, `${baseName}-error.txt`),
    `${errorMessage}\n`,
    "utf8",
  );
  logStep(`Failure dump written: ${path.join(dir, `${baseName}-*.txt`)}`);
}

async function loadContextFiles({
  highPriorityFiles,
  regularFiles,
}: {
  highPriorityFiles: string[];
  regularFiles: string[];
}): Promise<string> {
  const dedupHigh = [...new Set(highPriorityFiles)];
  const dedupRegular = [...new Set(regularFiles)].filter((f) => !dedupHigh.includes(f));
  logStep(
    `Loading context files (priority=${dedupHigh.length}, regular=${dedupRegular.length})...`,
  );

  const loadOne = async (filePath: string, isPriority: boolean) => {
    try {
      const content = await readFile(filePath, "utf8");
      const limit = isPriority ? MAX_CHARS_PER_FILE * 2 : MAX_CHARS_PER_FILE;
      const sliced =
        content.length > limit ? `${content.slice(0, limit)}\n\n[TRUNCATED]` : content;
      const tag = isPriority ? "HIGH_PRIORITY_CONTEXT" : "CONTEXT";
      return `## ${filePath} [${tag}]\n${sliced}`;
    } catch {
      return `## ${filePath}\n[FILE_NOT_FOUND]`;
    }
  };

  const chunks = await Promise.all([
    ...dedupHigh.map((filePath) => loadOne(filePath, true)),
    ...dedupRegular.map((filePath) => loadOne(filePath, false)),
  ]);
  return chunks.join("\n\n");
}

function toPosixPath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function toVaultContextPath(relativeVaultPath: string): string {
  const normalized = relativeVaultPath.replace(/^\/+/, "");
  return path.posix.join(VAULT_ROOT, normalized);
}

/** 부모 커밋에서 서브모듈(hsol-info-blob) 포인터 gitlink SHA 를 읽는다(서브모듈 객체 불필요). */
async function submodulePointerAt(commit: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", `${commit}:hsol-info-blob`], {
      cwd: process.cwd(),
    });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

/**
 * "vault 가 수정됐는가" = 부모 dev 푸시에서 **서브모듈(hsol-info-blob=vault) 포인터가 바뀌었는가**.
 * hsol-info-blob 은 통째로 vault 저장소라, 포인터가 움직였으면 vault 내용이 바뀐 것이다.
 * (CI 의 vault 자동 커밋은 부모 포인터를 안 바꾸므로 자기 자신을 오탐하지 않는다.)
 * files 는 가능하면 서브모듈 내부 diff 로 채우는 best-effort(없으면 [] → legacy 컨텍스트).
 *
 * 주의: 부모 checkout 이 shallow 면 BASE 커밋이 없어 감지가 안 되므로 워크플로에서 fetch-depth: 0 필요.
 */
async function detectVaultChangeFromGit(): Promise<{ changed: boolean; files: string[] }> {
  const baseSha = process.env.GIT_DIFF_BASE_SHA;
  const headSha = process.env.GIT_DIFF_HEAD_SHA;
  if (!baseSha || !headSha || /^0+$/.test(baseSha)) return { changed: false, files: [] };

  const oldSub = await submodulePointerAt(baseSha);
  const newSub = await submodulePointerAt(headSha);
  if (!oldSub || !newSub) return { changed: false, files: [] };
  if (oldSub === newSub) return { changed: false, files: [] }; // 포인터 그대로 → vault 미수정

  // 포인터가 바뀜 → vault 수정됨. 변경 파일 목록은 서브모듈 내부 diff 로(객체 없으면 생략).
  let files: string[] = [];
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["-C", "hsol-info-blob", "diff", "--name-only", oldSub, newSub, "--", "vault"],
      { cwd: process.cwd() },
    );
    files = stdout
      .split("\n")
      .map((line) => toPosixPath(line.trim()))
      .filter(Boolean)
      .map((filePath) => filePath.replace(/^vault\//, "")); // vault 루트 상대 경로로
  } catch {
    files = [];
  }
  return { changed: true, files };
}

async function detectVaultChange(): Promise<{ changed: boolean; files: string[] }> {
  const fromEnv = process.env.VAULT_CHANGED_FILES;
  if (fromEnv && fromEnv.trim()) {
    const files = fromEnv
      .split(/\r?\n|,/)
      .map((s) => s.trim())
      .filter(Boolean);
    return { changed: files.length > 0, files };
  }
  try {
    return await detectVaultChangeFromGit();
  } catch {
    return { changed: false, files: [] };
  }
}

async function getExistingSiteDataText(): Promise<{ text: string; exists: boolean }> {
  try {
    logStep(`Reading current site-data: ${SITE_DATA_PATH}`);
    const text = await readFile(SITE_DATA_PATH, "utf8");
    return { text, exists: true };
  } catch (error) {
    const enoent =
      typeof error === "object" && error !== null && "code" in error
        ? (error as { code?: string }).code === "ENOENT"
        : false;
    if (!enoent) throw error;
    return { text: "", exists: false };
  }
}

async function loadContextFilesLegacy(): Promise<string> {
  logStep(`Loading context files (${BASE_CONTEXT_FILES.length})...`);
  const chunks = await Promise.all(
    BASE_CONTEXT_FILES.map(async (filePath) => {
      try {
        const content = await readFile(filePath, "utf8");
        const sliced =
          content.length > MAX_CHARS_PER_FILE
            ? `${content.slice(0, MAX_CHARS_PER_FILE)}\n\n[TRUNCATED]`
            : content;
        return `## ${filePath}\n${sliced}`;
      } catch {
        return `## ${filePath}\n[FILE_NOT_FOUND]`;
      }
    }),
  );
  return chunks.join("\n\n");
}

type AnthropicContent =
  | { type?: "text"; text?: string }
  | { type?: "tool_use"; name?: string; input?: unknown };

function isTextBlock(item: AnthropicContent): item is Extract<AnthropicContent, { type?: "text" }> {
  return item.type === "text";
}

function isEmitToolUseBlock(
  item: AnthropicContent,
): item is Extract<AnthropicContent, { type?: "tool_use" }> {
  return item.type === "tool_use" && item.name === EMIT_TOOL_NAME;
}

/**
 * Anthropic 메시지 body(model/max_tokens/messages/tools/tool_choice)를 AI SDK 호출로 변환한다.
 * - 커스텀 툴(name+input_schema)은 강제 구조화 출력용(실행 없음)으로 매핑.
 * - 서버 툴(web_search / web_fetch)은 @ai-sdk/anthropic provider 툴로 매핑(Gateway 경유 실행).
 */
function toAiTools(raw: unknown): ToolSet {
  const list = Array.isArray(raw)
    ? (raw as Array<{ type?: string; name?: string; description?: string; input_schema?: unknown }>)
    : [];
  const out: ToolSet = {};
  for (const t of list) {
    const type = t.type ?? "";
    if (type.startsWith("web_search")) {
      out.web_search = anthropic.tools.webSearch_20260209();
    } else if (type.startsWith("web_fetch")) {
      out.web_fetch = anthropic.tools.webFetch_20260209();
    } else if (t.name && t.input_schema) {
      out[t.name] = tool({
        description: t.description ?? "",
        inputSchema: jsonSchema(t.input_schema as Parameters<typeof jsonSchema>[0]),
      });
    }
  }
  return out;
}

/**
 * Vercel AI Gateway 경유 단발 호출. 기존 raw-HTTP 호출부와 호환되는 {content, stop_reason, usage}
 * 형태로 반환한다(호출부의 tool_use/text 블록 파싱·max_tokens 감지 로직을 그대로 유지).
 * 일시적 오류(429/5xx/네트워크)는 AI SDK가 maxRetries 만큼 지수 백오프로 재시도한다.
 */
async function anthropicFetchJson(
  _apiKey: string,
  body: Record<string, unknown>,
  opts?: { maxRetries?: number },
): Promise<{ content?: AnthropicContent[]; stop_reason?: string; usage?: { input_tokens?: number; output_tokens?: number } }> {
  const tools = toAiTools(body.tools);
  const hasTools = Object.keys(tools).length > 0;
  const choice = body.tool_choice as { type?: string; name?: string } | undefined;

  const result = await generateText({
    model: gatewayModel((body.model as string | undefined) ?? null),
    maxOutputTokens: body.max_tokens as number,
    messages: body.messages as ModelMessage[],
    maxRetries: opts?.maxRetries ?? Number(process.env.ANTHROPIC_MAX_RETRIES ?? 4),
    ...(hasTools ? { tools, stopWhen: stepCountIs(RESEARCH_MAX_ROUNDS) } : {}),
    ...(choice?.type === "tool" && choice.name
      ? { toolChoice: { type: "tool" as const, toolName: choice.name } }
      : {}),
  });

  const content: AnthropicContent[] = [];
  if (result.text?.trim()) content.push({ type: "text", text: result.text });
  for (const call of result.toolCalls) {
    content.push({ type: "tool_use", name: call.toolName, input: call.input });
  }

  const stop_reason =
    result.finishReason === "length"
      ? "max_tokens"
      : result.finishReason === "tool-calls"
        ? "tool_use"
        : "end_turn";

  return {
    content,
    stop_reason,
    usage: {
      input_tokens: result.usage?.inputTokens,
      output_tokens: result.usage?.outputTokens,
    },
  };
}

async function requestAnthropicStructured(
  apiKey: string,
  prompt: string,
): Promise<{ text: string; toolInput: unknown | null; stopReason: string | undefined }> {
  logStep(`Requesting Anthropic (${MODEL}, max_tokens=${MAX_TOKENS})...`);
  const data = await anthropicFetchJson(apiKey, {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [{ role: "user", content: prompt }],
    tools: [
      {
        name: EMIT_TOOL_NAME,
        description: "Return ONLY final site-data JSON object. Never include markdown/prose.",
        input_schema: {
          type: "object",
          additionalProperties: true,
          properties: {
            identity: { type: "object" },
            pillars: { type: "array" },
            personas: { type: "array" },
            viewHeaders: { type: "object" },
            portfolioCopy: { type: "object" },
            career: { type: "array" },
            education: { type: "array" },
            certifications: { type: "array" },
            languages: { type: "array" },
            publications: { type: "array" },
            faq: { type: "array" },
          },
          required: [
            "identity",
            "pillars",
            "personas",
            "viewHeaders",
            "portfolioCopy",
            "career",
            "education",
            "certifications",
            "languages",
            "publications",
            "faq",
          ],
        },
      },
    ],
    tool_choice: { type: "tool", name: EMIT_TOOL_NAME },
  }) as {
    content?: AnthropicContent[];
    stop_reason?: string;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const blocks = data.content ?? [];
  const text = blocks
    .filter(isTextBlock)
    .map((item) => item.text ?? "")
    .join("\n")
    .trim();
  const toolInput = blocks.find(isEmitToolUseBlock)?.input ?? null;

  const usage = data.usage;
  if (usage?.input_tokens != null && usage?.output_tokens != null) {
    logStep(
      `Anthropic response received (stop_reason=${data.stop_reason ?? "?"}; usage in/out=${usage.input_tokens}/${usage.output_tokens}).`,
    );
  } else {
    logStep(`Anthropic response received (stop_reason=${data.stop_reason ?? "?"}).`);
  }
  if (!toolInput && !text) {
    throw new Error("Empty response from Anthropic");
  }
  return { text, toolInput, stopReason: data.stop_reason };
}

/** Anthropic Messages 단발 호출(raw HTTP) + 일시적 오류 재시도. 서버툴 응답 그대로 반환. */
async function anthropicMessages(
  apiKey: string,
  body: Record<string, unknown>,
): Promise<{ content: AnthropicContent[]; stop_reason?: string }> {
  const data = await anthropicFetchJson(apiKey, body);
  return { content: data.content ?? [], stop_reason: data.stop_reason };
}

/**
 * 매 실행 다른 "잘 만든 포트폴리오"를 web_search/web_fetch 로 리서치해,
 * 우리 블록 카탈로그로 적용 가능한 레이아웃·섹션 아이디어를 한국어 메모로 정리한다.
 * 네트워크/모델 오류는 빈 문자열로 흡수한다(레이아웃 단계가 죽지 않게).
 */
async function researchPortfolioReferences(apiKey: string, lens: string): Promise<string> {
  const prompt = `너는 포트폴리오 웹사이트 디자인 리서처다. 지금 주제는 "${lens}".
web_search/web_fetch 로 **이번 회차에 새로 볼 만한, 잘 만든 실제 사례 2~3곳**을 찾아 살펴보고,
그 사이트들이 잘한 점 중 **우리가 가진 블록 시스템으로 적용 가능한 레이아웃·섹션 구성·정보 순서 아이디어**만 한국어로 5~9개 불릿으로 정리하라.
우리 사이트 제약: 페이지는 home/hire/collab/builder/curious/about/architecture 로 고정이고, 새 비주얼/컴포넌트는 못 만들며 기존 블록(섹션)들의 "순서·포함 여부·강조"만 바꿀 수 있다.
따라서 "이 섹션을 위로", "이 관점에선 X를 먼저", "Y 섹션은 접어도 됨" 같은 **구성 차원의 실천 가능한 제안** 위주로 적어라. 추상적 미사여구·색/폰트 얘기는 빼라.
마지막 줄에 "참고: <사이트1>, <사이트2>" 형식으로 본 사이트를 적어라.`;

  const tools = [
    { type: "web_search_20260209", name: "web_search" },
    { type: "web_fetch_20260209", name: "web_fetch" },
  ];
  let messages: Array<{ role: string; content: unknown }> = [{ role: "user", content: prompt }];
  const texts: string[] = [];

  try {
    for (let round = 0; round < RESEARCH_MAX_ROUNDS; round += 1) {
      const data = await anthropicMessages(apiKey, {
        model: MODEL,
        max_tokens: RESEARCH_MAX_TOKENS,
        messages,
        tools,
      });
      const content = data.content ?? [];
      for (const block of content) {
        if (isTextBlock(block) && block.text) texts.push(block.text);
      }
      if (data.stop_reason === "pause_turn") {
        messages = [...messages, { role: "assistant", content }];
        continue;
      }
      break;
    }
  } catch (error) {
    logStep(`Portfolio research skipped (${error instanceof Error ? error.message : String(error)}).`);
    return "";
  }
  return texts.join("\n").trim();
}

function isEmitLayoutToolUseBlock(
  item: AnthropicContent,
): item is Extract<AnthropicContent, { type?: "tool_use" }> {
  return item.type === "tool_use" && item.name === EMIT_LAYOUT_TOOL_NAME;
}

/**
 * 현재 레이아웃을 앵커로 두고, 리서치 메모를 참고해 **점진적으로 개선된** layout 을 생성한다.
 * 실패하면 null(호출부에서 기존/DEFAULT 로 폴백). layoutSchema 로 가드레일 검증.
 */
/**
 * submodule git 에서 최근 N개 커밋의 site-data.json 을 복원해, 페이지별 "블록 순서" 변화만
 * 컴팩트하게 뽑는다(레이아웃 diff 궤적). 전체 changelog 를 읽는 것보다 컨텍스트가 작고,
 * 어떤 페이지가 회차마다 왕복(A→B→A)했는지 구조적으로 드러나 핑퐁 방지에 강하다.
 * 변하지 않은 페이지(home/about/architecture 등)는 노이즈라 생략한다.
 */
async function getLayoutOrderTimeline(maxCommits = 8): Promise<string> {
  const firstSlash = SITE_DATA_PATH.indexOf("/");
  if (firstSlash < 0) return "(git 레이아웃 히스토리 없음)";
  const subDir = SITE_DATA_PATH.slice(0, firstSlash);
  const relPath = SITE_DATA_PATH.slice(firstSlash + 1);
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["-C", subDir, "log", "-n", String(maxCommits), "--format=%H", "--", relPath],
      { cwd: process.cwd() },
    );
    const shas = stdout.split("\n").map((s) => s.trim()).filter(Boolean).reverse(); // 과거→현재
    if (!shas.length) return "(git 레이아웃 히스토리 없음 — 첫 진화)";

    const perPage: Record<string, string[]> = {};
    for (const sha of shas) {
      let parsed: { layout?: { pages?: Record<string, { blocks?: { type?: string }[] }> } };
      try {
        const { stdout: content } = await execFileAsync(
          "git",
          ["-C", subDir, "show", `${sha}:${relPath}`],
          { cwd: process.cwd(), maxBuffer: 32 * 1024 * 1024 },
        );
        parsed = JSON.parse(content);
      } catch {
        continue; // 해당 커밋에 파일이 없거나 파싱 실패 → 건너뜀
      }
      const pages = parsed.layout?.pages;
      if (!pages) continue;
      for (const key of PAGE_KEYS) {
        const blocks = pages[key]?.blocks;
        const seq = Array.isArray(blocks) ? blocks.map((b) => b.type ?? "?").join(",") : "(none)";
        (perPage[key] ??= []).push(seq);
      }
    }

    const lines: string[] = [];
    for (const key of PAGE_KEYS) {
      const seqs = perPage[key] ?? [];
      if (seqs.length < 2) continue;
      const varied = new Set(seqs).size > 1;
      if (!varied) continue; // 한 번도 안 바뀐 페이지는 생략
      lines.push(`${key} (과거→현재):`);
      seqs.forEach((s, i) => lines.push(`  ${i === seqs.length - 1 ? "현재" : "c" + (i + 1)}: ${s}`));
    }
    return lines.length ? lines.join("\n") : "(레이아웃이 아직 변한 적 없음)";
  } catch {
    return "(git 레이아웃 히스토리 조회 실패 — 현재 상태 기준으로 보수적으로 개선)";
  }
}

async function generateLayout(
  apiKey: string,
  args: {
    currentLayout: SiteLayout | undefined;
    researchNotes: string;
    lens: string;
    layoutHistory: string;
  },
): Promise<{ layout: SiteLayout; changes: string[] } | null> {
  const catalog = renderCatalogForPrompt(args.currentLayout ?? DEFAULT_LAYOUT);
  const basePrompt = `너는 hsol.info 포트폴리오의 **레이아웃 빌더**다. 페이지별 블록 배열(layout)을 만든다.

원칙(중요):
1) **앵커 후 진화**: 위 "현재 레이아웃"을 기준으로 삼아 **통째로 새로 만들지 말고**, 근거 있는 1~3가지 개선만 적용한다. 검증된 골격은 유지한다.
2) **변경은 반드시 있어야 한다**: 이번 회차 리서치에서 얻은 인사이트를 최소 1곳 이상 실제 구성에 반영하라(섹션 순서 조정, 관점별 강조 변경, 선택 블록 포함/제외 등). "사실상 동일"은 실패로 본다. 단, 의미 없는 뒤섞기도 금지 — 개선 이유를 댈 수 있어야 한다.
3) **히스토리 존중(핑퐁 금지·가장 중요)**: 아래 "레이아웃 변화 이력"은 회차별 페이지 블록 순서다(과거→현재, git 기준). 현재 레이아웃은 그 누적 결과다. **이미 과거에 나왔던 순서로 되돌아가지 마라.** 예: c1=[A,B], c2=[B,A], 라면 이번에 다시 [A,B]로 되돌리는 건 왕복(핑퐁)이라 금지. 어떤 페이지가 회차마다 두 배열 사이를 오갔다면 그 페이지는 **이번엔 손대지 말고** 아직 안정적이거나 한 번도 안 바뀐 페이지를 개선하라. 항상 **새로운 전진**(과거에 없던 배열·아직 시도 안 한 방향)만 한다.
4) **가드레일**: 위 [조합 규칙]을 어기지 마라. 페이지 키 고정, 등록된 block type 만, 'raw' 금지, 각 블록은 해당 pages 에서만.
5) props 는 현재 레이아웃의 값을 기본 유지하되, 순서/포함을 바꾸면서 num(§번호)은 보이는 순서에 맞춰 갱신하라.

[레이아웃 변화 이력 — 회차별 블록 순서(과거→현재). 이미 나온 배열로 되돌아가지 말 것]
${args.layoutHistory}

[이번 회차 리서치 메모 — 주제: ${args.lens}]
${args.researchNotes || "(리서치 결과 없음 — 현재 레이아웃을 기준으로 작은 개선만 적용)"}

반드시 ${EMIT_LAYOUT_TOOL_NAME} tool_use 로만 반환한다. layout.pages 의 각 페이지는 { blocks: [{ type, props? }] } 형태다.
changes 에는 무엇을·왜 바꿨는지(어떤 레퍼런스에서 얻었는지) 1~3개를 한국어 한 줄씩 적는다.

${catalog}`;

  let validationHint = "";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const prompt = validationHint
      ? `${basePrompt}\n\n이전 시도 검증 오류:\n${validationHint}\n오류를 고쳐 다시 생성하라.`
      : basePrompt;
    let data;
    try {
      data = await anthropicMessages(apiKey, {
        model: MODEL,
        max_tokens: LAYOUT_MAX_TOKENS,
        messages: [{ role: "user", content: prompt }],
        tools: [
          {
            name: EMIT_LAYOUT_TOOL_NAME,
            description: "현재 레이아웃을 앵커로 점진 개선한 layout 을 반환한다. 일반 텍스트 금지.",
            input_schema: {
              type: "object",
              additionalProperties: true,
              properties: {
                layout: { type: "object" },
                changes: { type: "array", items: { type: "string" } },
              },
              required: ["layout"],
            },
          },
        ],
        tool_choice: { type: "tool", name: EMIT_LAYOUT_TOOL_NAME },
      });
    } catch (error) {
      logStep(`Layout generation request failed (attempt ${attempt}): ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }

    const blocks = data.content ?? [];
    const toolInput = blocks.find(isEmitLayoutToolUseBlock)?.input as
      | { layout?: unknown; changes?: unknown }
      | undefined;
    const rawLayout = normalizeNestedJsonLikeStrings(toolInput?.layout);
    const parsed = layoutSchema.safeParse(rawLayout);
    if (parsed.success) {
      const changes = (Array.isArray(toolInput?.changes) ? (toolInput?.changes as unknown[]) : [])
        .map((c) => String(c).trim())
        .filter(Boolean);
      logStep(`Layout generated (attempt ${attempt}). changes: ${changes.join(" | ") || "(none stated)"}`);
      return { layout: parsed.data, changes };
    }
    validationHint = parsed.error.issues
      .slice(0, 10)
      .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
      .join("\n");
    logStep(`Layout schema validation failed on attempt ${attempt}: ${validationHint}`);
  }
  return null;
}

/** 앵커(기존/DEFAULT) 위에 생성 레이아웃을 페이지 단위로 얹고, 모든 페이지 보장 + 사람 오버라이드 우선. */
function buildFinalLayout(existing: SiteLayout | undefined, generated: SiteLayout | null): SiteLayout {
  const base = existing ?? DEFAULT_LAYOUT;
  const pages: SiteLayout["pages"] = { ...base.pages };
  if (generated?.pages) {
    for (const [key, page] of Object.entries(generated.pages)) {
      if (page) (pages as Record<string, unknown>)[key] = page;
    }
  }
  // 잠긴 페이지가 비면 DEFAULT 로 메운다(폴백 보장).
  for (const key of PAGE_KEYS) {
    if (!pages[key]) pages[key] = DEFAULT_LAYOUT.pages[key];
  }
  const merged = mergeLayout({ pages }, LAYOUT_OVERRIDES);
  return layoutSchema.parse(merged);
}

/** 현재 site-data 텍스트에서 유효한 layout 만 뽑는다(없거나 깨졌으면 undefined). */
function extractExistingLayout(siteDataText: string): SiteLayout | undefined {
  if (!siteDataText) return undefined;
  try {
    const obj = JSON.parse(siteDataText) as { layout?: unknown };
    const parsed = layoutSchema.safeParse(obj.layout);
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

/* ================================================================ */
/* 컴포지션(생성형 컴포넌트-트리) 빌더                                */
/* ================================================================ */

function isEmitCompositionToolUseBlock(
  item: AnthropicContent,
): item is Extract<AnthropicContent, { type?: "tool_use" }> {
  return item.type === "tool_use" && item.name === EMIT_COMPOSITION_TOOL_NAME;
}

/** 현재 site-data 텍스트에서 특정 페이지의 유효한 composition 만 뽑는다(없거나 깨졌으면 undefined). */
function extractExistingComposition(siteDataText: string, page: PageKey): PageComposition | undefined {
  if (!siteDataText) return undefined;
  try {
    const obj = JSON.parse(siteDataText) as { composition?: unknown };
    const parsed = siteCompositionSchema.safeParse(obj.composition);
    if (!parsed.success) return undefined;
    return parsed.data.pages?.[page];
  } catch {
    return undefined;
  }
}

/**
 * 트리 노드를 매니페스트의 component·propsSchema 로 재귀 검증한다.
 * 렌더러는 "잘못된 노드만 스킵"하지만, 빌더 단계에선 어긋남을 모아 재시도 힌트로 돌려준다
 * (생성 품질을 끌어올림). 반환: "path: 이유" 문자열 배열(비면 통과).
 */
function validateCompositionNodes(nodes: ComposeNode[], pathPrefix = ""): string[] {
  const errors: string[] = [];
  nodes.forEach((node, i) => {
    const at = `${pathPrefix}[${i}]${node?.component ? `(${node.component})` : ""}`;
    const entry = COMPOSE_MANIFEST[node.component as keyof typeof COMPOSE_MANIFEST];
    if (!entry) {
      errors.push(`${at}: 미등록 component '${node.component}'`);
      return;
    }
    const parsed = entry.propsSchema.safeParse(node.props ?? {});
    if (!parsed.success) {
      errors.push(
        `${at}: props 오류 — ${parsed.error.issues.map((iss) => `${iss.path.join(".") || "<root>"} ${iss.message}`).join("; ")}`,
      );
    }
    if (node.children?.length) {
      if (!entry.container) {
        errors.push(`${at}: '${node.component}' 는 container 가 아니라 children 을 가질 수 없다`);
      } else {
        errors.push(...validateCompositionNodes(node.children, `${at}.children`));
      }
    }
  });
  return errors;
}

/**
 * 골격 가드레일(강제): persona 페이지는 항상 [Back → ViewHead → ...본문... → CoffeeCTA] 순서.
 * 빌더가 골격 컴포넌트(Back/ViewHead/CoffeeCTA)를 어디에 두든 제거하고 정해진 위치에 다시 박는다.
 * ViewHead 는 페이지의 persona 로 자동 바인딩한다(모든 관점 페이지 맨 앞 고정). 본문 순서는 빌더 자유.
 * CoffeeCTA 는 빌더가 작성한 title/sub 가 있으면 보존한다.
 */
function enforceCompositionSkeleton(page: PageKey, comp: PageComposition): PageComposition {
  const isPersona = ["hire", "collab", "builder", "curious"].includes(page);
  if (!isPersona) return comp;
  // 골격 컴포넌트(Back/ViewHead/CoffeeCTA)는 페이지 프레임이라 트리 어디에 있든(중첩 포함) 떼어내
  // 정해진 위치에만 다시 박는다. CoffeeCTA 는 빌더가 쓴 첫 props(title/sub)를 보존한다.
  let coffee: ComposeNode | undefined;
  const strip = (list: ComposeNode[]): ComposeNode[] => {
    const out: ComposeNode[] = [];
    for (const n of list) {
      if (n.component === "CoffeeCTA") {
        if (!coffee) coffee = n;
        continue;
      }
      if (n.component === "Back" || n.component === "ViewHead") continue;
      out.push(n.children ? { ...n, children: strip(n.children) } : n);
    }
    return out;
  };
  const body = strip(comp.nodes);
  return {
    nodes: [
      { component: "Back" },
      { component: "ViewHead", props: { persona: page } },
      ...body,
      coffee ?? { component: "CoffeeCTA" },
    ],
  };
}

/** 트리의 모든 노드 컴포넌트 이름(중첩 포함, 중복 제거). */
function allComposeComponents(nodes: ComposeNode[]): string[] {
  const out: string[] = [];
  const rec = (list: ComposeNode[]) => {
    for (const n of list) {
      out.push(n.component);
      if (n.children) rec(n.children);
    }
  };
  rec(nodes);
  return [...new Set(out)];
}

/** 형제 관점들의 현재 구성 요약(헤더 + 컴포넌트 팔레트). 빌더가 서로의 존재를 알고 한 사이트처럼 맞추게. */
function siblingCompositionDigest(
  pages: Partial<Record<PageKey, PageComposition>>,
  exclude: PageKey,
): string {
  const others = (Object.keys(pages) as PageKey[]).filter((p) => p !== exclude && pages[p]?.nodes?.length);
  if (!others.length) {
    return "(아직 형제 관점이 없다 — 네가 첫 번째다. 뒤따를 형제들이 맞출 수 있게 명확하고 일관된 헤더 표준을 세워라.)";
  }
  return others
    .map((p) => {
      const comp = pages[p]!;
      const heads = comp.nodes
        .filter((n) => n.component === "Section")
        .map((n) => {
          const x = (n.props ?? {}) as { num?: unknown; title?: unknown; eyebrow?: unknown; meta?: unknown };
          const label = x.title ?? x.eyebrow ?? "";
          return `§${x.num ?? "-"} ${label}${x.meta ? ` (${x.meta})` : ""}`;
        });
      return `[${p}]\n    섹션 헤더: ${heads.join(" / ") || "(없음)"}\n    쓴 컴포넌트: ${allComposeComponents(comp.nodes).join(", ")}`;
    })
    .join("\n");
}

/**
 * 한 페이지의 컴포넌트-트리(composition)를 생성한다 — 앵커 후 진화 + vault 그라운딩 + 골격 가드레일
 * + 형제 관점 인식(서로의 구성을 보고 한 사이트처럼 맞춤).
 * 실패하면 null(호출부에서 기존/blocks 로 폴백). 트리 Zod + 노드별 propsSchema 로 3회까지 재검증.
 */
async function generateComposition(
  apiKey: string,
  args: {
    page: PageKey;
    currentComposition: PageComposition | undefined;
    contextText: string;
    lens: string;
    researchNotes: string;
    siblings: string;
  },
): Promise<{ composition: PageComposition; changes: string[] } | null> {
  const catalog = renderComposeCatalog();
  const anchor = args.currentComposition
    ? JSON.stringify(args.currentComposition, null, 2)
    : "(아직 이 페이지의 composition 이 없음 — 처음 만든다)";
  const personaRole = SITE_STRUCTURE[args.page]?.role ?? `'${args.page}' 페이지`;
  /** 관점별로 특히 잘 맞는 data-bound 컴포넌트 힌트(강제는 아님 — 빌더가 본문 구성을 주도). */
  const DATABOUND_HINT: Partial<Record<PageKey, string>> = {
    hire: "Facts(기본 팩트), Pillars(강점), CareerTimeline(persona:hire), Skills 등이 잘 맞는다.",
    collab: "PillarGrid(source:collab.methods, 일하는 방식), CareerTimeline(persona:collab), Pillars 등이 잘 맞는다.",
    builder: "Skills(스택·도메인), CareerTimeline(persona:builder), Writing(글) 등이 잘 맞는다.",
    curious: "Gantt(인간적 궤적), PillarGrid(source:curious.notes) 등이 잘 맞는다. 따뜻하고 담백하게.",
  };
  const databoundHint = DATABOUND_HINT[args.page] ? `\n이 관점에 잘 맞는 data-bound: ${DATABOUND_HINT[args.page]}` : "";

  const basePrompt = `너는 hsol.info 포트폴리오의 **컴포지션 빌더**다. '${args.page}' 페이지를 디자인시스템 컴포넌트의 **트리**로 조합하고, content 컴포넌트의 내용을 **vault 근거로 직접 작성**한다.

페이지 성격: ${personaRole}${databoundHint}

원칙(중요):
1) **앵커 후 진화**: 아래 "현재 composition"이 있으면 그것을 기준으로 통째로 갈아엎지 말고 근거 있는 1~3가지 개선만 적용한다. 없으면 페이지 성격에 맞게 새로 구성한다.
2) **카탈로그 안에서만**: [컴포넌트 카탈로그]의 component 만 쓴다. container 만 children 을 가진다. data-bound 컴포넌트는 배치만(내용은 site-data 에서 자동) — props 로 내용을 지어내지 마라.
3) **vault 그라운딩(필수)**: content 컴포넌트(Prose/Callout/CardGrid/MetricGrid/ChipList/Quote/KeyValueList/LinkList/Heading)의 내용은 아래 [참조 vault 컨텍스트]에 실제로 있는 사실·고유명사·기간·수치로만 쓴다. 문서 밖 추측·새 수치·과장 금지. 애매하면 항목 수를 줄인다.
   - **"블로그" 용어 규칙**: 그냥 "블로그"는 **현행 Medium(medium.com/@hsol)**을 가리킨다. 한솔닷컴(Tistory)은 **deprecated 아카이브**다. 블로그를 한 항목으로 보여줄 때는 현행 Medium 을 대표로 쓰고, 티스토리는 "아카이브"로만 표기한다(현행처럼 쓰지 마라). Medium 을 빠뜨리지 마라.
4) **고정 골격(시스템이 자동 배치 — 다시 만들지 마라)**: 이 페이지엔 네 본문 말고도 다음이 **이미 고정으로** 들어간다. 인지하고 중복하지 마라.
   - 맨 위 **Back 바**(뒤로가기 + 언어 토글).
   - 그다음 **ViewHead**: GRID 좌표 + 페이지 **큰 제목**과 **lede 한두 줄 소개**(viewHeaders[persona]에서 자동). → 본문 첫 섹션에서 같은 제목·자기소개를 되풀이하지 마라.
   - 맨 끝 **CoffeeCTA**: 'Coffee chat — 30 min' **커피챗 예약 카드(Calendly)**. 즉 연락·마무리 CTA가 이미 끝에 있다. → **'연락 / Contact / 커피챗 / 대화 나눠요' 같은 마무리·연락 섹션을 따로 만들지 마라(중복이다).**
   너는 ViewHead 와 CoffeeCTA **사이의 본문만** 짠다.
5) **문체(한국어)**: 서술형 줄글은 존댓말(~합니다/~입니다). 첫 문장을 "저는/임한솔은" 같은 1인칭·이름 고정 템플릿으로 시작하지 않는다. AI 티 특수문자(엠대시 —, 말줄임표 …, 곡선따옴표) 금지 — 하이픈·마침표·곧은따옴표만.
6) **형제 관점과 협업(매우 중요)**: 너는 혼자가 아니다. 아래 [형제 관점들의 현재 구성]에 다른 관점 페이지들이 어떻게 만들어졌는지 있다. **한 사람이 만든 한 사이트**처럼 보이도록 형제들과 맞춰라 — 섹션 헤더의 워딩·형식(한국어/영문 제목 여부, 번호, 영문 kicker 등), 컴포넌트 쓰는 습관, 톤. 한쪽은 영문 제목·다른 쪽은 한글 제목처럼 따로 노는 건 금지. 단 베끼지 말고 내용·강조·순서는 이 관점에 맞게 다르게. (형제가 아직 없으면 네가 기준이 되어 명확하고 일관된 헤더 표준을 세운다.)
7) **기술/스택은 '범위 신호'로만(헤드라인 금지)**: 기술 나열이 한 사람을 'X·Y·Z 밖에 못 하는 사람'으로 축소시키면 안 된다(12년차 엔지니어→대표·팀장 포지셔닝과 충돌).
   - **회사별·시기별로 기술을 쪼개 나열 금지**(예: "토스: Django, Flask, React" 식). 한정돼 보인다.
   - 스택은 **통합해 한 번만**(프로그래밍 언어 + 핵심 프레임워크), 그것도 **builder 관점에서만** 구체적으로(Skills). hire 는 가볍게, **collab·curious 는 기술 나열 섹션을 두지 말고** 역량·도메인·만든 것으로 대체.
   - 헤드라인은 **'무엇을 끝까지 책임질 수 있는가'(역량·도메인·임팩트)**. 기술은 그 보조 신호일 뿐.
8) **이력서 진입점(ResumeCTA)**: 이력서·포트폴리오 원페이저(/resume)로 보내는 ResumeCTA 컴포넌트가 있다. **hire(채용) 관점에는 반드시 포함**해 PDF 이력서 진입점을 제공하라(보통 경력/하이라이트 근처나 본문 말미). collab·builder 도 적절하면 넣고, curious 는 선택.
   - **Divider 는 한 섹션 안(children)에서 묶음을 나눌 때만** 쓴다. **섹션과 섹션 사이(최상위)에 Divider 를 넣지 마라** — 섹션은 이미 충분히 떨어진다(중복·노이즈).
9) **변화는 있어야**: 이번 회차 리서치 인사이트를 최소 1곳 구성에 반영하라(섹션 추가/순서/강조). 단 의미 없는 뒤섞기 금지.
10) **레퍼런스는 링크로(중요)**: 본문이 가리키는 대상에 [참조 vault 컨텍스트]·data-bound 데이터에 **정식 URL 이 있으면 평문으로 두지 말고 클릭 가능한 링크로 건다**. 링크 수단은 LinkList(items[{label,href}]) 또는 CardGrid(items[{title,body,href}]) 의 href, 그리고 글·출판물은 data-bound Writing(자동 링크). **Prose 는 링크를 담지 못한다** — Prose 안에 URL 을 글자로 적지 말고, 링크가 필요한 항목은 위 컴포넌트로 올려라. URL 은 컨텍스트/데이터에 실제 있는 것만 쓰고 지어내지 않는다. 출처·조회 과정·저장소 이름을 드러내지 말라는 규칙은 '공개 가능한 정식 URL 링크'까지 금지하는 게 아니다(글·뉴스레터·출판물·외부 사이트의 공개 링크는 오히려 적극적으로 건다).

[이번 회차 리서치 메모 — 주제: ${args.lens}]
${args.researchNotes || "(리서치 없음 — 현재 구성을 기준으로 작은 개선만)"}

반드시 ${EMIT_COMPOSITION_TOOL_NAME} tool_use 로만 반환한다.
- composition: { "nodes": [ ...노드 ] } (이 페이지의 트리)
- changes: 무엇을·왜 바꿨는지(어떤 근거에서) 1~3개를 한국어 한 줄씩.

${catalog}

[형제 관점들의 현재 구성 — 한 사이트의 다른 방들. 한 사람이 만든 것처럼 형식·워딩·톤을 맞춰라]
${args.siblings}

[현재 composition — 앵커]
${anchor}

[참조 vault 컨텍스트]
${args.contextText}`;

  let validationHint = "";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const prompt = validationHint
      ? `${basePrompt}\n\n이전 시도 검증 오류:\n${validationHint}\n오류를 고쳐 다시 생성하라.`
      : basePrompt;
    let data;
    try {
      data = await anthropicMessages(apiKey, {
        model: MODEL,
        max_tokens: COMPOSITION_MAX_TOKENS,
        messages: [{ role: "user", content: prompt }],
        tools: [
          {
            name: EMIT_COMPOSITION_TOOL_NAME,
            description: "디자인시스템 컴포넌트 트리(composition)와 changes 를 반환한다. 일반 텍스트 금지.",
            input_schema: {
              type: "object",
              additionalProperties: true,
              properties: {
                composition: { type: "object" },
                changes: { type: "array", items: { type: "string" } },
              },
              required: ["composition"],
            },
          },
        ],
        tool_choice: { type: "tool", name: EMIT_COMPOSITION_TOOL_NAME },
      });
    } catch (error) {
      logStep(`Composition generation request failed (attempt ${attempt}): ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }

    const blocks = data.content ?? [];
    const toolInput = blocks.find(isEmitCompositionToolUseBlock)?.input as
      | { composition?: unknown; changes?: unknown }
      | undefined;
    const rawComposition = normalizeNestedJsonLikeStrings(toolInput?.composition);
    const parsed = pageCompositionSchema.safeParse(rawComposition);
    if (parsed.success) {
      const nodeErrors = validateCompositionNodes(parsed.data.nodes);
      if (nodeErrors.length === 0) {
        const changes = (Array.isArray(toolInput?.changes) ? (toolInput?.changes as unknown[]) : [])
          .map((c) => String(c).trim())
          .filter(Boolean);
        logStep(`Composition generated for '${args.page}' (attempt ${attempt}). changes: ${changes.join(" | ") || "(none stated)"}`);
        return { composition: parsed.data, changes };
      }
      validationHint = nodeErrors.slice(0, 12).join("\n");
      logStep(`Composition node validation failed on attempt ${attempt} (${args.page}): ${validationHint}`);
      continue;
    }
    validationHint = parsed.error.issues
      .slice(0, 10)
      .map((iss) => `${iss.path.join(".") || "<root>"}: ${iss.message}`)
      .join("\n");
    logStep(`Composition schema validation failed on attempt ${attempt} (${args.page}): ${validationHint}`);
  }
  return null;
}

/** 원페이저 디자인·콘텐츠 지침(리서치 근거: Harvard FAS / MIT CAPD / Laszlo Bock / NN-g / MDN). */
const ONEPAGER_DESIGN_SPEC = `
[원페이저 산출물 정의]
임한솔의 "이력서 + 포트폴리오(원페이저)"를 자기완결형 HTML 조각으로 만든다. 한국어.
채용 담당자·잠재 협업자가 빠르게 핵심을 파악하면서도, "보기 좋은 편집 디자인"이라는 인상을 받게 한다.

[선정 기준 — 가장 중요(모든 내용에 적용)]
- 단 하나의 잣대: **"돈을 벌었는가, 또는 그에 준하는 사업 가치를 창출했는가."** 매출·마진·비용 절감·자금 확보(투자/지원금)·핵심 지표 개선처럼 사업 가치로 환산되는 것만 성과·대표 사례로 올린다.
- **본인 기여 한정(필수)**: 성과·임팩트는 임한솔이 **직접 설계·개발·주도해 만든 것**만 쓴다. 회사 전체 결과나 본인이 주도하지 않은 것(예: 법적 분쟁/소송 승소, 법무·타 팀이 한 일, 회사가 받은 성과)은 본인 성과로 쓰지 않는다. 본인이 만든 기여가 분명한 부분(예: 시스템 재설계로 인한 효율·매출·마진 개선)만 담는다. 어떤 사실이 본인 기여인지 애매하면 빼라.
- **법적 분쟁/소송 결과는 어느 섹션에도 적지 않는다**(핵심 성과·경력·프로젝트 설명·요약 전부). "부수적으로 소송 리스크 해소/승소" 같은 곁가지 언급도 금지. 본인이 한 일(예: 구매예약 구조로 사업모델 재설계, 매장 역할 명확화)만 적고, 그로 인한 소송·법적 결과는 언급하지 않는다.
- **성과가 아닌 것(제외)**: 블로그/뉴스레터 편수, 책 출간, 발표/강연 횟수, 팔로워·조회수, 개인 사이드 프로젝트(포트폴리오 사이트 hsol.info 등), 단순 활동·참여 이력. 이런 건 "성과" 섹션에 넣지 않는다(필요하면 맨 뒤에 부가 정보로만, 성과처럼 포장하지 말 것).
- **없으면 비운다**: vault에 위 기준을 충족하는 근거가 부족하면 항목 수를 줄인다. 빈약해 보여도 괜찮다 — 없는 것을 있는 것처럼 부풀리거나 약한 활동을 성과로 둔갑시키지 않는다.

[출력 형식 — 반드시 지킬 것]
- 최상위 단일 루트 <article class="onepager"> ... </article> 하나만 반환한다. 앞뒤에 <!doctype>·<html>·<head>·<body> 를 붙이지 않는다(조각이다).
- 그 안 맨 앞에 <style> 블록 하나를 둔다. 모든 셀렉터는 반드시 .onepager 하위로 스코프한다(전역 오염 금지).
- <style> 안에 인쇄 페이지 규칙을 포함한다: @page { size: A4; margin: 14mm; } 그리고 .onepager 에 print-color-adjust: exact; -webkit-print-color-adjust: exact; 를 준다.
- 외부 리소스 금지(웹폰트 <link>, <img src>, <script> 등 금지). 폰트는 시스템 한글 스택만: font-family: -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", "Noto Sans CJK KR", sans-serif;
- 사진·생년월일·주민번호·상세 주소는 넣지 않는다(글로벌·블라인드 안전 기본값).

[분량·페이지·여백(확정값 — 그대로 따를 것)]
- A4 폭 기준. 여러 장이 되어도 좋다(욱여넣지 말 것). 대신 내용은 큐레이션해 군더더기 없이.
- **여백은 한 곳에서만** 준다(이중 여백 금지): @page { size: A4; margin: 0; } 로 두고, .onepager 에 width: 210mm; box-sizing: border-box; margin: 0 auto; padding: 20mm 18mm; 를 준다 → 실제 여백 **상하 20mm · 좌우 18mm**. (.onepager 에 max-width 182mm 같은 좁은 시트/별도 @page margin 을 같이 쓰지 말 것.)
- 각 경력·프로젝트 항목과 각 섹션 블록에 break-inside: avoid; 를 주어 페이지 경계에서 항목이 잘리지 않게 한다.

[세로 리듬(확정 위계 — 그대로 따를 것)]
- **섹션 간 24px : 섹션 내 항목 간 8px : 섹션 라벨↔본문 7px.** 섹션 간이 항목 간의 2배 이상이어야 그룹이 또렷하다(근접성 원리). 예: .op-section{margin-bottom:24px} / 항목 리스트 gap:8px / 섹션 라벨 margin-bottom:7px.
- 본문 line-height 1.5 이상. "촘촘한 워드 문서"가 아니라 "여백이 살아있는 편집물"로.

[타이포·심미 — 중요(워드 문서 느낌 탈피)]
- F자 스캔: 상단에 이름·직함·한 줄 포지셔닝. 직무 타이틀은 굵게, 헤딩 좌측 정렬, 불릿은 정량 임팩트를 앞에.
- 명확한 위계: 이름 22~28pt 굵게 + 영문 보조. 섹션 라벨은 작게(10~11pt) 자간 약간 넓힌 소형 대문자 + 얇은 구분선이나 컬러 악센트로 절제되게. 본문 10.5~11.5pt.
- 절제된 컬러 시스템: 잉크(거의 검정 #1b1b1b), 보조 회색(#5a5a5a), 악센트 1색(딥 블루 #1f5e80~#287099 계열)은 1~2곳에만. 과한 색·과한 굵기 금지.
- 표/박스 테두리로 칸을 나누는 "양식지" 느낌을 피한다. 구분은 여백과 얇은 헤어라인(1px 연한 회색/악센트)으로.
- 스킬은 칩(둥근 모서리, 연한 배경) 또는 깔끔한 인라인 나열. 상단 헤더는 좌(이름·포지셔닝)/우(연락처)로 균형 있게.
- **경력·프로젝트 항목 헤더는 좌·우 2분할만(3분할 가운데 띄우기 금지)**: 왼쪽에 정보 묶음(경력 = 회사 + 직책 나란히 / 프로젝트 = 프로젝트명), 오른쪽에 메타(경력 = 기간 / 프로젝트 = 소속 회사). 구현은 display:flex; justify-content:flex-start; align-items:baseline; gap:8px 에 **오른쪽 메타만 margin-left:auto** 로 민다. justify-content:space-between 으로 3요소를 펼쳐 직책/메타가 가운데 뜨게 하지 말 것(불안정해 보임).
- 인쇄용 흰 배경 + 짙은 잉크. 정렬·간격을 일관된 그리드로. 차분하고 신뢰감 있는 톤(채용·자문 대상).

[내용 구조(중요도 순)]
1) 헤더: 이름(임한솔 / Hansol Lim), 현재 직함, 연락 수단(이메일·LinkedIn·hsol.info·회사 링크).
2) 2~4문장 요약/포지셔닝: 한 줄 정의 + 강점 + 타깃 독자.
3) 핵심 성과 2~5개 — 반드시 위 [선정 기준]을 통과한 것만(돈·사업 가치). 정량 우선. 기준 미달이면 개수를 줄인다.
4) 선별 경력(역시간순, 경력-타임라인 근거: CNT-Tech -> RIDI -> Toss(5년) -> Antler/라이트형제 -> Proofer/PPB-Studios). 각 항목 조직·직함·기간 + 1~3개 임팩트 불릿(역시 사업 가치 중심).
5) 핵심 역량 & 기술 스택.
   - 역량: 사고·전략 계열(Strategic/Design/Product-Thinking, Customer-Centricity 등 concepts)과 도메인.
   - 기술 스택: **현재/과거로 나누지 말고 하나의 묶음**으로 제시한다(관련도·숙련도 순으로 배열, "현재/과거" 라벨 금지).
   - 스택의 정의 = **프로그래밍 언어 + 핵심 기술 프레임워크 + 데이터베이스**만. 예: 언어(TypeScript/JavaScript, Python, Java, PHP), 프레임워크(React, Next.js, Node.js, Nest, Spring, Django, Flask, ASP.NET), DB(PostgreSQL, MySQL).
   - **스택에서 제외**: UI 라이브러리·디자인 시스템(Mantine 등), 에디터·생산성 도구(Claude Code, Linear, Notion 등), 인프라 서비스명, 방법론. 이런 건 스택 칩에 넣지 않는다(필요하면 도구/역량 쪽에 따로). 대표적이고 의미 있는 것만 추린다.
6) 대표 프로젝트 — **회사당 1~2개**가 원칙이다. 선정 기준: (a) 위 [선정 기준](돈/사업 가치·본인 기여)을 가장 잘 보여주고 (b) 회사별로 가장 대표성 있는 것 하나. **같은 회사에서 3개 이상 나열하지 않는다**(예: PPB에서 윙크2·통합리팩토링·AI전환을 다 넣지 말고, 가장 임팩트 큰 프로젝트로 합치거나 대표 프로젝트만). 서로 다른 회사로 **3~5개**를 골라 경력 전반(PPB·프루퍼·Toss·RIDI/CNT 등)을 다양하게 대표하게 한다. 개인 사이드 프로젝트(hsol.info 포트폴리오·책·개인 뉴스레터 등)는 제외. 각 프로젝트는 소속 회사·역할·**사업 임팩트(돈/가치)**를 드러낸다. 회사가 많아도 억지로 채우지 말고, 대표성·가치 기준을 통과한 것만.
7) 학력·자격·언어.

[문체 — 중요(한국식 존댓말)]
- 서술형 문장(요약·포지셔닝 문단, 프로젝트 설명 등 "문장으로 읽히는" 부분)은 **존댓말 "~합니다/~입니다"** 로 쓴다. "~다/~임/~함" 같은 평서·개조식 종결을 서술 문장에 쓰지 않는다.
- 단, **정량 데이터·항목 나열형 불릿**(핵심 성과·경력 임팩트 불릿처럼 사실·수치 위주로 짧게 끊는 부분)은 개조식(명사·동사 어간 종결, 예: "...로 단축", "...설계", "...승소")로 간결하게 둬도 된다. 즉 줄글은 존댓말, 팩트 불릿은 개조식.

[사실·표기 규칙]
- 불릿은 핵심을 앞에, 1~2줄. XYZ("X를 Y만큼, Z로 달성")/PAR 패턴. 가능하면 정량화. 1인칭 대명사 금지.
- vault 컨텍스트에 실제로 있는 사실·고유명사·기간·수치만 쓴다. 문서 밖 추측·새 수치·과장 금지. 애매하면 보수적으로 기존을 유지.
- 포장 금지: 약한 활동을 강한 성과처럼 쓰지 않는다. 수식어로 부풀리지 말고, 사업 가치가 분명한 사실만 담담하게.
- **역할 정확히(PPB 인수 서술 금지)**: 피피비스튜디오스(PPB-Studios)에서 임한솔의 역할은 **플랫폼팀 팀장**, 그것 하나다. 임한솔을 **PPB의 인수자·인수창업자로 서술하지 않는다.** 다음 같은 표현을 요약·경력·프로젝트 어디에도 쓰지 마라: "서치펀드 기반 인수창업(PPB-Studios)", "PPB를 인수창업", "(인수창업/서치펀드)" 라벨 등 — 임한솔이 PPB를 인수했다고 읽히는 모든 표현. 서치펀드·M&A 경험은 **본인 역량/도메인**(예: "서치펀드·M&A 실사 경험")으로만 표현하고, PPB의 인수 주체로 본인을 적지 않는다. 다른 조직도 vault에 적힌 실제 직함·관계만 쓴다(과대 표기 금지).
- AI 티 특수문자(엠대시 — 말줄임표 ... 곡선따옴표) 금지. 하이픈·마침표·곧은따옴표만 쓴다.
`.trim();

function isEmitOnePagerToolUseBlock(
  item: AnthropicContent,
): item is Extract<AnthropicContent, { type?: "tool_use" }> {
  return item.type === "tool_use" && item.name === EMIT_ONEPAGER_TOOL_NAME;
}

async function getExistingOnePagerHtml(): Promise<string> {
  try {
    return await readFile(ONEPAGER_HTML_PATH, "utf8");
  } catch {
    return "";
  }
}

/** 원페이저 근거 컨텍스트: 척추(큐레이트 뷰) + objects/{projects,organizations,concepts,artifacts}/*.md 글롭. */
async function loadOnePagerContext(changedVaultFiles: string[]): Promise<string> {
  const objectFiles: string[] = [];
  for (const dir of ONEPAGER_OBJECT_DIRS) {
    const absDir = `${VAULT_ROOT}/objects/${dir}`;
    try {
      const entries = await readdir(absDir);
      for (const entry of entries) {
        if (entry.endsWith(".md")) objectFiles.push(`${absDir}/${entry}`);
      }
    } catch {
      // 디렉터리 없음 → 건너뜀
    }
  }
  const highPriorityFiles = [
    ...ONEPAGER_SPINE_FILES,
    ...changedVaultFiles.map((relativePath) => toVaultContextPath(relativePath)),
  ];
  return loadContextFiles({ highPriorityFiles, regularFiles: objectFiles });
}

/**
 * 원페이저 HTML 을 생성한다. 기존 버전이 있으면 **먼저 KEEP/PATCH/OVERHAUL 을 판단**(안정성 우선),
 * 기본 편향은 KEEP/PATCH. 실패 시 null(호출부에서 기존 보존).
 */
async function generateOnePager(
  apiKey: string,
  args: { contextText: string; currentHtml: string; researchNotes: string; lens: string },
): Promise<{ html: string; mode: string; changes: string[] } | null> {
  const hasCurrent = args.currentHtml.trim().length > 0;
  const stabilityRule = hasCurrent
    ? `[안정성 우선 판단 — 가장 중요]
이미 발행된 원페이저가 아래 "현재 원페이저 HTML"에 있다. 채용 담당·협업자가 볼 때마다 문서가 달라지면 신뢰가 떨어진다. 먼저 mode 를 정하라.
- KEEP: 이번 vault 변경이 원페이저에 영향이 없음. 현재 HTML 을 그대로 둔다(html 필드는 무시되니 현재 내용을 그대로 넣어도 된다). changes 에 유지 이유 한 줄.
- PATCH(기본): 바뀐 사실·중대한 결함만 국소 수정한다. 구조·섹션 순서·문체·전체 톤·나머지 마크업은 그대로 보존하고, 불필요한 재배열·재작성은 하지 않는다.
- OVERHAUL: 구조적 재작성. vault 사실이 대폭 바뀌었거나 현재 버전에 중대한 결함이 있을 때만. 사유를 changes 에 분명히 적는다.
의심스러우면 PATCH 다.

현재 원페이저 HTML:
${args.currentHtml}`
    : `[첫 생성] 기존 원페이저가 없다. 위 정의·근거로 처음부터 작성하라. mode 는 "NEW".`;

  const basePrompt = `너는 임한솔의 이력서/포트폴리오 원페이저를 만드는 빌더다.

${ONEPAGER_DESIGN_SPEC}

${stabilityRule}

[이번 회차 디자인 참고 메모(선택)]
${args.researchNotes || "(없음 — 위 지침과 현재 버전을 기준으로)"}

[근거가 되는 vault 온톨로지 컨텍스트 — 이 안의 사실만 쓴다]
${args.contextText}

반드시 ${EMIT_ONEPAGER_TOOL_NAME} tool_use 로만 반환한다. html 은 <article class="onepager">로 시작하는 자기완결형 조각, mode 는 KEEP/PATCH/OVERHAUL/NEW 중 하나, changes 는 무엇을·왜 바꿨는지 한국어 한 줄씩.`;

  let validationHint = "";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const prompt = validationHint
      ? `${basePrompt}\n\n이전 시도 문제:\n${validationHint}\n위 문제를 고쳐 다시 생성하라.`
      : basePrompt;
    let data;
    try {
      data = await anthropicMessages(apiKey, {
        model: MODEL,
        max_tokens: ONEPAGER_MAX_TOKENS,
        messages: [{ role: "user", content: prompt }],
        tools: [
          {
            name: EMIT_ONEPAGER_TOOL_NAME,
            description: "원페이저 HTML 조각을 반환한다(안정성 우선 판단 포함). 일반 텍스트 금지.",
            input_schema: {
              type: "object",
              additionalProperties: true,
              properties: {
                html: { type: "string" },
                mode: { type: "string", enum: ["KEEP", "PATCH", "OVERHAUL", "NEW"] },
                changes: { type: "array", items: { type: "string" } },
              },
              required: ["html", "mode"],
            },
          },
        ],
        tool_choice: { type: "tool", name: EMIT_ONEPAGER_TOOL_NAME },
      });
    } catch (error) {
      logStep(`One-pager request failed (attempt ${attempt}): ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }

    const toolInput = (data.content ?? []).find(isEmitOnePagerToolUseBlock)?.input as
      | { html?: unknown; mode?: unknown; changes?: unknown }
      | undefined;
    const html = typeof toolInput?.html === "string" ? toolInput.html : "";
    const mode = typeof toolInput?.mode === "string" ? toolInput.mode : hasCurrent ? "PATCH" : "NEW";
    const changes = (Array.isArray(toolInput?.changes) ? (toolInput?.changes as unknown[]) : [])
      .map((c) => String(c).trim())
      .filter(Boolean);

    if (mode === "KEEP" && hasCurrent) {
      logStep(`One-pager KEEP (attempt ${attempt}): ${changes.join(" | ") || "(이유 없음)"}`);
      return { html: args.currentHtml, mode, changes: changes.length ? changes : ["변경 없음(KEEP)"] };
    }

    const problems: string[] = [];
    if (html.length < 800) problems.push("html 이 비었거나 너무 짧다(800자 미만).");
    if (!html.includes("임한솔")) problems.push("html 에 '임한솔' 이 없다.");
    if (!/<style[\s>]/i.test(html)) problems.push("inline <style> 가 없다.");
    if (!/@page/i.test(html)) problems.push("@page A4 규칙이 없다.");
    if (!/class\s*=\s*["']onepager/i.test(html)) problems.push('루트가 <article class="onepager"> 가 아니다.');
    if (problems.length === 0) {
      logStep(`One-pager generated (attempt ${attempt}, mode=${mode}). changes: ${changes.join(" | ") || "(none)"}`);
      return { html, mode, changes };
    }
    validationHint = problems.join("\n");
    logStep(`One-pager validation failed on attempt ${attempt}: ${validationHint}`);
  }
  return null;
}

async function main() {
  logStep("Refresh started.");
  // AI Gateway 인증: 로컬은 AI_GATEWAY_API_KEY 또는 VERCEL_OIDC_TOKEN, CI/배포는 OIDC 자동.
  // apiKey 변수는 하위 호출부 시그니처 호환을 위한 마커일 뿐(실제 인증은 Gateway가 처리).
  const apiKey = process.env.AI_GATEWAY_API_KEY ?? process.env.VERCEL_OIDC_TOKEN ?? "";
  if (!apiKey) {
    throw new Error("Missing AI Gateway 인증 — AI_GATEWAY_API_KEY 또는 VERCEL_OIDC_TOKEN 필요 (OIDC는 `vercel env pull` 로 갱신)");
  }

  const { text: currentSiteDataText, exists: hasExistingSiteData } = await getExistingSiteDataText();
  const vaultChange = await detectVaultChange();
  const changedVaultFiles = vaultChange.files;
  const forceRefresh = isForceRefresh();
  if (forceRefresh) {
    logStep("Force refresh: vault change guard skipped.");
  }
  // vault(서브모듈 hsol-info-blob) 포인터가 안 바뀐 코드-only 푸시에선 스킵 → site-data 유지.
  if (hasExistingSiteData && !vaultChange.changed && !forceRefresh) {
    logStep("No vault change (hsol-info-blob submodule pointer unchanged). Keep existing site-data as-is.");
    return;
  }

  if (!hasExistingSiteData) {
    logStep("site-data.json not found. Rebuilding from vault README baseline.");
  } else {
    logStep(`Vault changed. Changed file hints: ${changedVaultFiles.length}`);
  }

  const contextText = !hasExistingSiteData
    ? await loadContextFiles({
        highPriorityFiles: [VAULT_README_PATH],
        regularFiles: BASE_CONTEXT_FILES,
      })
    : changedVaultFiles.length > 0
      ? await loadContextFiles({
          highPriorityFiles: changedVaultFiles.map((relativePath) =>
            toVaultContextPath(relativePath),
          ),
          regularFiles: [VAULT_README_PATH, ...BASE_CONTEXT_FILES],
        })
      : await loadContextFilesLegacy();
  logStep("Context loaded.");

  const basePrompt = `
너는 vault 내용을 읽고 site-data.json을 갱신하는 데이터 편집기다.

규칙:
1) 반드시 ${EMIT_TOOL_NAME} tool_use로만 결과를 반환한다. 일반 텍스트 답변 금지.
2) 출력 JSON은 스키마와 동일한 최상위 키·형태를 유지한다(루트 래핑 금지). 필드 키는 템플릿과 1:1(번역·이름 변경 금지). room·coord 등 템플릿 고정 UI 메타는 바꾸지 않는다.
3) 근거·우선순위: [HIGH_PRIORITY_CONTEXT]를 최우선. 아래 [참조 vault 컨텍스트]에 실제로 나온 내용으로만 사실·고유명사·기간을 뒷받침하고, 증거 없는 추측·새 주장·새 수치는 넣지 않는다. 애매하면 기존 site-data 값을 유지한다. 한국어 톤은 같은 세션에 포함된 작문 가이드에 맞추고, 빈 수식어 남용은 피한다.
   산문 문체(전역, 필수): 자기소개서·AI 생성체 티를 피한다. **site-data 안 방문자 노출 한국어 서술 전반**에 동일 적용한다 — 예: portfolioCopy.* 의 문단·줄글·blurb·body·coffee·ask 문구, viewHeaders.*.lede, faq[].a, career.points 각 줄(서술형일 때), publications.desc 등. 문단·줄글의 **첫 문장**은 "저는 임한솔로", "저는 ~로", "임한솔은", "한솔은", "본인은", "저는 ~입니다/저는 ~한 사람입니다" 같은 이름·1인칭 고정 템플릿으로 시작하지 않는다. 같은 필드(또는 인접한 짧은 블록) 안에서 그 패턴은 **최대 0~1회**이고, **연속 두 문장 모두 1인칭 주어(저/본인/이름)로 시작**하지 않는다. 대신 역할·맥락·행동·장면·독자 관점으로 들어간다(동사·명사구 시작, "~에서 ~를 맡으며", "채용 담당자 입장에서는" 등). 본인 이름은 꼭 필요할 때만·**한 번**·뒤쪽 문장에 정보 전달용으로. 과한 격식("~하오니", "~드리고자")·과한 수사("진심으로", "크게 자랑스럽게")·빈번한 "결국/또한/즉" 나열체는 피한다. AI가 흔히 쓰는 특수문자(엠대시 —, 엔대시 –, 말줄임표 문자 …, 곡선 따옴표 “ ” ‘ ’)는 쓰지 않고, 하이픈(-)·마침표·쉼표·괄호·곧은따옴표만 쓴다.
4) portfolioCopy.home 의 builtTitle~builtPerspectives: 이 프롬프트에 실린 hsol.info 프로젝트 설명·소개 백데이터를 1차 근거로 하고, 구현·데이터 흐름·운영 방식만 요약한다(문서 밖 주장·수치 금지). builtCards는 3개 이상·제목 중복 없이 목표/흐름/신뢰성/경험 설계 성격. builtFlow는 3단계 이상·한 줄로 읽히는 순서. builtMermaid는 mermaid flowchart LR, 노드 4개 이상·화살표 포함, statement는 ';'로 구분, 라벨은 단순 텍스트·라벨에 "\\n" 금지. builtPerspectives는 소개 백데이터 8관점 중 서로 다른 4개를 title/summary로 압축. builtBody·builtCards.body·builtPerspective summary 등 서술형 문장은 규칙 3 **산문 문체(전역)** 를 따른다.
5) 페르소나(hire/collab/builder/curious): portfolioCopy 쪽 timelineIntro는 필수. 문단은 JSON에서 \\n\\n. (1) 한 줄 포지셔닝 (2) 기관·역할·기간·도메인 등 구체를 최소 2곳 이상 녹인 근거 (3) 타임라인으로 자연스럽게 이어지는 마무리. hire/collab/builder/curious 각각 채용·협업·동료 빌더·인간 궤적 독자에 맞는 설득 축을 분명히 한다. viewHeaders의 titleLines·lede는 같은 근거로 timelineIntro와 모순 없이 짝을 이루게(lede는 1~2문장 첫인상, 서사는 timelineIntro). collab 방법론·curious 노트 등 몸통 블러브도 동일 근거·항목마다 다른 각도로 배치한다. timelineIntro·lede·위 필드들은 규칙 3의 **산문 문체(전역)** 를 반드시 따른다.
6) career[i].points는 항목당 3개 이상 5개 이하로 유지한다(빈 bullet 금지).
7) career[i].tier: 키는 personas[].key 와 정확히 일치·값은 양의 정수(1=기본 펼침, 2+=접힘). 관점별로 의미 있게 차등하고, 네 관점 전부 동일 중요도가 아니면 숫자만 복붙하지 않는다.
8) 외부 링크(href) — 역할을 이해하고 스스로 판단: href 는 "방문자가 그 항목의 실제 대상으로 바로 갈 수 있게 하는 링크"다(글이면 원문, 뉴스레터·출판물이면 공식 소개·구매·구독 페이지, 외부 자료면 그 사이트). href 를 가질 수 있는 항목(글·뉴스레터·출판물처럼 외부에 공개된 대상을 가리키는 것)을 다룰 때, [참조 vault 컨텍스트]에 그 항목을 가리키는 **공개된 정식 URL** 이 있고 방문자가 눌러볼 만하다고 판단되면 **항목별 지시를 기다리지 말고 스스로 href 에 채운다** — href 의 의도를 알고 적용하는 것이지, 정해준 항목만 채우는 게 아니다. 단 (a) 컨텍스트에 실제로 있는 URL 만 쓰고 추측·생성 금지 (b) 후보가 여럿이면 가장 정식·현행인 것 하나 (c) 확실한 URL 이 없으면 href 를 비우고, 기존 href 는 더 정확한 게 없는 한 유지한다. URL 을 본문 글자로만 적고(예: "medium.com/...") href 를 비우지 말 것 — 글자 URL 대신 href 로 넣어 클릭 가능하게 한다.

키 구조 템플릿(키 이름 고정 참고용):
${SITE_DATA_TEMPLATE}

현재 site-data.json:
${currentSiteDataText || "[MISSING]"}

참조 vault 컨텍스트:
${contextText}
`.trim();

  let initialResponse = "";
  let lastCandidate = "";
  let validationHint = "";
  let siteData: SiteData | null = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const prompt = validationHint
      ? `${basePrompt}\n\n이전 시도 검증 오류:\n${validationHint}\n오류를 반영해 다시 생성하라.`
      : basePrompt;

    const { text, toolInput, stopReason } = await requestAnthropicStructured(apiKey, prompt);
    if (!initialResponse) initialResponse = text || JSON.stringify(toolInput, null, 2);
    if (stopReason === "max_tokens") {
      const err = new Error(
        `Anthropic output was truncated (stop_reason=max_tokens, max_tokens=${MAX_TOKENS}).`,
      );
      await writeFailureDump({
        stage: "truncated-max-tokens",
        initialResponse,
        lastCandidate: text || JSON.stringify(toolInput, null, 2),
        error: err,
      });
      throw err;
    }

    let parsed: unknown;
    if (toolInput != null) {
      parsed = toolInput;
      lastCandidate = JSON.stringify(toolInput, null, 2);
    } else {
      lastCandidate = text;
      parsed = parseJsonWithFallback(text);
    }

    const normalizedParsed = normalizeNestedJsonLikeStrings(parsed);
    const coercedParsed = coerceSiteDataCandidate(normalizedParsed);
    let validated = siteDataSchema.safeParse(coercedParsed);
    if (!validated.success) {
      const normalizedAlt = normalizeAlternateSiteDataShape(coercedParsed);
      validated = siteDataSchema.safeParse(normalizedAlt);
      if (validated.success) {
        logStep("Recovered candidate by normalizing alternate JSON shape to siteData schema.");
      }
    }
    if (validated.success) {
      // AI 티 나는 특수문자(엠대시·말줄임표 문자·곡선따옴표·줄머리 불릿)를 평문으로 정리.
      siteData = stripAiTypographyDeep(validated.data);
      logStep(`Content generated (attempt ${attempt}).`);
      break;
    }

    validationHint = validated.error.issues
      .slice(0, 12)
      .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
      .join("\n");
    logStep(`Schema validation failed on attempt ${attempt}: ${validationHint}`);
  }

  if (!siteData) {
    const err = new Error("Failed to produce schema-valid site-data after 3 attempts.");
    await writeFailureDump({
      stage: "schema-failed-regenerate",
      initialResponse: initialResponse || "[EMPTY]",
      lastCandidate: lastCandidate || "[EMPTY]",
      error: err,
    });
    throw err;
  }

  // --- 레이아웃 빌더: 현재 레이아웃을 앵커로, 매 회차 다른 포트폴리오를 리서치해 점진 개선 ---
  const existingLayout = extractExistingLayout(currentSiteDataText);
  let buildLens: string | undefined;
  let buildChanges: string[] = [];
  if (LAYOUT_BUILDER_ENABLED) {
    const lens = RESEARCH_LENSES[new Date().getUTCDate() % RESEARCH_LENSES.length];
    buildLens = lens;
    logStep(`Researching portfolio references (lens: ${lens})...`);
    const researchNotes = await researchPortfolioReferences(apiKey, lens);
    logStep(researchNotes ? `Research notes collected (${researchNotes.length} chars).` : "Research notes empty.");
    // git 으로 회차별 레이아웃 변화 이력을 컴팩트하게 뽑아 넣어 핑퐁(반복·되돌리기)을 막는다.
    const layoutHistory = await getLayoutOrderTimeline(8);
    logStep("Loaded layout change history from git for context.");
    logStep("Generating layout (anchor + evolve)...");
    const generated = await generateLayout(apiKey, { currentLayout: existingLayout, researchNotes, lens, layoutHistory });
    siteData.layout = stripAiTypographyDeep(buildFinalLayout(existingLayout, generated?.layout ?? null));
    buildChanges = generated?.changes ?? [];
    logStep(generated ? "Layout updated from builder." : "Layout builder yielded nothing — kept anchor/DEFAULT layout.");
  } else if (existingLayout) {
    // 빌더 비활성화: 기존 layout 을 보존(떨구지 않음).
    siteData.layout = buildFinalLayout(existingLayout, null);
    logStep("Layout builder disabled — preserved existing layout.");
  }

  // --- 컴포지션 빌더(점진 도입, 게이트): 디자인시스템 컴포넌트 트리로 페이지를 조합 + 내용 작성 ---
  const compositionChanges: string[] = [];
  if (COMPOSITION_BUILDER_ENABLED) {
    const lens = buildLens ?? RESEARCH_LENSES[new Date().getUTCDate() % RESEARCH_LENSES.length];
    logStep(`Composition builder enabled. Pages: ${COMPOSITION_PAGES.join(", ")} (lens: ${lens}).`);
    const researchNotes = await researchPortfolioReferences(apiKey, lens);
    const compositionContext = await loadOnePagerContext(changedVaultFiles);
    logStep("Loaded ontology context for composition.");

    // 기존 전체 composition 을 앵커로 보존하고, 대상 페이지만 새로 생성/갱신한다.
    const existingSiteComposition = (() => {
      try {
        const obj = JSON.parse(currentSiteDataText || "{}") as { composition?: unknown };
        const parsed = siteCompositionSchema.safeParse(obj.composition);
        return parsed.success ? parsed.data : undefined;
      } catch {
        return undefined;
      }
    })();
    const pages: SiteComposition["pages"] = { ...(existingSiteComposition?.pages ?? {}) };

    for (const page of COMPOSITION_PAGES) {
      const current = pages[page] ?? extractExistingComposition(currentSiteDataText, page);
      const gen = await generateComposition(apiKey, {
        page,
        currentComposition: current,
        contextText: compositionContext,
        lens,
        researchNotes,
        siblings: siblingCompositionDigest(pages, page),
      });
      if (gen) {
        pages[page] = enforceCompositionSkeleton(page, gen.composition);
        compositionChanges.push(...gen.changes.map((c) => `컴포지션(${page}): ${c}`));
        logStep(`Composition set for '${page}'.`);
      } else if (current) {
        pages[page] = current; // 생성 실패 → 기존 보존(폴백)
        logStep(`Composition builder yielded nothing for '${page}' — preserved existing.`);
      } else {
        logStep(`Composition builder yielded nothing for '${page}' — page falls back to blocks.`);
      }
    }

    const built = siteCompositionSchema.safeParse({ pages });
    if (built.success && Object.keys(built.data.pages).length > 0) {
      siteData.composition = stripAiTypographyDeep(built.data);
      logStep(`Composition attached (${Object.keys(built.data.pages).length} page(s)).`);
    } else if (!built.success) {
      logStep(`Composition assembly failed validation — skipped: ${built.error.issues.slice(0, 5).map((i) => i.message).join("; ")}`);
    }
  } else {
    // 빌더 비활성: 기존 site-data 에 composition 이 있었으면 떨구지 말고 보존.
    try {
      const obj = JSON.parse(currentSiteDataText || "{}") as { composition?: unknown };
      const parsed = siteCompositionSchema.safeParse(obj.composition);
      if (parsed.success && Object.keys(parsed.data.pages).length > 0) {
        siteData.composition = parsed.data;
        logStep("Composition builder disabled — preserved existing composition.");
      }
    } catch {
      /* 무시: composition 없거나 깨짐 → 그대로 blocks 사용 */
    }
  }

  // --- 원페이저 빌더: vault 온톨로지 근거로 이력서/포트폴리오 한 장(HTML). 안정성 우선(KEEP/PATCH/OVERHAUL). ---
  // site-data.json 에는 넣지 않고 별도 아티팩트(onepager-ko.html)로 분리한다(비대화 방지).
  const onePagerChanges: string[] = [];
  if (ONEPAGER_BUILDER_ENABLED) {
    const currentHtml = await getExistingOnePagerHtml();
    const onePagerContext = await loadOnePagerContext(changedVaultFiles);
    logStep("Loaded one-pager ontology context.");
    const lens = buildLens ?? RESEARCH_LENSES[new Date().getUTCDate() % RESEARCH_LENSES.length];
    // 첫 생성일 때만 디자인 리서치(기존이 있으면 안정성 우선이라 생략, 비용·핑퐁 방지).
    const researchNotes = currentHtml ? "" : await researchPortfolioReferences(apiKey, lens);
    logStep("Generating one-pager (vault ontology grounded)...");
    const onePager = await generateOnePager(apiKey, {
      contextText: onePagerContext,
      currentHtml,
      researchNotes,
      lens,
    });
    if (onePager && onePager.mode !== "KEEP") {
      await mkdir(path.dirname(ONEPAGER_HTML_PATH), { recursive: true });
      await writeFile(ONEPAGER_HTML_PATH, `${stripAiTypographyDeep(onePager.html)}\n`, "utf8");
      onePagerChanges.push(...onePager.changes.map((c) => `원페이저(${onePager.mode}): ${c}`));
      logStep(`Wrote one-pager: ${ONEPAGER_HTML_PATH} (mode=${onePager.mode}).`);
    } else if (onePager) {
      onePagerChanges.push("원페이저: 변경 없음(KEEP, 독자 안정 유지)");
      logStep("One-pager KEEP — existing file preserved.");
    } else {
      logStep("One-pager builder yielded nothing — existing file preserved.");
    }
  }

  // --- 빌드 버전 스탬프(footer) + 개선 의도 로그를 DB(build_log)에 적층 ---
  const now = new Date();
  const version = buildVersion(now);
  siteData.build = { version, refreshedAt: now.toISOString() };
  const layoutAndContentChanges = buildChanges.length > 0 ? buildChanges : ["콘텐츠 리프레시(레이아웃 변경 없음)"];
  const logChanges = [...layoutAndContentChanges, ...compositionChanges, ...onePagerChanges];
  try {
    await recordBuildLog({ version, lens: buildLens ?? null, changes: logChanges });
    logStep(`Build log recorded to DB (version ${version}, ${logChanges.length} change(s)).`);
  } catch (error) {
    logStep(`Build log DB write skipped (${error instanceof Error ? error.message : String(error)}).`);
  }

  logStep(`Writing refreshed site-data: ${SITE_DATA_PATH}`);
  await mkdir(path.dirname(SITE_DATA_PATH), { recursive: true });
  await writeFile(SITE_DATA_PATH, `${JSON.stringify(siteData, null, 2)}\n`, "utf8");
  logStep(`Updated ${SITE_DATA_PATH} using ${MODEL}`);
}

main().catch((error) => {
  console.error("Failed to refresh site-data.json with Claude.");
  console.error(error);
  process.exit(1);
});
