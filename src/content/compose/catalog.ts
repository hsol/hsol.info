/**
 * 컴포지션 빌더용 카탈로그(프롬프트 텍스트).
 * ------------------------------------------------------------------
 * COMPOSE_MANIFEST 를 LLM 빌더가 읽을 한국어 카탈로그로 렌더한다.
 * 빌더는 이 카탈로그만 보고 컴포넌트를 트리로 조합한다(SSOT=매니페스트).
 * React/DOM 의존 없음 — refresh 스크립트(node)에서 안전하게 import 가능.
 */

import {
  COMPOSE_MANIFEST,
  type ComposeComponentName,
  type ComposeManifestEntry,
} from "@/content/compose/manifest";

const entryOf = (name: ComposeComponentName): ComposeManifestEntry => COMPOSE_MANIFEST[name];

function tag(name: ComposeComponentName): string {
  const e = entryOf(name);
  const flags = [e.container ? "container" : "leaf", e.dataBound ? "data-bound" : null]
    .filter(Boolean)
    .join(", ");
  return `- ${name} [${flags}] — ${e.purpose}\n    모양: ${e.shape}\n    props: ${e.propsHint}`;
}

/** 빌더 프롬프트에 실을 컴포넌트 카탈로그 + 트리 규칙. */
export function renderComposeCatalog(): string {
  const names = Object.keys(COMPOSE_MANIFEST) as ComposeComponentName[];
  const containers = names.filter((n) => entryOf(n).container);
  const dataBound = names.filter((n) => entryOf(n).dataBound);
  const content = names.filter((n) => !entryOf(n).container && !entryOf(n).dataBound);

  return `[컴포넌트 카탈로그 — 이 안의 component 만 쓸 수 있다]
노드 형태: { "component": "이름", "props"?: { ... }, "children"?: [ ...노드 ] }
- container 만 children 을 가진다(leaf/data-bound 에 children 을 넣지 마라).
- data-bound 컴포넌트의 내용은 site-data 에서 자동으로 온다 — props 로 내용을 쓰지 말고 "배치"만 한다.
- content(leaf) 컴포넌트의 내용은 네가 vault 근거로 직접 작성한다.

# 컨테이너(children 허용)
${containers.map(tag).join("\n")}

# 콘텐츠(네가 내용 작성)
${content.map(tag).join("\n")}

# 데이터 바인딩(배치만 — 내용은 site-data 에서 자동)
${dataBound.map(tag).join("\n")}`;
}
