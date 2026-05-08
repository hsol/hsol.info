import { neon } from "@neondatabase/serverless";

function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL ?? process.env.POSTGRES_URL);
}

/** Claude에 그대로 넣는 원문 턴 수(메시지 행 기준). 초과분은 요약 메모리로 흡수. */
export function rawHistoryMessageTailLimit(): number {
  const n = Number(process.env.ASK_HANSOL_RAW_HISTORY_MESSAGES ?? 24);
  if (!Number.isFinite(n)) return 24;
  return Math.min(64, Math.max(4, Math.floor(n)));
}

export type AskHansolSessionMemoryRow = {
  session_id: string;
  summary: string;
  summarized_through_id: string;
  updated_at: string;
};

function getSql() {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) return null;
  return neon(url);
}

export async function getSessionMemoryRow(
  sessionId: string,
): Promise<AskHansolSessionMemoryRow | null> {
  const sql = getSql();
  if (!sql) return null;
  const rows = await sql`
    SELECT session_id::text AS session_id,
      summary,
      summarized_through_id::text AS summarized_through_id,
      updated_at::text AS updated_at
    FROM ask_hansol_session_memory
    WHERE session_id = ${sessionId}
    LIMIT 1
  `;
  const row = rows[0] as AskHansolSessionMemoryRow | undefined;
  return row ?? null;
}

export async function upsertSessionMemoryRow(
  sessionId: string,
  summary: string,
  summarizedThroughId: string,
): Promise<void> {
  const sql = getSql();
  if (!sql) return;
  const idNum = Number(summarizedThroughId);
  const through = Number.isFinite(idNum) ? idNum : 0;
  await sql`
    INSERT INTO ask_hansol_session_memory (session_id, summary, summarized_through_id)
    VALUES (${sessionId}, ${summary}, ${through})
    ON CONFLICT (session_id) DO UPDATE SET
      summary = EXCLUDED.summary,
      summarized_through_id = EXCLUDED.summarized_through_id,
      updated_at = now()
  `;
}

/** 최근 tailLimit개 메시지 (오래된 것 제외), id 오름차순 — Claude messages용 */
export async function listTailMessagesForPrompt(
  sessionId: string,
  tailLimit: number,
): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
  const sql = getSql();
  if (!sql) return [];
  const lim = Math.max(1, Math.min(64, Math.floor(tailLimit)));
  const rows = await sql`
    SELECT role, content
    FROM (
      SELECT id, role, content
      FROM ask_hansol_messages
      WHERE session_id = ${sessionId}
      ORDER BY id DESC
      LIMIT ${lim}
    ) AS t
    ORDER BY id ASC
  `;
  return rows as Array<{ role: "user" | "assistant"; content: string }>;
}

/** 최근 tailLimit개 안에서 가장 작은 id (이 id 미만은 요약 대상 혹은 이미 요약됨) */
export async function getTailMinMessageId(
  sessionId: string,
  tailLimit: number,
): Promise<string | null> {
  const sql = getSql();
  if (!sql) return null;
  const lim = Math.max(1, Math.min(64, Math.floor(tailLimit)));
  const rows = await sql`
    SELECT MIN(id)::text AS min_id
    FROM (
      SELECT id
      FROM ask_hansol_messages
      WHERE session_id = ${sessionId}
      ORDER BY id DESC
      LIMIT ${lim}
    ) AS t
  `;
  const v = (rows[0] as { min_id: string | null } | undefined)?.min_id;
  return v && v !== "" ? v : null;
}

/** 요약에 새로 합칠 구간: summarized_through < id < tailMinId */
export async function listMessagesBetweenExclusive(
  sessionId: string,
  summarizedThroughId: string,
  tailMinId: string,
): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
  const sql = getSql();
  if (!sql) return [];
  const low = Number(summarizedThroughId);
  const high = Number(tailMinId);
  const lo = Number.isFinite(low) ? low : 0;
  const hi = Number.isFinite(high) ? high : 0;
  if (hi <= lo) return [];

  const rows = await sql`
    SELECT role, content
    FROM ask_hansol_messages
    WHERE session_id = ${sessionId}
      AND id > ${lo}
      AND id < ${hi}
    ORDER BY id ASC
  `;
  return rows as Array<{ role: "user" | "assistant"; content: string }>;
}

export async function getMaxMessageIdBelowTail(
  sessionId: string,
  tailMinId: string,
): Promise<string> {
  const sql = getSql();
  if (!sql) return "0";
  const hi = Number(tailMinId);
  if (!Number.isFinite(hi)) return "0";
  const rows = await sql`
    SELECT COALESCE(MAX(id), 0)::text AS m
    FROM ask_hansol_messages
    WHERE session_id = ${sessionId}
      AND id < ${hi}
  `;
  return (rows[0] as { m: string })?.m ?? "0";
}

export async function refreshSessionMemoryRollup(
  sessionId: string,
  tailLimit: number,
  summarizeMerge: (
    existingSummary: string,
    chunk: Array<{ role: "user" | "assistant"; content: string }>,
  ) => Promise<string | null>,
): Promise<void> {
  if (!isDbConfigured()) return;

  try {
    const lim = Math.max(1, Math.min(64, Math.floor(tailLimit)));
    const sql = getSql();
    if (!sql) return;

    const totalRows = await sql`
      SELECT COUNT(*)::text AS c
      FROM ask_hansol_messages
      WHERE session_id = ${sessionId}
    `;
    const total = Number((totalRows[0] as { c: string } | undefined)?.c ?? "0");
    if (!Number.isFinite(total) || total <= lim) return;

    const desiredRaw = ((total - 1) % lim) + 1;
    const desiredSummarized = total - desiredRaw;
    if (desiredSummarized <= 0) return;

    const mem = await getSessionMemoryRow(sessionId);
    const through = Number(mem?.summarized_through_id ?? "0");
    const safeThrough = Number.isFinite(through) ? through : 0;

    const summarizedRows = await sql`
      SELECT COUNT(*)::text AS c
      FROM ask_hansol_messages
      WHERE session_id = ${sessionId}
        AND id <= ${safeThrough}
    `;
    const currentSummarized = Number((summarizedRows[0] as { c: string } | undefined)?.c ?? "0");
    if (!Number.isFinite(currentSummarized)) return;

    const delta = desiredSummarized - currentSummarized;
    if (delta <= 0) return;

    const chunkRows = await sql`
      SELECT id::text AS id, role, content
      FROM ask_hansol_messages
      WHERE session_id = ${sessionId}
        AND id > ${safeThrough}
      ORDER BY id ASC
      LIMIT ${delta}
    `;
    if (chunkRows.length === 0) return;

    const chunk = (chunkRows as Array<{ id: string; role: "user" | "assistant"; content: string }>).map(
      (r) => ({ role: r.role, content: r.content }),
    );

    const merged = await summarizeMerge(mem?.summary ?? "", chunk);
    if (!merged?.trim()) return;

    const newThrough = (chunkRows[chunkRows.length - 1] as { id: string }).id;
    await upsertSessionMemoryRow(sessionId, merged.trim(), newThrough);
  } catch {
    /* 요약 실패 시 메모리·응답 모두 유지 */
  }
}
