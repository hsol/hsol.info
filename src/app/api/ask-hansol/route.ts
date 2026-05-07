import { NextResponse } from "next/server";
import { list } from "@vercel/blob";
import { HSOL_DATA as D } from "@/data/site";
import { ASK_HANSOL_FALLBACK_MESSAGE } from "@/lib/ask-hansol/shared";

function normalize(text: string): string {
  return text.toLowerCase().replace(/[?!.\s]/g, "");
}

function keywordTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[?!.,]/g, " ")
    .split(/\s+/)
    .map((token) =>
      token.replace(/(은|는|이|가|을|를|요|나요|까요|인가요|입니다|있나요|하나요)$/g, ""),
    )
    .filter((token) => token.length >= 2);
}

type BlobEntry = { pathname: string; url: string };
type RetrievalSkill = {
  id: string;
  keywords: string[];
  blobPaths: string[];
};

const BASE_CONTEXT_PATHS = [
  "vault/README.md",
  "vault/object-views/AI-클론-운영-매뉴얼.md",
];

const RETRIEVAL_SKILLS: RetrievalSkill[] = [
  {
    id: "persona-core",
    keywords: ["페르소나", "성격", "정체성", "톤", "말투", "persona"],
    blobPaths: [
      "vault/objects/concepts/임한솔-persona.md",
    ],
  },
  {
    id: "profile-career",
    keywords: ["경력", "커리어", "이력", "경험", "요약", "career"],
    blobPaths: [
      "vault/objects/people/임한솔.md",
    ],
  },
  {
    id: "writing-content",
    keywords: ["블로그", "글", "아카이브", "콘텐츠", "작문", "writing"],
    blobPaths: [
      "vault/objects/concepts/임한솔-writing-style.md",
    ],
  },
];

function findFaqAnswer(query: string): string | null {
  const needle = normalize(query);
  const needleTokens = keywordTokens(query);
  const matched = D.faq.find((item) => {
    const candidate = normalize(item.q);
    if (
      candidate === needle ||
      candidate.includes(needle) ||
      needle.includes(candidate)
    ) {
      return true;
    }

    if (needleTokens.length === 0) return false;
    const candidateTokens = keywordTokens(item.q);
    if (candidateTokens.length === 0) return false;
    const overlap = needleTokens.filter((token) => candidateTokens.includes(token)).length;
    return overlap / needleTokens.length >= 0.6;
  });
  return matched?.a ?? null;
}

async function listAllBlobs(prefix: string, token: string): Promise<BlobEntry[]> {
  const page = await list({ prefix, token, limit: 20 });
  return page.blobs.map((blob) => ({
    pathname: blob.pathname,
    url: blob.url,
  }));
}

async function fetchBlobText(url: string, token: string): Promise<string | null> {
  const attempt = async (withAuth: boolean) => {
    const response = await fetch(url, {
      headers: withAuth ? { Authorization: `Bearer ${token}` } : undefined,
      cache: "no-store",
    });
    if (!response.ok) return null;
    return response.text();
  };

  try {
    const text = await attempt(true);
    if (text) return text;
  } catch {}

  try {
    return await attempt(false);
  } catch {
    return null;
  }
}

function pickRetrievalSkills(query: string): RetrievalSkill[] {
  const tokens = keywordTokens(query);
  const matched = RETRIEVAL_SKILLS.filter((skill) => {
    const skillTokenSet = skill.keywords.flatMap((k) => keywordTokens(k));
    if (skillTokenSet.length === 0 || tokens.length === 0) return false;
    const overlap = tokens.filter((token) => skillTokenSet.includes(token)).length;
    return overlap >= 1;
  });

  if (matched.length > 0) return matched.slice(0, 2);
  // 기본 스킬: 일반 질문에도 핵심 프로필은 항상 참조 가능
  return RETRIEVAL_SKILLS.filter((s) => s.id === "profile-career");
}

async function resolveSkillBlobs(
  skills: RetrievalSkill[],
  token: string,
  basePrefix: string,
): Promise<BlobEntry[]> {
  const dedup = new Map<string, BlobEntry>();
  const enqueuePath = async (relativePath: string) => {
    const pathCandidates = [
      `${basePrefix}/${relativePath}`.replace(/\/+/g, "/"),
      relativePath.replace(/^\/+/g, ""),
    ];

    for (const fullPath of pathCandidates) {
      const candidates = await listAllBlobs(fullPath, token).catch(() => []);
      const exact = candidates.find((blob) => blob.pathname === fullPath);
      const picked = exact ?? candidates[0];
      if (picked) {
        dedup.set(picked.pathname, picked);
        return;
      }
    }
  };

  // Always include base context for every Ask Hansol request.
  for (const basePath of BASE_CONTEXT_PATHS) {
    await enqueuePath(basePath);
  }

  for (const skill of skills) {
    for (const relativePath of skill.blobPaths) {
      await enqueuePath(relativePath);
    }
  }

  return [...dedup.values()].slice(0, 4);
}

