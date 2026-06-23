/**
 * DEFAULT_LAYOUT(코드) + layout-overrides(사람) 를 합쳐
 * blob 소스 site-data.json 의 `layout` 필드로 스냅샷한다.
 *
 *   npm run content:layout:snapshot
 *
 * 용도:
 *  - 초기 버전 레이아웃을 데이터로 한 번 박아 두기(현재 작업).
 *  - 사람이 DEFAULT_LAYOUT/overrides 를 손본 뒤 데이터에 반영하기.
 *
 * 주의: CICD 의 content:refresh:claude 가 layout 을 emit 하기 전(Phase 2)까지는,
 * refresh 가 돌면 이 layout 스냅샷이 사라질 수 있다. 그래도 코드의 DEFAULT_LAYOUT
 * 이 폴백이라 화면은 동일하게 유지된다.
 */
import { readFile, writeFile } from "node:fs/promises";
import { DEFAULT_LAYOUT } from "../src/content/default-layout";
import { LAYOUT_OVERRIDES, mergeLayout } from "../src/content/layout-overrides";
import { layoutSchema } from "../src/content/layout-types";

const SITE_DATA_PATH =
  process.env.VAULT_SITE_DATA_PATH ?? "hsol-info-blob/vault/object-views/site-data.json";

async function main() {
  const merged = mergeLayout(DEFAULT_LAYOUT, LAYOUT_OVERRIDES);
  const layout = layoutSchema.parse(merged); // 가드레일: 잠긴 페이지 키·블록 타입만 통과

  const raw = await readFile(SITE_DATA_PATH, "utf8");
  const obj = JSON.parse(raw) as Record<string, unknown>;
  obj.layout = layout;
  await writeFile(SITE_DATA_PATH, JSON.stringify(obj, null, 2) + "\n", "utf8");

  const pages = Object.keys(layout.pages ?? {});
  console.log(`[snapshot-layout] site-data.json 에 layout 반영 — pages: ${pages.join(", ")}`);
}

main().catch((err) => {
  console.error("[snapshot-layout] 실패:", err);
  process.exit(1);
});
