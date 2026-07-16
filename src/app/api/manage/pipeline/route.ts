import type { NextRequest } from "next/server";

import { MANAGE_COOKIE, verifySession } from "@/lib/manage-auth";
import { loadPipelineFlags, parsePipelineFlagPatch } from "@/lib/pipeline-flags";
import { writePipelineFlag } from "@/lib/pipeline-flags-write";

// DB·Edge Config 를 런타임에 읽고 쓰므로 정적화 금지. Node 런타임(fetch·crypto·env).
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest) {
  // 1) 세션 검증 — /api/* 는 미들웨어 matcher 에서 제외돼 게이트 밖이다. 여기가 유일한 방어선.
  const token = req.cookies.get(MANAGE_COOKIE)?.value;
  const secret = process.env.MANAGE_SESSION_SECRET;
  const session = token && secret ? await verifySession(token, secret) : null;
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // 2) 바디 파싱·검증
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Bad JSON" }, { status: 400 });
  }
  const patch = parsePipelineFlagPatch(body);
  if (!patch) return Response.json({ error: "Invalid flag" }, { status: 400 });

  // 3) env-고정 재확인 — 클라이언트가 잠긴 토글을 우회해 보내도 서버가 막는다.
  const before = await loadPipelineFlags();
  if (before.source[patch.key] === "env") {
    return Response.json({ error: "고정된 플래그입니다" }, { status: 409 });
  }

  // 4) 쓰기
  const result = await writePipelineFlag(patch.key, patch.value);
  if (!result.ok) {
    return Response.json({ error: result.message }, { status: result.status });
  }

  // 5) 방금 쓴 값을 권위값으로 반환한다. Edge Config 는 write 직후 read 가 stale 일 수 있어
  //    재조회하지 않는다. 쓴 키는 env 가 아니므로(3단계 통과) 유효값 = 쓴 값. locked 는 write 와 무관.
  const flags = { ...before.flags, [patch.key]: patch.value };
  const locked = {
    contents: before.source.contents === "env",
    onepager: before.source.onepager === "env",
  };
  return Response.json({ flags, locked });
}
