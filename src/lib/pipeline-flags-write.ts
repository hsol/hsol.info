import { get } from "@vercel/edge-config";

import type { PipelineFlags } from "./pipeline-flags";

/**
 * /manage 전용 Edge Config 쓰기. 읽기(@vercel/edge-config get)는 read-only 라
 * 쓰기는 Vercel REST API 를 쓴다. contentPipeline 전체 오브젝트를 병합해 갱신한다.
 */

/** EDGE_CONFIG 연결문자열 경로의 `ecfg_…` 스토어ID 를 추출. 형식 불량이면 null. */
export function parseEdgeConfigStoreId(connectionString: string | undefined): string | null {
  if (!connectionString) return null;
  const m = connectionString.match(/edge-config\.vercel\.com\/(ecfg_[A-Za-z0-9]+)/);
  return m ? m[1] : null;
}

export type WriteResult = { ok: true } | { ok: false; status: number; message: string };

/**
 * contentPipeline 의 한 키만 바꿔 전체 오브젝트를 Edge Config 에 쓴다.
 * - 현재 raw 오브젝트를 읽어(get) 다른 키를 보존한다(env 오버라이드 적용 전 원본).
 * - 키가 이미 있으면 update, 없으면 create (Vercel batch API 는 upsert 미제공).
 */
export async function writePipelineFlag(
  key: keyof PipelineFlags,
  value: boolean,
): Promise<WriteResult> {
  const storeId = parseEdgeConfigStoreId(process.env.EDGE_CONFIG);
  const token = process.env.VERCEL_TOKEN;
  const teamId = process.env.VERCEL_TEAM_ID;
  if (!storeId || !token || !teamId) {
    return { ok: false, status: 500, message: "Edge Config 쓰기 환경 미설정" };
  }

  let current: Record<string, unknown> = {};
  let existed = false;
  try {
    const raw = (await get("contentPipeline")) as Record<string, unknown> | undefined;
    if (raw && typeof raw === "object") {
      current = raw;
      existed = true;
    }
  } catch {
    // 읽기 실패해도 create 로 쓰기를 시도한다.
  }

  const next = { ...current, [key]: value };

  const res = await fetch(
    `https://api.vercel.com/v1/edge-config/${storeId}/items?teamId=${teamId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [{ operation: existed ? "update" : "create", key: "contentPipeline", value: next }],
      }),
    },
  );

  if (!res.ok) {
    return { ok: false, status: res.status, message: `Edge Config 쓰기 실패 (${res.status})` };
  }
  return { ok: true };
}
