import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { siteDataSchema } from "../src/content/schema";
import { HSOL_DATA } from "../src/data/site";

const execFileAsync = promisify(execFile);

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
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
const SITE_DATA_TEMPLATE = JSON.stringify(HSOL_DATA, null, 2);
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

function dateRangeLabel(start: unknown, end: unknown): string {
  const s = typeof start === "string" && start.trim() ? start.trim() : "";
  const e = typeof end === "string" && end.trim() ? end.trim() : "현재";
  if (!s && !e) return "기간 미상";
  if (!s) return e;
  return `${s} - ${e}`;
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
  }

  if (Array.isArray(src.career) && src.career.length > 0) {
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
          points: [desc],
          tier:
            typeof out.career[idx]?.tier === "number"
              ? out.career[idx].tier
              : idx < 2
                ? 1
                : 2,
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
      .map((item, idx) => ({
        title: pickString(item.title, out.publications[idx]?.title, "Untitled") ?? "Untitled",
        desc: pickString(item.desc, item.descKo, out.publications[idx]?.desc, "설명 없음") ?? "설명 없음",
      }));
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

async function listChangedVaultFilesFromGit(): Promise<string[]> {
  const baseSha = process.env.GIT_DIFF_BASE_SHA;
  const headSha = process.env.GIT_DIFF_HEAD_SHA;
  if (!baseSha || !headSha || /^0+$/.test(baseSha)) return [];

  const { stdout } = await execFileAsync(
    "git",
    ["diff", "--name-only", baseSha, headSha, "--", "hsol-info-blob/vault"],
    { cwd: process.cwd() },
  );

  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((filePath) => toPosixPath(filePath))
    .filter((filePath) => filePath.startsWith("hsol-info-blob/vault/"))
    .map((filePath) => filePath.slice("hsol-info-blob/vault/".length));
}

async function detectChangedVaultFiles(): Promise<string[]> {
  const fromEnv = process.env.VAULT_CHANGED_FILES;
  if (fromEnv && fromEnv.trim()) {
    return fromEnv
      .split(/\r?\n|,/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  try {
    return await listChangedVaultFilesFromGit();
  } catch {
    return [];
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

async function requestAnthropicStructured(
  apiKey: string,
  prompt: string,
): Promise<{ text: string; toolInput: unknown | null; stopReason: string | undefined }> {
  logStep(`Requesting Anthropic (${MODEL}, max_tokens=${MAX_TOKENS})...`);
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: prompt }],
      tools: [
        {
          name: EMIT_TOOL_NAME,
          description:
            "Return ONLY final site-data JSON object. Never include markdown/prose.",
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
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic request failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as {
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

async function main() {
  logStep("Refresh started.");
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY");
  }

  const { text: currentSiteDataText, exists: hasExistingSiteData } = await getExistingSiteDataText();
  const changedVaultFiles = await detectChangedVaultFiles();
  if (hasExistingSiteData && changedVaultFiles.length === 0) {
    logStep("No vault file changes detected for this deployment. Keep existing site-data as-is.");
    return;
  }

  if (!hasExistingSiteData) {
    logStep("site-data.json not found. Rebuilding from vault README baseline.");
  } else {
    logStep(`Detected changed vault files: ${changedVaultFiles.length}`);
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
2) JSON 구조는 기존 site-data.json 스키마를 그대로 유지한다.
3) 템플릿 고정값(room, coord 같은 템플릿 메타)은 건드리지 않는다.
4) 한국어 문구 톤은 반드시 object-views/작문-가이드를 우선 기준으로 맞춘다.
5) 증거가 없는 정보는 추측하지 말고 현재 값을 유지한다.
6) [HIGH_PRIORITY_CONTEXT]로 표시된 파일은 최신 변경으로 간주하고 반영 우선순위를 가장 높게 둔다.
7) 필드 키는 절대 번역/변형하지 말고 템플릿 키를 1:1 유지한다. (예: identity.name, pillars[].key)
8) 루트 객체를 다른 키로 감싸지 말고, 최상위에 identity/pillars/.../faq를 직접 둔다.
9) portfolioCopy.home.builtTitle / builtMeta / builtBody / builtCards / builtMermaid / builtFlow 는 반드시 ${HOME_BUILT_SOURCE_PATH}를 1차 근거로 작성한다.
10) built* 필드에는 구현·운영 방식(아키텍처/데이터 흐름/운영 스택)만 요약하고, 문서에 없는 새로운 주장/수치를 만들지 않는다.
11) builtCards 는 최소 3개 이상으로 구성하고, 제목 중복 없이 "목표/흐름/신뢰성/경험 설계" 관점을 우선 반영한다.
12) builtFlow 는 최소 3개 이상의 단계(label)로 작성하고, 데이터 흐름 순서를 한 줄 다이어그램처럼 읽히게 구성한다.
13) builtMermaid 는 mermaid 'flowchart LR' 문법의 문자열로 작성하고, 단계 노드 4개 이상과 연결 화살표를 포함한다.
14) builtMermaid 는 파서 안정성을 위해 statement 구분을 ';'로 명시하고, 라벨에는 괄호·특수문자 대신 단순 텍스트를 사용한다.
15) builtMermaid 라벨 텍스트에는 "\\n" 이스케이프를 넣지 않는다. (줄바꿈 대신 공백을 사용)

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
      logStep(`Writing refreshed site-data: ${SITE_DATA_PATH}`);
      await mkdir(path.dirname(SITE_DATA_PATH), { recursive: true });
      await writeFile(
        SITE_DATA_PATH,
        `${JSON.stringify(validated.data, null, 2)}\n`,
        "utf8",
      );
      logStep(`Updated ${SITE_DATA_PATH} using ${MODEL} (attempt ${attempt})`);
      return;
    }

    validationHint = validated.error.issues
      .slice(0, 12)
      .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
      .join("\n");
    logStep(`Schema validation failed on attempt ${attempt}: ${validationHint}`);
  }

  const err = new Error("Failed to produce schema-valid site-data after 3 attempts.");
  await writeFailureDump({
    stage: "schema-failed-regenerate",
    initialResponse: initialResponse || "[EMPTY]",
    lastCandidate: lastCandidate || "[EMPTY]",
    error: err,
  });
  throw err;
}

main().catch((error) => {
  console.error("Failed to refresh site-data.json with Claude.");
  console.error(error);
  process.exit(1);
});
