/**
 * siteData PATCH(부분 갱신)용 경로 유틸. LLM 이 뱉은 경로별 edit 을 기존 site-data 에 안전하게 적용한다.
 * 순수 함수만 — refresh 스크립트(무거운 main) 없이 단독 테스트 가능(site-data-patch.test.ts).
 */

/** "career[2].points" → ["career", 2, "points"]. 점·대괄호 경로를 세그먼트로 분해(배열 인덱스는 number). */
export function parsePath(path: string): Array<string | number> {
  return path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => (/^\d+$/.test(s) ? Number(s) : s));
}

/**
 * 이미 존재하는 경로에만 값을 세팅한다(신규 경로 생성 안 함 → 스키마 밖 구조 방지). 성공 여부 반환.
 * root 는 clone 이어야 한다(원본 변형 방지). 배열 인덱스도 세그먼트(number)로 처리.
 */
export function setByPath(root: unknown, segments: Array<string | number>, value: unknown): boolean {
  if (segments.length === 0 || root == null || typeof root !== "object") return false;
  let cur = root as Record<string | number, unknown>;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const next = cur[segments[i]];
    if (next == null || typeof next !== "object") return false;
    cur = next as Record<string | number, unknown>;
  }
  const last = segments[segments.length - 1];
  if (!(last in (cur as object))) return false; // 기존 경로만 허용
  cur[last] = value;
  return true;
}
