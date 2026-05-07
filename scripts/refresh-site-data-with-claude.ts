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

const CONTEXT_FILES = [
  `${VAULT_ROOT}/README.md`,
  `${VAULT_ROOT}/object-views/작문-가이드.md`,
  `${VAULT_ROOT}/object-views/포트폴리오-요약.md`,
  `${VAULT_ROOT}/object-views/타임라인.md`,
  `${VAULT_ROOT}/objects/people/임한솔.md`,
  `${VAULT_ROOT}/objects/concepts/임한솔-persona.md`,
];

function extractJson(text: string): unknown {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  const raw = fenced?.[1] ?? text;
  return JSON.parse(raw.trim());
}

async function loadContextFiles(): Promise<string> {
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

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY");
  }

  let currentSiteDataText: string;
  try {
    currentSiteDataText = await readFile(SITE_DATA_PATH, "utf8");
  } catch (error) {
    const enoent = typeof error === "object" && error !== null && "code" in error
      ? (error as { code?: string }).code === "ENOENT"
      : false;
    if (!enoent) throw error;
    currentSiteDataText = `${JSON.stringify(HSOL_DATA, null, 2)}\n`;
  }
  const contextText = await loadContextFiles();

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

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic request failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const text = data.content
    ?.filter((item) => item.type === "text" && item.text)
    .map((item) => item.text)
    .join("\n")
    .trim();

  if (!text) throw new Error("Empty response from Anthropic");

  const parsed = siteDataSchema.parse(extractJson(text));
  await mkdir(path.dirname(SITE_DATA_PATH), { recursive: true });
  await writeFile(SITE_DATA_PATH, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
  console.log(`Updated ${SITE_DATA_PATH} using ${MODEL}`);
}

main().catch((error) => {
  console.error("Failed to refresh site-data.json with Claude.");
  console.error(error);
  process.exit(1);
});
