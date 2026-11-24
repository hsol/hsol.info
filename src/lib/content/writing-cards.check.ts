/**
 * '쓴 것들' 시리즈 접기 점검:
 *   npx tsx src/lib/content/writing-cards.check.ts
 */
import assert from "node:assert";

import { buildWritingCards, isIssueOf, pieceNo } from "./writing-cards";

// 2026-11-24 hsol.info 라이브에서 채집한 중복
assert.ok(isIssueOf("Ask Hansol 자문록 18호 - 컴공 3학년, 자동매매 봇을 더 팔까 넓힐까", "Ask Hansol 자문록"));
assert.ok(isIssueOf("Ask Hansol 자문록 19호 - 개발 6년차, 대기업 운영 유지보수 프리 월 600 제안을 받을까", "Ask Hansol 자문록"));
assert.ok(isIssueOf("AI Native 취재노트 #3 - 어느 회사", "AI Native 취재노트"));
assert.ok(isIssueOf("Measurable Developer Vol. 2", "Measurable Developer"));
// 시리즈가 아닌 것은 건드리지 않는다
assert.ok(!isIssueOf("Ask Hansol 자문록", "Ask Hansol 자문록"));
assert.ok(!isIssueOf("Ask Hansol 운영기", "Ask Hansol"));
assert.ok(!isIssueOf("블로그 - blog.hsol.info", "블로그"));
assert.ok(!isIssueOf("자소 - macOS 파일명 자소분리 자동변환 유틸리티", "자소"));

const w = (name: string) => ({ name, en: "x", blurb: "x" });
const cards = buildWritingCards(
  w("블로그 - blog.hsol.info"),
  [{ title: "메이커와 엔지니어", desc: "x" }],
  [
    w("Measurable Developer"),
    w("AI Native 취재노트"),
    w("Ask Hansol 자문록"),
    w("Ask Hansol 자문록 18호 - 컴공 3학년"),
    w("Ask Hansol 자문록 19호 - 개발 6년차"),
    w("자소 - macOS 파일명 자소분리 자동변환 유틸리티"),
    w("메이커와 엔지니어"),
  ],
);
assert.deepStrictEqual(
  cards.map((c) => c.name),
  [
    "블로그 - blog.hsol.info",
    "Measurable Developer",
    "AI Native 취재노트",
    "Ask Hansol 자문록",
    "자소 - macOS 파일명 자소분리 자동변환 유틸리티",
    "메이커와 엔지니어",
  ],
);

// 부모 시리즈 카드가 없으면 회차 카드는 남긴다
assert.strictEqual(buildWritingCards(w("블로그"), [], [w("Ask Hansol 자문록 18호 - a")]).length, 2);

assert.strictEqual(pieceNo(0), "PIECE · 01");
assert.strictEqual(pieceNo(9), "PIECE · 10");

console.log("writing-cards.check: ok");
