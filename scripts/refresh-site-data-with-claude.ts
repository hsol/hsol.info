import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { siteDataSchema } from "../src/content/schema";
import { HSOL_DATA } from "../src/data/site";

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

const CONTEXT_FILES = [
  `${VAULT_ROOT}/README.md`,
  `${VAULT_ROOT}/object-views/작문-가이드.md`,
  `${VAULT_ROOT}/object-views/포트폴리오-요약.md`,
  `${VAULT_ROOT}/object-views/타임라인.md`,
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

async function loadContextFiles(): Promise<string> {
  logStep(`Loading context files (${CONTEXT_FILES.length})...`);
  const chunks = await Promise.all(
    CONTEXT_FILES.map(async (filePath) => {
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

async function requestAnthropic(
  apiKey: string,
  prompt: string,
): Promise<{ text: string; stopReason: string | undefined }> {
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
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic request failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
    stop_reason?: string;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const text = data.content
    ?.filter((item) => item.type === "text" && item.text)
    .map((item) => item.text)
    .join("\n")
    .trim();
  if (!text) throw new Error("Empty response from Anthropic");
  const usage = data.usage;
  if (usage?.input_tokens != null && usage?.output_tokens != null) {
    logStep(
      `Anthropic response received (stop_reason=${data.stop_reason ?? "?"}; usage in/out=${usage.input_tokens}/${usage.output_tokens}).`,
    );
  } else {
    logStep(`Anthropic response received (stop_reason=${data.stop_reason ?? "?"}).`);
  }
  return { text, stopReason: data.stop_reason };
}

async function main() {
  logStep("Refresh started.");
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY");
  }

  let currentSiteDataText: string;
  try {
    logStep(`Reading current site-data: ${SITE_DATA_PATH}`);
    currentSiteDataText = await readFile(SITE_DATA_PATH, "utf8");
  } catch (error) {
    const enoent = typeof error === "object" && error !== null && "code" in error
      ? (error as { code?: string }).code === "ENOENT"
      : false;
    if (!enoent) throw error;
    logStep("site-data.json not found, falling back to src/data/site.ts baseline.");
    currentSiteDataText = `${JSON.stringify(HSOL_DATA, null, 2)}\n`;
  }
  const contextText = await loadContextFiles();
  logStep("Context loaded.");

  const prompt = `
너는 vault 내용을 읽고 site-data.json을 갱신하는 데이터 편집기다.

규칙:
1) 출력은 오직 JSON 하나만 반환한다. 코드블록 설명 금지.
2) JSON 구조는 기존 site-data.json 스키마를 그대로 유지한다.
3) 템플릿 고정값(room, coord 같은 템플릿 메타)은 건드리지 않는다.
4) 한국어 문구 톤은 반드시 object-views/작문-가이드를 우선 기준으로 맞춘다.
5) 증거가 없는 정보는 추측하지 말고 현재 값을 유지한다.

현재 site-data.json:
${currentSiteDataText}

참조 vault 컨텍스트:
${contextText}
`.trim();

  const { text, stopReason } = await requestAnthropic(apiKey, prompt);
  if (stopReason === "max_tokens") {
    const err = new Error(
      `Anthropic output was truncated (stop_reason=max_tokens, max_tokens=${MAX_TOKENS}). Set ANTHROPIC_MAX_TOKENS higher if your model allows it, or shorten the prompt / use a smaller baseline JSON.`,
    );
    logStep(err.message);
    await writeFailureDump({
      stage: "truncated-max-tokens",
      initialResponse: text,
      lastCandidate: text,
      error: err,
    });
    throw err;
  }

  let parsed: unknown;
  try {
    logStep("Parsing attempt 1...");
    parsed = parseJsonWithFallback(text);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    logStep(`Parse attempt 1 failed: ${detail}`);
    await writeFailureDump({
      stage: "parse-failed",
      initialResponse: text,
      lastCandidate: text,
      error,
    });
    throw error instanceof Error
      ? error
      : new Error("Failed to parse Claude output as strict JSON.");
  }

  logStep("Validating output with siteDataSchema.");
  const validated = siteDataSchema.parse(parsed);
  logStep(`Writing refreshed site-data: ${SITE_DATA_PATH}`);
  await mkdir(path.dirname(SITE_DATA_PATH), { recursive: true });
  await writeFile(SITE_DATA_PATH, `${JSON.stringify(validated, null, 2)}\n`, "utf8");
  logStep(`Updated ${SITE_DATA_PATH} using ${MODEL}`);
}

main().catch((error) => {
  console.error("Failed to refresh site-data.json with Claude.");
  console.error(error);
  process.exit(1);
});
