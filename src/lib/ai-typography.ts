/**
 * AI가 흔히 쓰는 특수문자를 일반 문장부호로 치환한다.
 * Ask 답변 후처리(answer-linkify)와 사이트 카피 생성(refresh-site-data) 양쪽에서 쓴다.
 *
 * - 엠/엔/수평 대시(— – ―) → 하이픈(-)
 * - 말줄임표 문자(…) → 마침표 3개(...)
 * - 곡선 따옴표("" '') → 곧은 따옴표(" ')
 * - 줄머리 불릿(• ·) → 마크다운 "- "
 *
 * 한국어 표준 가운뎃점(·)은 줄 중간에서는 보존한다(줄머리 불릿일 때만 치환).
 */
export function stripAiTypography(text: string): string {
  return text
    .replace(/[—–―]/g, "-")
    .replace(/…/g, "...")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/^[ \t]*[•·]\s+/gm, "- ");
}

/** 객체/배열 안의 모든 문자열 값에 stripAiTypography를 재귀 적용한다(구조는 보존). */
export function stripAiTypographyDeep<T>(value: T): T {
  if (typeof value === "string") return stripAiTypography(value) as unknown as T;
  if (Array.isArray(value)) return value.map((item) => stripAiTypographyDeep(item)) as unknown as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, stripAiTypographyDeep(v)]),
    ) as unknown as T;
  }
  return value;
}
