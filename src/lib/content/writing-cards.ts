/**
 * '쓴 것들' 카드 목록 조립: 블로그 + publications + extraWritings.
 *
 * 생성 파이프라인(LLM)이 뉴스레터의 개별 호를 별도 항목으로 넣는 일이 있다
 * (예: "Ask Hansol 자문록" 옆에 "Ask Hansol 자문록 18호 - ..."). 프롬프트 규칙만으로는
 * 보장이 안 되므로 렌더 단계에서 결정적으로 접는다.
 *   1) 같은 이름은 한 번만(뒤, 즉 더 구체적인 분류를 우선).
 *   2) 이름이 다른 항목 이름 + 회차 표기(18호, #18, Vol. 3, EP 2, 3화 등)로 시작하면 그 시리즈의 한 호로 보고 뺀다.
 *      부모 시리즈 카드가 없으면 그대로 둔다(회차만 있는 연재도 사라지지 않게).
 */
export type WritingCardItem = { name: string; en: string; blurb: string; href?: string };

const norm = (s: string) => s.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();

const ISSUE_SUFFIX = /^(?:제\s*)?\d+\s*(?:호|화|회|편)|^(?:#|no\.?\s*|vol\.?\s*|ep\.?\s*|issue\s*)\d+/i;

export function isIssueOf(child: string, parent: string): boolean {
  const c = norm(child);
  const p = norm(parent);
  if (c === p || !c.startsWith(p)) return false;
  const rest = c.slice(p.length).replace(/^[\s\-:·|,]+/, "");
  return ISSUE_SUFFIX.test(rest);
}

export function buildWritingCards(
  blog: WritingCardItem,
  publications: { title: string; desc: string; href?: string }[],
  extraWritings: WritingCardItem[],
): WritingCardItem[] {
  const raw: WritingCardItem[] = [
    blog,
    ...publications.map((p) => ({ name: p.title, en: "Publication", blurb: p.desc, href: p.href })),
    ...extraWritings,
  ];

  const seen = new Set<string>();
  const deduped: WritingCardItem[] = [];
  for (let i = raw.length - 1; i >= 0; i -= 1) {
    const key = norm(raw[i].name);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.unshift(raw[i]);
  }

  return deduped.filter((c) => !deduped.some((p) => p !== c && isIssueOf(c.name, p.name)));
}

/** PIECE 번호: 01, 02 ... 10 (기존 `0${i+1}` 는 10번째부터 "010" 이 됐다). */
export const pieceNo = (i: number) => `PIECE · ${String(i + 1).padStart(2, "0")}`;
