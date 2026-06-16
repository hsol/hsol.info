/**
 * Ask Hansol — Vercel Blob vault 조회/문맥 구성 공용 모듈.
 * 대화형 Ask(`/api/ask-hansol`)와 JD 적합도 분석(`/api/ask-hansol-jd`)이 함께 쓴다.
 * 방문자 답변에는 vault/Blob/조회 과정을 드러내지 않는다는 정책은 호출부 프롬프트에서 강제한다.
 */

export type BlobEntry = { pathname: string; url: string };

export type RetrievalSkill = {
  id: string;
  keywords: string[];
  blobPaths: string[];
};

/** 모든 Ask 요청에 항상 포함하는 기본 문맥(읽기 지침 + 운영 매뉴얼). */
export const BASE_CONTEXT_PATHS = [
  "vault/README.md",
  "vault/object-views/AI-클론-운영-매뉴얼.md",
];

export const BLOB_CONTEXT_MAX_CHARS = Number(
  process.env.ASK_HANSOL_BLOB_CONTEXT_MAX_CHARS ?? 12_000,
);

export const RETRIEVAL_SKILLS: RetrievalSkill[] = [
  {
    id: "persona-core",
    keywords: ["페르소나", "성격", "정체성", "톤", "말투", "persona"],
    blobPaths: ["vault/objects/concepts/임한솔-persona.md"],
  },
  {
    id: "profile-career",
    keywords: ["경력", "커리어", "이력", "경험", "요약", "career"],
    blobPaths: ["vault/objects/people/임한솔.md"],
  },
  {
    id: "writing-content",
    keywords: ["블로그", "글", "아카이브", "콘텐츠", "작문", "writing"],
    blobPaths: ["vault/objects/concepts/임한솔-writing-style.md"],
  },
];

export function keywordTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[?!.,]/g, " ")
    .split(/\s+/)
    .map((token) =>
      token.replace(/(은|는|이|가|을|를|요|나요|까요|인가요|입니다|있나요|하나요)$/g, ""),
    )
    .filter((token) => token.length >= 2);
}

export function getBlobToken(): string | null {
  return (
    process.env.ASK_HANSOL_BLOB_TOKEN ??
    process.env.BLOB_READ_WRITE_TOKEN ??
    process.env.BLOB_READ_TOKEN ??
    null
  );
}

function blobContextLimit(): number {
  return Number.isFinite(BLOB_CONTEXT_MAX_CHARS) && BLOB_CONTEXT_MAX_CHARS > 0
    ? BLOB_CONTEXT_MAX_CHARS
    : 12_000;
}

async function listAllBlobs(prefix: string, token: string): Promise<BlobEntry[]> {
  const { list } = await import("@vercel/blob");
  const page = await list({ prefix, token, limit: 20 });
  return page.blobs.map((blob) => ({
    pathname: blob.pathname,
    url: blob.url,
  }));
}

async function resolveBlobEntryForRelativePath(
  relativePath: string,
  token: string,
  basePrefix: string,
): Promise<BlobEntry | null> {
  const pathCandidates = [
    `${basePrefix}/${relativePath}`.replace(/\/+/g, "/"),
    relativePath.replace(/^\/+/g, ""),
  ];
  for (const fullPath of pathCandidates) {
    const candidates = await listAllBlobs(fullPath, token).catch(() => []);
    const exact = candidates.find((blob) => blob.pathname === fullPath);
    const picked = exact ?? candidates[0];
    if (picked) return picked;
  }
  return null;
}

export function sortVaultReadmeFirst(entries: BlobEntry[]): BlobEntry[] {
  const isVaultReadme = (pathname: string) => /(^|\/)vault\/README\.md$/i.test(pathname);
  return [...entries].sort((a, b) => {
    const ar = isVaultReadme(a.pathname) ? 0 : 1;
    const br = isVaultReadme(b.pathname) ? 0 : 1;
    if (ar !== br) return ar - br;
    return a.pathname.localeCompare(b.pathname);
  });
}

export async function fetchBlobText(url: string, token: string): Promise<string | null> {
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

/** Blob의 vault/README.md — vault를 찾고 읽는 절차·규칙용. 사실 근거 문서가 아님. */
export async function fetchVaultReadmeGuideBody(): Promise<string | null> {
  const token = getBlobToken();
  if (!token) return null;
  const basePrefix = (process.env.BLOB_PREFIX || "info").replace(/^\/+|\/+$/g, "");
  const entry = await resolveBlobEntryForRelativePath("vault/README.md", token, basePrefix);
  if (!entry) return null;
  const text = await fetchBlobText(entry.url, token);
  if (!text) return null;
  return text.slice(0, blobContextLimit());
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
  maxDocs = 4,
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

  return [...dedup.values()].slice(0, maxDocs);
}

async function buildContextFromBlobs(entries: BlobEntry[], token: string): Promise<string> {
  const limit = blobContextLimit();
  const chunks = await Promise.all(
    entries.map(async (blob) => {
      const text = await fetchBlobText(blob.url, token);
      if (!text) return null;
      const isVaultReadme = /(^|\/)vault\/README\.md$/i.test(blob.pathname);
      const header = isVaultReadme
        ? `### ${blob.pathname} (vault 읽기 지침 — 사실·인물·경력 근거로 쓰지 말 것)`
        : `### ${blob.pathname}`;
      return `${header}\n${text.slice(0, limit)}`;
    }),
  );
  return chunks.filter(Boolean).join("\n\n");
}

/** 대화형 Ask용: 질문 키워드로 스킬을 골라 관련 문서만 끌어온다. */
export async function fetchBlobContext(query: string): Promise<string> {
  const token = getBlobToken();
  if (!token) return "";

  const basePrefix = (process.env.BLOB_PREFIX || "info").replace(/^\/+|\/+$/g, "");
  const skills = pickRetrievalSkills(query);
  const selected = sortVaultReadmeFirst(await resolveSkillBlobs(skills, token, basePrefix));
  if (selected.length === 0) return "";
  return buildContextFromBlobs(selected, token);
}

/**
 * JD 적합도 분석용: 키워드와 무관하게 페르소나·경력·작문 등 핵심 프로필 문서를
 * 종합적으로 끌어온다. 기본 문맥(읽기 지침·운영 매뉴얼)도 함께 포함된다.
 */
export async function fetchComprehensiveProfileContext(): Promise<string> {
  const token = getBlobToken();
  if (!token) return "";

  const basePrefix = (process.env.BLOB_PREFIX || "info").replace(/^\/+|\/+$/g, "");
  const selected = sortVaultReadmeFirst(
    await resolveSkillBlobs(RETRIEVAL_SKILLS, token, basePrefix, 8),
  );
  if (selected.length === 0) return "";
  return buildContextFromBlobs(selected, token);
}
