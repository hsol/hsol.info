import { readOneDriveText } from "@/lib/content/onedrive-text";

/**
 * Ask Hansol - vault 문맥 구성 공용 모듈. vault 원본은 개인 OneDrive `hsol-info-blob/vault/`.
 * 대화형 Ask(`/api/ask-hansol`), JD 적합도 분석(`/api/ask-hansol-jd`), 자문(`/api/ask-hansol-advice`)이 함께 쓴다.
 * 방문자 답변에는 vault/저장소/조회 과정을 드러내지 않는다는 정책은 호출부 프롬프트에서 강제한다.
 */

export type RetrievalSkill = {
  id: string;
  keywords: string[];
  paths: string[];
};

/** 모든 Ask 요청에 항상 포함하는 기본 문맥(읽기 지침 + 운영 매뉴얼). */
export const BASE_CONTEXT_PATHS = [
  "vault/README.md",
  "vault/object-views/AI-클론-운영-매뉴얼.md",
];

export const VAULT_CONTEXT_MAX_CHARS = Number(
  process.env.ASK_HANSOL_VAULT_CONTEXT_MAX_CHARS ?? process.env.ASK_HANSOL_BLOB_CONTEXT_MAX_CHARS ?? 12_000,
);

export const RETRIEVAL_SKILLS: RetrievalSkill[] = [
  {
    id: "persona-core",
    keywords: ["페르소나", "성격", "정체성", "톤", "말투", "persona"],
    paths: ["vault/objects/concepts/임한솔-persona.md"],
  },
  {
    id: "profile-career",
    keywords: ["경력", "커리어", "이력", "경험", "요약", "career"],
    paths: ["vault/objects/people/임한솔.md"],
  },
  {
    id: "writing-content",
    keywords: ["블로그", "글", "아카이브", "콘텐츠", "작문", "writing"],
    paths: ["vault/objects/concepts/임한솔-writing-style.md"],
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

function contextLimit(): number {
  return Number.isFinite(VAULT_CONTEXT_MAX_CHARS) && VAULT_CONTEXT_MAX_CHARS > 0
    ? VAULT_CONTEXT_MAX_CHARS
    : 12_000;
}

const isVaultReadme = (p: string) => /(^|\/)vault\/README\.md$/i.test(p);

export function sortVaultReadmeFirst(paths: string[]): string[] {
  return [...paths].sort((a, b) => {
    const ar = isVaultReadme(a) ? 0 : 1;
    const br = isVaultReadme(b) ? 0 : 1;
    if (ar !== br) return ar - br;
    return a.localeCompare(b);
  });
}

/** vault/README.md - vault 를 찾고 읽는 절차와 규칙용. 사실 근거 문서가 아님. */
export async function fetchVaultReadmeGuideBody(): Promise<string | null> {
  const text = await readOneDriveText("vault/README.md");
  return text ? text.slice(0, contextLimit()) : null;
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

function selectPaths(skills: RetrievalSkill[], maxDocs: number): string[] {
  const ordered = [...BASE_CONTEXT_PATHS, ...skills.flatMap((s) => s.paths)];
  return sortVaultReadmeFirst([...new Set(ordered)].slice(0, maxDocs));
}

async function buildContext(paths: string[]): Promise<string> {
  const limit = contextLimit();
  const chunks = await Promise.all(
    paths.map(async (p) => {
      const text = await readOneDriveText(p);
      if (!text) return null;
      const header = isVaultReadme(p)
        ? `### ${p} (vault 읽기 지침 - 사실, 인물, 경력 근거로 쓰지 말 것)`
        : `### ${p}`;
      return `${header}\n${text.slice(0, limit)}`;
    }),
  );
  return chunks.filter(Boolean).join("\n\n");
}

/** 대화형 Ask용: 질문 키워드로 스킬을 골라 관련 문서만 끌어온다. */
export async function fetchVaultContext(query: string): Promise<string> {
  return buildContext(selectPaths(pickRetrievalSkills(query), 4));
}

/**
 * JD 적합도 분석, 자문용: 키워드와 무관하게 페르소나, 경력, 작문 등 핵심 프로필 문서를
 * 종합적으로 끌어온다. 기본 문맥(읽기 지침, 운영 매뉴얼)도 함께 포함된다.
 */
export async function fetchComprehensiveProfileContext(): Promise<string> {
  return buildContext(selectPaths(RETRIEVAL_SKILLS, 8));
}
