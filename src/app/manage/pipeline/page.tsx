import { loadPipelineFlags } from "@/lib/pipeline-flags";

import { FlagToggle } from "./flag-toggle";

export const dynamic = "force-dynamic";

const FLAG_META: { key: "contents" | "onepager"; label: string; desc: string }[] = [
  { key: "contents", label: "콘텐츠 파이프라인", desc: "사이트 본문·구조 진화 (G2 게이트)" },
  { key: "onepager", label: "원페이저", desc: "이력서 한 장 HTML" },
];

export default async function PipelinePage() {
  const { flags, source, edgeConfigOk } = await loadPipelineFlags();

  return (
    <div className="manage-panel">
      <div className="manage-panel-head">
        <h1 className="manage-panel-title">빌드 파이프라인</h1>
        <p className="manage-panel-note">
          이 설정은 다음 빌드/리프레시부터 적용됩니다 — 라이브 사이트가 즉시 바뀌지 않습니다.
          {!edgeConfigOk && " (Edge Config 미연결 — 기본값 표시, 수정 불가)"}
        </p>
      </div>
      <ul className="manage-flag-list">
        {FLAG_META.map((f) => {
          // env 오버라이드가 있거나 Edge Config 미연결이면 여기서 바꿀 수 없다.
          const locked = source[f.key] === "env" || !edgeConfigOk;
          return (
            <li key={f.key} className="manage-flag-row">
              <div className="manage-flag-info">
                <span className="manage-flag-label">{f.label}</span>
                <span className="manage-flag-desc">{f.desc}</span>
              </div>
              <FlagToggle flagKey={f.key} value={flags[f.key]} locked={locked} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
