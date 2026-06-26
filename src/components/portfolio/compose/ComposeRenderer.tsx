"use client";

/**
 * ComposeRenderer — 컴포지션 트리(노드 배열)를 재귀로 렌더한다.
 * ------------------------------------------------------------------
 * 노드마다:
 *   1) 매니페스트에서 component 를 찾는다. 미등록이면 스킵(가드레일).
 *   2) 매니페스트의 propsSchema 로 props 를 safeParse. 실패하면 그 노드만 스킵.
 *   3) 컨테이너면 children 을 재귀 렌더해 함께 넘긴다.
 *
 * 잘못된 노드 하나가 페이지를 무너뜨리지 않도록, 모든 실패는 "그 노드만 건너뜀"으로 격리한다.
 */

import { Fragment, type ReactNode } from "react";
import { COMPOSE_MANIFEST } from "@/content/compose/manifest";
import type { ComposeNode } from "@/content/compose/schema";
import { COMPOSE_COMPONENTS } from "@/components/portfolio/compose/registry";

function renderNode(node: ComposeNode, key: string): ReactNode {
  const entry = COMPOSE_MANIFEST[node.component as keyof typeof COMPOSE_MANIFEST];
  const Component = COMPOSE_COMPONENTS[node.component as keyof typeof COMPOSE_COMPONENTS];
  if (!entry || !Component) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[compose] 알 수 없는 component '${node.component}' — 건너뜀`);
    }
    return null;
  }

  const parsed = entry.propsSchema.safeParse(node.props ?? {});
  if (!parsed.success) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[compose] '${node.component}' props 검증 실패 — 건너뜀`, parsed.error.issues);
    }
    return null;
  }

  const children =
    entry.container && node.children?.length
      ? node.children.map((child, i) => renderNode(child, `${key}.${i}`))
      : undefined;

  return (
    <Fragment key={key}>
      {Component({ props: parsed.data, children })}
    </Fragment>
  );
}

export function ComposeRenderer({ nodes }: { nodes: ComposeNode[] }) {
  // .cz-page: 최상위 노드(섹션·ResumeCTA·divider·CTA 등)에 일관된 세로 리듬을 준다
  // (개별 블록이 자기 여백을 안 가져도 붙지 않게 — 최상위 배치 여백 누락 방지).
  return <div className="cz-page">{nodes.map((node, i) => renderNode(node, `n${i}`))}</div>;
}
