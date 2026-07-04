import { neon } from "@neondatabase/serverless";

export type AskHansolMessageRow = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  /** 이 세션이 이 답변(assistant 메시지)에 이미 별점·의견을 남겼는지 — 남겼으면 평가 UI를 숨긴다. */
  has_feedback: boolean;
};

const LIST_LIMIT = 200;

function getSql() {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) return null;
  return neon(url);
}

export function isAskHansolDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL ?? process.env.POSTGRES_URL);
}

export async function listAskHansolMessages(sessionId: string): Promise<AskHansolMessageRow[]> {
  const sql = getSql();
  if (!sql) return [];

  // 답변별 평가 존재 여부를 함께 가져온다(LEFT JOIN). f.id 가 있으면 이미 평가한 답변.
  const rows = await sql`
    SELECT m.id::text AS id,
      m.role,
      m.content,
      m.created_at::text AS created_at,
      (f.id IS NOT NULL) AS has_feedback
    FROM ask_hansol_messages m
    LEFT JOIN ask_hansol_feedback f
      ON f.message_id = m.id AND f.session_id = m.session_id
    WHERE m.session_id = ${sessionId}
    ORDER BY m.id ASC
    LIMIT ${LIST_LIMIT}
  `;
  return rows as AskHansolMessageRow[];
}

export async function insertAskHansolMessage(
  sessionId: string,
  role: "user" | "assistant",
  content: string,
): Promise<void> {
  const sql = getSql();
  if (!sql) return;
  await sql`
    INSERT INTO ask_hansol_messages (session_id, role, content)
    VALUES (${sessionId}, ${role}, ${content})
  `;
}

/** insert 후 새 행 id 반환 — 답변 평가(피드백)를 이 id에 연결하려면 필요하다. DB 미설정 시 null. */
export async function insertAskHansolMessageReturningId(
  sessionId: string,
  role: "user" | "assistant",
  content: string,
): Promise<string | null> {
  const sql = getSql();
  if (!sql) return null;
  const rows = await sql`
    INSERT INTO ask_hansol_messages (session_id, role, content)
    VALUES (${sessionId}, ${role}, ${content})
    RETURNING id::text AS id
  `;
  return (rows[0] as { id?: string } | undefined)?.id ?? null;
}
