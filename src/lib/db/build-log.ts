import { neon } from "@neondatabase/serverless";

/**
 * 빌드 로그 — 매 리프레시마다 에이전트가 "무엇을 어떤 의도로 개선했는지"를 누적하는 DB 로그.
 * site-data 는 매 실행 재생성되어 누적에 안 맞으므로, 상세 내역은 여기(Neon)에 쌓는다.
 * footer 의 빌드 버전을 누르면 보이는 /build-log 페이지가 이 테이블을 읽는다.
 */

export type BuildLogRow = {
  id: string;
  version: string;
  lens: string | null;
  changes: string[];
  created_at: string;
};

const LIST_LIMIT = 100;

function getSql() {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) return null;
  return neon(url);
}

export function isBuildLogDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL ?? process.env.POSTGRES_URL);
}

/** 테이블 보장(멱등). 마이그레이션을 따로 돌리지 않아도 CI에서 동작하도록. */
async function ensureTable(sql: NonNullable<ReturnType<typeof getSql>>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS build_log (
      id BIGSERIAL PRIMARY KEY,
      version TEXT NOT NULL,
      lens TEXT,
      changes JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
}

/** 한 회차 빌드 로그를 적층한다. DB 미설정이면 조용히 무시. */
export async function recordBuildLog(entry: {
  version: string;
  lens?: string | null;
  changes: string[];
}): Promise<void> {
  const sql = getSql();
  if (!sql) return;
  await ensureTable(sql);
  await sql`
    INSERT INTO build_log (version, lens, changes)
    VALUES (${entry.version}, ${entry.lens ?? null}, ${JSON.stringify(entry.changes)}::jsonb)
  `;
}

/** 최신순 빌드 로그. DB 미설정/테이블 없음이면 빈 배열. */
export async function listBuildLog(limit = LIST_LIMIT): Promise<BuildLogRow[]> {
  const sql = getSql();
  if (!sql) return [];
  try {
    const rows = await sql`
      SELECT id::text AS id, version, lens, changes, created_at::text AS created_at
      FROM build_log
      ORDER BY id DESC
      LIMIT ${limit}
    `;
    return rows as BuildLogRow[];
  } catch {
    // 테이블이 아직 없으면(첫 리프레시 전) 빈 로그로 취급.
    return [];
  }
}
