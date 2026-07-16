/**
 * Edge Config 쓰기 순수 로직 자체 점검(스토어ID 파싱만 — 실제 쓰기는 라이브 API 라 제외):
 *   npx tsx src/lib/pipeline-flags-write.check.ts
 */
import assert from "node:assert";

import { parseEdgeConfigStoreId } from "./pipeline-flags-write";

assert(
  parseEdgeConfigStoreId("https://edge-config.vercel.com/ecfg_abc123?token=xyz") === "ecfg_abc123",
  "token 있는 정상 문자열에서 추출 실패",
);
assert(
  parseEdgeConfigStoreId("https://edge-config.vercel.com/ecfg_abc123") === "ecfg_abc123",
  "token 없는 정상 문자열에서 추출 실패",
);
assert(parseEdgeConfigStoreId(undefined) === null, "undefined 가 null 이 아님");
assert(parseEdgeConfigStoreId("") === null, "빈 문자열이 null 이 아님");
assert(parseEdgeConfigStoreId("nonsense") === null, "형식 불량이 null 이 아님");
assert(
  parseEdgeConfigStoreId("https://example.com/ecfg_bad") === null,
  "엉뚱한 호스트가 통과됨",
);

console.log("✓ pipeline-flags-write self-check passed");
