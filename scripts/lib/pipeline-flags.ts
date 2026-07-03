import { get } from "@vercel/edge-config";

/**
 * 콘텐츠 리프레시 파이프라인의 "종류별 LLM 동작" 토글.
 *
 * 소스는 Vercel Edge Config 의 `contentPipeline` 키(대시보드/관리 API 로 재배포 없이 토글).
 * 우선순위: **명시된 env 오버라이드 ?? Edge Config ?? 기본값**.
 *   - env 는 특정 회차만 강제하고 싶을 때의 비상 오버라이드로 남겨둔다(CI 한 줄로 강제 on/off).
 *   - `EDGE_CONFIG` 연결 문자열이 없거나 읽기 실패 시엔 env+기본값만으로 **오늘과 동일하게** 동작한다.
 */
export type PipelineFlags = {
  /** site-data.json 본문(emit_site_data) LLM 갱신. off 면 기존 site-data 를 그대로 베이스로 재사용. */
  siteData: boolean;
  /** 포트폴리오 레퍼런스 웹 리서치(web_search/web_fetch). off 면 리서치 없이 빌더만 돈다. */
  research: boolean;
  /** 레이아웃 빌더(섹션 순서·포함/제외 진화). */
  layout: boolean;
  /** 컴포지션 빌더(생성형 컴포넌트 트리, 점진 도입). */
  composition: boolean;
  /** 원페이저(이력서 한 장 HTML) 빌더. */
  onepager: boolean;
};

/** Edge Config·env 모두 비었을 때의 기본값 = 기존 스크립트 동작과 동일. */
export const DEFAULT_PIPELINE_FLAGS: PipelineFlags = {
  siteData: true,
  research: true,
  layout: true,
  composition: false,
  onepager: true,
};

/** env 를 명시적으로 세팅했을 때만 boolean, 아니면 undefined(= 오버라이드 없음). */
function envOverride(...names: string[]): boolean | undefined {
  for (const name of names) {
    const raw = process.env[name];
    if (raw == null || raw.trim() === "") continue;
    const v = raw.trim().toLowerCase();
    return !(v === "0" || v === "false" || v === "no");
  }
  return undefined;
}

/** 각 플래그의 env 오버라이드 이름(기존 변수와 하위호환). */
const ENV_NAMES: Record<keyof PipelineFlags, string[]> = {
  siteData: ["CONTENT_SITE_DATA"],
  research: ["CONTENT_RESEARCH"],
  layout: ["LAYOUT_BUILDER", "LAYOUT_RESEARCH"],
  composition: ["COMPOSITION_BUILDER"],
  onepager: ["ONEPAGER_BUILDER"],
};

function coerceBool(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "1" || v === "true" || v === "yes") return true;
    if (v === "0" || v === "false" || v === "no") return false;
  }
  return undefined;
}

/**
 * Edge Config `contentPipeline` 를 읽어 env·기본값과 병합한 최종 플래그를 돌려준다.
 * `source` 는 각 플래그가 어디서 결정됐는지(env/edge-config/default) 로깅용.
 */
export async function loadPipelineFlags(): Promise<{
  flags: PipelineFlags;
  source: Record<keyof PipelineFlags, "env" | "edge-config" | "default">;
  edgeConfigOk: boolean;
}> {
  let ec: Partial<Record<keyof PipelineFlags, unknown>> = {};
  let edgeConfigOk = false;
  if (process.env.EDGE_CONFIG) {
    try {
      const raw = (await get("contentPipeline")) as Record<string, unknown> | undefined;
      if (raw && typeof raw === "object") {
        ec = raw as Partial<Record<keyof PipelineFlags, unknown>>;
        edgeConfigOk = true;
      }
    } catch {
      // 연결 실패·키 없음 → env+기본값으로 폴백(빌드가 죽지 않게).
      edgeConfigOk = false;
    }
  }

  const flags = {} as PipelineFlags;
  const source = {} as Record<keyof PipelineFlags, "env" | "edge-config" | "default">;
  for (const key of Object.keys(DEFAULT_PIPELINE_FLAGS) as (keyof PipelineFlags)[]) {
    const env = envOverride(...ENV_NAMES[key]);
    const cfg = coerceBool(ec[key]);
    if (env !== undefined) {
      flags[key] = env;
      source[key] = "env";
    } else if (cfg !== undefined) {
      flags[key] = cfg;
      source[key] = "edge-config";
    } else {
      flags[key] = DEFAULT_PIPELINE_FLAGS[key];
      source[key] = "default";
    }
  }
  return { flags, source, edgeConfigOk };
}
