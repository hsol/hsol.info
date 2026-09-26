import { NextResponse } from "next/server";

/**
 * Vercel Cron -> GitHub `watch-onedrive.yml` 디스패치. GitHub 스케줄(cron)이 밀리거나 빠져도
 * OneDrive vault 변경 감시(기사 DB 반영, 사이트 재생성 디스패치)가 매시 돌게 하는 보조 트리거다.
 *
 * 최근 40분 안에 감시 실행이 이미 있었으면(GitHub 스케줄이나 수동 실행) 건너뛴다.
 *
 * 환경변수
 *   CRON_SECRET            Vercel Cron 이 Authorization: Bearer 로 붙여 보내는 값. 없으면 거부
 *   GITHUB_DISPATCH_TOKEN  hsol/hsol.info 의 Actions 쓰기 권한이 있는 토큰(fine-grained 권장). 없으면 건너뜀
 *   (선택) GITHUB_DISPATCH_REPO(기본 hsol/hsol.info), GITHUB_DISPATCH_REF(기본 dev)
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WORKFLOW = "watch-onedrive.yml";
const RECENT_MS = 40 * 60 * 1000;

async function gh(path: string, token: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "hsol.info-cron",
      ...(init.headers as Record<string, string> | undefined),
    },
    cache: "no-store",
  });
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const token = process.env.GITHUB_DISPATCH_TOKEN?.trim();
  if (!token) return NextResponse.json({ skipped: "GITHUB_DISPATCH_TOKEN 미설정" }, { status: 200 });

  const repo = process.env.GITHUB_DISPATCH_REPO || "hsol/hsol.info";
  const ref = process.env.GITHUB_DISPATCH_REF || "dev";

  const runsRes = await gh(`/repos/${repo}/actions/workflows/${WORKFLOW}/runs?per_page=1`, token);
  if (runsRes.ok) {
    const runs = (await runsRes.json()) as { workflow_runs?: { created_at: string; event: string }[] };
    const latest = runs.workflow_runs?.[0];
    if (latest && Date.now() - Date.parse(latest.created_at) < RECENT_MS) {
      return NextResponse.json({ skipped: "최근 실행 있음", latest });
    }
  }

  const res = await gh(`/repos/${repo}/actions/workflows/${WORKFLOW}/dispatches`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ref }),
  });
  if (res.status !== 204) {
    const detail = await res.text().catch(() => "");
    console.error(`[cron/watch-onedrive] dispatch 실패 HTTP ${res.status} ${detail.slice(0, 300)}`);
    return NextResponse.json({ error: "dispatch 실패", status: res.status }, { status: 502 });
  }
  return NextResponse.json({ dispatched: WORKFLOW, ref });
}
