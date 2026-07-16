/**
 * 관리 콘솔 순수 로직 자체 점검. 프레임워크 없이 tsx 로 직접 실행:
 *   npx tsx src/lib/db/ask-hansol-manage.check.ts
 *
 * DB 조회 함수는 여기서 검증하지 않는다(실 DB 로 눈으로 확인). 분기가 있는
 * mismatchLabel 만 대상. 페이지 클램프는 기존 pagination.ts 재사용이라 제외.
 */
import assert from "node:assert";

import { mismatchLabel } from "./ask-hansol-manage";

function main() {
  // 정상 대화 — 배지 없음
  assert(mismatchLabel(12, 12) === null, "같은 수인데 배지가 붙었다");
  assert(mismatchLabel(0, 0) === null, "빈 세션에 배지가 붙었다");

  // 답변이 모자란 경우 — 가장 흔한 이상(답변 실패·중도 이탈)
  assert(mismatchLabel(12, 11) === "⚠ 답변 1 누락", `답변 누락 라벨 불일치: ${mismatchLabel(12, 11)}`);
  assert(mismatchLabel(3, 0) === "⚠ 답변 3 누락", `답변 누락 라벨 불일치: ${mismatchLabel(3, 0)}`);

  // 반대 방향(비정상이지만 표시는 해야 한다)
  assert(mismatchLabel(11, 12) === "⚠ 질문 1 누락", `질문 누락 라벨 불일치: ${mismatchLabel(11, 12)}`);

  console.log("✓ ask-hansol-manage self-check passed");
}

main();