function getBlobToken(): string | null {
  return (
    process.env.ASK_HANSOL_BLOB_TOKEN ??
    process.env.BLOB_READ_WRITE_TOKEN ??
    process.env.BLOB_READ_TOKEN ??
    null
  );
}

async function fetchBlobContext(query: string): Promise<string> {
  const token = getBlobToken();
  if (!token) return "";

  const basePrefix = (process.env.BLOB_PREFIX || "info").replace(/^\/+|\/+$/g, "");
  const skills = pickRetrievalSkills(query);
  const selected = await resolveSkillBlobs(skills, token, basePrefix);
  if (selected.length === 0) return "";

  const chunks = await Promise.all(
    selected.map(async (blob) => {
      const text = await fetchBlobText(blob.url, token);
      if (!text) return null;
      return `### ${blob.pathname}\n${text.slice(0, 1200)}`;
    }),
  );

  return chunks.filter(Boolean).join("\n\n");
}

async function runBlobLookupTool(input: unknown): Promise<string> {
  const query =
    typeof input === "object" && input !== null && "query" in input
      ? String((input as { query?: unknown }).query ?? "").trim()
      : "";
  if (!query) return "Blob 조회 실패: query가 비어 있습니다.";

  const context = await fetchBlobContext(query);
  if (!context) return "Blob 조회 결과가 없습니다. 운영 매뉴얼 또는 관련 문서를 찾지 못했습니다.";
  return context;
}

function buildPrompt(query: string): string {
  return `당신은 임한솔(Hansol Lim) 본인을 대신해 포트폴리오 사이트 방문자에게 답하는 어시스턴트입니다.
한국어로 3~5문장 이내로 답하세요. 모르는 것은 모른다고 말합니다.
답변 기준은 항상 "AI-클론-운영-매뉴얼"을 베이스로 하며, 다른 정보와 충돌하면 운영 매뉴얼 기준을 우선합니다.
확신이 부족하면 답변 전에 반드시 blob_lookup 도구를 호출해 필요한 문서를 조회한 뒤 답하세요.

[FAQ — 한솔 본인 톤]
${D.faq.map((f) => `Q: ${f.q}\nA: ${f.a}`).join("\n\n")}

방문자 질문: ${query}`;
}

type AnthropicContentBlock =
  | { type: "text"; text?: string }
  | { type: "tool_use"; id: string; name: string; input?: unknown };

function toPlainAnswer(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, "$1 ($2)")
    .replace(/`{1,3}([^`]+)`{1,3}/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function askAnthropic(prompt: string): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
  const messages: Array<{ role: "user" | "assistant"; content: unknown }> = [
    { role: "user", content: prompt },
  ];

  for (let i = 0; i < 4; i++) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 600,
        messages,
        tools: [
          {
            name: "blob_lookup",
            description:
              "Ask Hansol용 Blob 문서를 조회합니다. 운영 매뉴얼/관련 문서가 필요할 때 사용하세요.",
            input_schema: {
              type: "object",
              properties: {
                query: { type: "string", description: "조회할 주제 또는 질문" },
              },
              required: ["query"],
            },
          },
        ],
      }),
      cache: "no-store",
    });
    if (!response.ok) return null;

    const data = (await response.json()) as { content?: AnthropicContentBlock[] };
    const content = data.content ?? [];
    const toolUses = content.filter(
      (block): block is Extract<AnthropicContentBlock, { type: "tool_use" }> =>
        block.type === "tool_use" && block.name === "blob_lookup",
    );

    messages.push({ role: "assistant", content });

    if (toolUses.length === 0) {
      const answer = content
        .filter(
          (block): block is Extract<AnthropicContentBlock, { type: "text" }> =>
            block.type === "text",
        )
        .map((block) => block.text ?? "")
        .join("\n")
        .trim();
      return answer ? toPlainAnswer(answer) : null;
    }

    for (const toolUse of toolUses) {
      const toolResult = await runBlobLookupTool(toolUse.input);
      messages.push({
        role: "user",
        content: [{ type: "tool_result", tool_use_id: toolUse.id, content: toolResult }],
      });
    }
  }

  return null;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { query?: unknown };
    const query = typeof body.query === "string" ? body.query.trim() : "";
    if (!query) {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    const faqAnswer = findFaqAnswer(query);
    if (faqAnswer) {
      return NextResponse.json({ answer: faqAnswer });
    }

    const prompt = buildPrompt(query);
    const llmAnswer = await askAnthropic(prompt);
    return NextResponse.json({ answer: llmAnswer ?? ASK_HANSOL_FALLBACK_MESSAGE });
  } catch {
    return NextResponse.json({ answer: ASK_HANSOL_FALLBACK_MESSAGE });
  }
}
