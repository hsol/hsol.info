/**
 * site-data-patch 순수 로직 자체검증. 실행: `npx tsx scripts/lib/site-data-patch.test.ts`
 * 프레임워크 없음 — node:assert 로 깨지면 던진다.
 */
import assert from "node:assert/strict";
import { parsePath, setByPath } from "./site-data-patch";

// parsePath: 점·대괄호·중첩·공백
assert.deepEqual(parsePath("publications"), ["publications"]);
assert.deepEqual(parsePath("career[2].points"), ["career", 2, "points"]);
assert.deepEqual(parsePath("portfolioCopy.builder.blog"), ["portfolioCopy", "builder", "blog"]);
assert.deepEqual(parsePath("viewHeaders.hire.lede"), ["viewHeaders", "hire", "lede"]);
assert.deepEqual(parsePath(" a . b [0] "), ["a", "b", 0]);

// setByPath: 최상위 키 교체
{
  const o: any = { career: [{ points: ["a"] }], faq: [] };
  assert.equal(setByPath(o, parsePath("faq"), [{ q: "x" }]), true);
  assert.deepEqual(o.faq, [{ q: "x" }]);
}
// setByPath: 배열 원소 하위 경로 교체
{
  const o: any = { career: [{ points: ["a"] }, { points: ["b"] }, { points: ["c"] }] };
  assert.equal(setByPath(o, parsePath("career[2].points"), ["z"]), true);
  assert.deepEqual(o.career[2].points, ["z"]);
  assert.deepEqual(o.career[0].points, ["a"]); // 다른 원소 불변
}
// setByPath: 깊은 객체 경로 교체
{
  const o: any = { portfolioCopy: { builder: { blog: ["old"] }, hire: { x: 1 } } };
  assert.equal(setByPath(o, parsePath("portfolioCopy.builder.blog"), ["new"]), true);
  assert.deepEqual(o.portfolioCopy.builder.blog, ["new"]);
  assert.deepEqual(o.portfolioCopy.hire, { x: 1 }); // 형제 불변
}
// setByPath: 존재하지 않는 경로/인덱스 → false, 변형 없음
{
  const o: any = { career: [{ points: ["a"] }] };
  assert.equal(setByPath(o, parsePath("career[5].points"), ["z"]), false); // 인덱스 없음
  assert.equal(setByPath(o, parsePath("nope.deep"), ["z"]), false); // 키 없음
  assert.equal(setByPath(o, parsePath("career[0].newField"), ["z"]), false); // 신규 필드 생성 안 함
  assert.deepEqual(o, { career: [{ points: ["a"] }] }); // 원본 그대로
}
// setByPath: 스칼라를 중간 경로로 타고 들어가면 false
{
  const o: any = { identity: "scalar" };
  assert.equal(setByPath(o, parsePath("identity.name"), "x"), false);
}

console.log("site-data-patch: all assertions passed.");
