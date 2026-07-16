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
  /**
   * 콘텐츠 파이프라인 전체 스위치: G2 콘텐츠 게이트 → siteData(본문) + 구조 진화 판정 → layout·composition.
   * off 면 이 전체를 스킵하고 기존 site-data 를 그대로 둔다. (옛 siteData·research 플래그를 하나로 합친 것.)
   */
  contents: boolean;
  /** 원페이저(이력서 한 장 HTML). contents 와 **독립** — 자체 진화 판정으로 게이팅(G2 와 무관). */
  onepager: boolean;
};

/** Edge Config·env 모두 비었을 때의 기본값. */
export const DEFAULT_PIPELINE_FLAGS: PipelineFlags = {
  contents: true,
  onepager: true,
};

/** 유효한 플래그 키 목록(런타임 검증용). DEFAULT 에서 파생 — 플래그가 늘면 자동 반영. */
export const PIPELINE_FLAG_KEYS = Object.keys(DEFAULT_PIPELINE_FLAGS) as (keyof PipelineFlags)[];

/**
 * HTTP 바디를 검증해 {key, value} 로 좁힌다. 유효하지 않으면 null.
 * 알 수 없는 키·비불리언·형태 불량을 모두 걸러 라우트가 안전하게 쓴다.
 */
export function parsePipelineFlagPatch(
  body: unknown,
): { key: keyof PipelineFlags; value: boolean } | null {
  if (!body || typeof body !== "object") return null;
  const { key, value } = body as { key?: unknown; value?: unknown };
  if (typeof value !== "boolean") return null;
  if (typeof key !== "string" || !PIPELINE_FLAG_KEYS.includes(key as keyof PipelineFlags)) {
    return null;
  }
  return { key: key as keyof PipelineFlags, value };
}

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

/** 각 플래그의 env 오버라이드 이름(기존 변수와 하위호환). 옛 CONTENT_SITE_DATA·CONTENT_RESEARCH 는 contents 로 통합. */
const ENV_NAMES: Record<keyof PipelineFlags, string[]> = {
  contents: ["CONTENT_PIPELINE", "CONTENT_SITE_DATA", "CONTENT_RESEARCH"],
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
