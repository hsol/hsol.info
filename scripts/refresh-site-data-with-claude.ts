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
  const forceRefresh = isForceRefresh();
  if (forceRefresh) {
    logStep("Force refresh: vault diff empty guard skipped.");
  }
  if (hasExistingSiteData && changedVaultFiles.length === 0 && !forceRefresh) {
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
2) 출력 JSON은 스키마와 동일한 최상위 키·형태를 유지한다(루트 래핑 금지). 필드 키는 템플릿과 1:1(번역·이름 변경 금지). room·coord 등 템플릿 고정 UI 메타는 바꾸지 않는다.
3) 근거·우선순위: [HIGH_PRIORITY_CONTEXT]를 최우선. 아래 [참조 vault 컨텍스트]에 실제로 나온 내용으로만 사실·고유명사·기간을 뒷받침하고, 증거 없는 추측·새 주장·새 수치는 넣지 않는다. 애매하면 기존 site-data 값을 유지한다. 한국어 톤은 같은 세션에 포함된 작문 가이드에 맞추고, 빈 수식어 남용은 피한다.
   산문 문체(전역, 필수): 자기소개서·AI 생성체 티를 피한다. **site-data 안 방문자 노출 한국어 서술 전반**에 동일 적용한다 — 예: portfolioCopy.* 의 문단·줄글·blurb·body·coffee·ask 문구, viewHeaders.*.lede, faq[].a, career.points 각 줄(서술형일 때), publications.desc 등. 문단·줄글의 **첫 문장**은 "저는 임한솔로", "저는 ~로", "임한솔은", "한솔은", "본인은", "저는 ~입니다/저는 ~한 사람입니다" 같은 이름·1인칭 고정 템플릿으로 시작하지 않는다. 같은 필드(또는 인접한 짧은 블록) 안에서 그 패턴은 **최대 0~1회**이고, **연속 두 문장 모두 1인칭 주어(저/본인/이름)로 시작**하지 않는다. 대신 역할·맥락·행동·장면·독자 관점으로 들어간다(동사·명사구 시작, "~에서 ~를 맡으며", "채용 담당자 입장에서는" 등). 본인 이름은 꼭 필요할 때만·**한 번**·뒤쪽 문장에 정보 전달용으로. 과한 격식("~하오니", "~드리고자")·과한 수사("진심으로", "크게 자랑스럽게")·빈번한 "결국/또한/즉" 나열체는 피한다.
4) portfolioCopy.home 의 builtTitle~builtPerspectives: 이 프롬프트에 실린 hsol.info 프로젝트 설명·소개 백데이터를 1차 근거로 하고, 구현·데이터 흐름·운영 방식만 요약한다(문서 밖 주장·수치 금지). builtCards는 3개 이상·제목 중복 없이 목표/흐름/신뢰성/경험 설계 성격. builtFlow는 3단계 이상·한 줄로 읽히는 순서. builtMermaid는 mermaid flowchart LR, 노드 4개 이상·화살표 포함, statement는 ';'로 구분, 라벨은 단순 텍스트·라벨에 "\\n" 금지. builtPerspectives는 소개 백데이터 8관점 중 서로 다른 4개를 title/summary로 압축. builtBody·builtCards.body·builtPerspective summary 등 서술형 문장은 규칙 3 **산문 문체(전역)** 를 따른다.
5) 페르소나(hire/collab/builder/curious): portfolioCopy 쪽 timelineIntro는 필수. 문단은 JSON에서 \\n\\n. (1) 한 줄 포지셔닝 (2) 기관·역할·기간·도메인 등 구체를 최소 2곳 이상 녹인 근거 (3) 타임라인으로 자연스럽게 이어지는 마무리. hire/collab/builder/curious 각각 채용·협업·동료 빌더·인간 궤적 독자에 맞는 설득 축을 분명히 한다. viewHeaders의 titleLines·lede는 같은 근거로 timelineIntro와 모순 없이 짝을 이루게(lede는 1~2문장 첫인상, 서사는 timelineIntro). collab 방법론·curious 노트 등 몸통 블러브도 동일 근거·항목마다 다른 각도로 배치한다. timelineIntro·lede·위 필드들은 규칙 3의 **산문 문체(전역)** 를 반드시 따른다.
6) career[i].points는 항목당 3개 이상 5개 이하로 유지한다(빈 bullet 금지).
7) career[i].tier: 키는 personas[].key 와 정확히 일치·값은 양의 정수(1=기본 펼침, 2+=접힘). 관점별로 의미 있게 차등하고, 네 관점 전부 동일 중요도가 아니면 숫자만 복붙하지 않는다.

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
