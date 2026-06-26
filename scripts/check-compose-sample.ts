/**
 * compose 샘플 트리 검증(헤드리스).
 * ------------------------------------------------------------------
 * ComposeRenderer 가 런타임에 거치는 검증 경로를 그대로 흉내낸다:
 *   1) siteCompositionSchema 로 트리 "형태" 검증
 *   2) 각 노드를 매니페스트의 propsSchema 로 재귀 검증(렌더에서 노드 스킵 판정과 동일)
 * 잘못된 노드가 정확히 걸러지는지(가드레일)도 확인한다.
 *
 * 실행: npx tsx scripts/check-compose-sample.ts
 */

import { siteCompositionSchema, type ComposeNode } from "@/content/compose/schema";
import { COMPOSE_MANIFEST } from "@/content/compose/manifest";

const GOOD = {
  pages: {
    curious: {
      nodes: [
        { component: "Back" },
        {
          component: "Section",
          props: { title: "사람으로서의 궤적", num: 1, meta: "TIMELINE", dataSection: "curious-timeline" },
          children: [
            { component: "Prose", props: { text: "여기는 **이력서에 안 적는** 이야기입니다.\n\n두 번째 문단." } },
            { component: "Gantt" },
          ],
        },
        {
          component: "Section",
          props: { title: "요즘의 노트", num: 2 },
          children: [
            {
              component: "Grid",
              props: { cols: 3 },
              children: [
                { component: "CardGrid", props: { items: [{ title: "A", body: "본문 A" }, { title: "B", body: "본문 B", href: "https://blog.hsol.info" }] } },
                { component: "ChipList", props: { label: "관심사", items: ["AI", "O2O", "DX"] } },
                { component: "KeyValueList", props: { items: [{ k: "거점", v: "서울" }, { k: "since", v: "2014" }] } },
              ],
            },
            { component: "Divider" },
            { component: "MetricGrid", props: { items: [{ value: "1,000+", label: "블로그 글", note: "10년 누적" }], cols: 3 } },
            { component: "Callout", props: { eyebrow: "한 줄", body: "**말과 행동을 맞추는 일**.", tone: "accent" } },
            { component: "Quote", props: { text: "문제가 먼저다.", cite: "임한솔" } },
            { component: "CareerTimeline", props: { persona: "curious" } },
            { component: "Pillars" },
          ],
        },
        { component: "CoffeeCTA", props: { title: "이야기 나눠요", sub: "편하게 잡아주세요." } },
      ],
    },
  },
};

/** 의도적으로 깨진 노드들: 렌더에서 "그 노드만 스킵" 되어야 한다. */
const BAD_NODES: ComposeNode[] = [
  { component: "NopeComponent", props: {} }, // 미등록
  { component: "Heading", props: { level: 5 } }, // text 누락 + level 범위 밖
  { component: "MetricGrid", props: { items: [] } }, // min(1) 위반
  { component: "LinkList", props: { items: [{ label: "x", href: "not-a-url" }] } }, // url 아님
  { component: "Section", props: { title: "ok", bogus: 1 } }, // strict 위반(잉여 키)
];

function validateNode(node: ComposeNode, path: string): { ok: number; skipped: number } {
  let ok = 0;
  let skipped = 0;
  const entry = COMPOSE_MANIFEST[node.component as keyof typeof COMPOSE_MANIFEST];
  if (!entry) {
    skipped++;
    console.log(`  ⤫ skip(unknown)  ${path} ${node.component}`);
    return { ok, skipped };
  }
  const parsed = entry.propsSchema.safeParse(node.props ?? {});
  if (!parsed.success) {
    skipped++;
    console.log(`  ⤫ skip(props)    ${path} ${node.component} — ${parsed.error.issues.map((i) => i.message).join("; ")}`);
    return { ok, skipped };
  }
  ok++;
  if (entry.container && node.children?.length) {
    node.children.forEach((c, i) => {
      const r = validateNode(c, `${path}.${i}`);
      ok += r.ok;
      skipped += r.skipped;
    });
  }
  return { ok, skipped };
}

function main() {
  console.log("[1] 트리 형태 검증(siteCompositionSchema) …");
  const shape = siteCompositionSchema.safeParse(GOOD);
  if (!shape.success) {
    console.error("  ✗ 형태 검증 실패:", shape.error.issues);
    process.exit(1);
  }
  console.log("  ✓ 형태 OK");

  console.log("[2] 정상 트리 노드별 propsSchema 검증 …");
  let ok = 0;
  let skipped = 0;
  for (const node of shape.data.pages.curious!.nodes) {
    const r = validateNode(node, "curious");
    ok += r.ok;
    skipped += r.skipped;
  }
  console.log(`  → 렌더될 노드 ${ok}개, 스킵 ${skipped}개`);
  if (skipped !== 0) {
    console.error("  ✗ 정상 트리인데 스킵된 노드가 있습니다.");
    process.exit(1);
  }
  console.log("  ✓ 정상 트리 전부 통과");

  console.log("[3] 깨진 노드 가드레일(전부 스킵되어야 함) …");
  let badSkipped = 0;
  BAD_NODES.forEach((n, i) => {
    const r = validateNode(n, `bad[${i}]`);
    badSkipped += r.skipped;
    if (r.ok > 0) console.error(`  ✗ 통과되면 안 되는 노드가 통과됨: ${n.component}`);
  });
  if (badSkipped !== BAD_NODES.length) {
    console.error(`  ✗ 깨진 노드 ${BAD_NODES.length}개 중 ${badSkipped}개만 스킵됨`);
    process.exit(1);
  }
  console.log(`  ✓ 깨진 노드 ${badSkipped}개 모두 스킵`);

  console.log("\n✅ compose 샘플 트리 검증 통과");
}

main();
