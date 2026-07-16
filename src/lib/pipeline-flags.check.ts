/**
 * 공유 플래그 순수 로직 자체 점검:
 *   npx tsx src/lib/pipeline-flags.check.ts
 */
import assert from "node:assert";

import { parsePipelineFlagPatch } from "./pipeline-flags";

// 유효 입력
assert.deepStrictEqual(parsePipelineFlagPatch({ key: "contents", value: true }), {
  key: "contents",
  value: true,
});
assert.deepStrictEqual(parsePipelineFlagPatch({ key: "onepager", value: false }), {
  key: "onepager",
  value: false,
});

// 무효 입력 → null
assert(parsePipelineFlagPatch({ key: "unknown", value: true }) === null, "알 수 없는 키가 통과됨");
assert(parsePipelineFlagPatch({ key: "contents", value: "true" }) === null, "비불리언 value 가 통과됨");
assert(parsePipelineFlagPatch({ key: "contents" }) === null, "value 누락이 통과됨");
assert(parsePipelineFlagPatch(null) === null, "null 이 통과됨");
assert(parsePipelineFlagPatch("nope") === null, "문자열이 통과됨");

console.log("✓ pipeline-flags self-check passed");
