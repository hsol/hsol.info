import { neon } from "@neondatabase/serverless";

export type AskHansolMessageRow = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
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

  const rows = await sql`
    SELECT id::text AS id, role, content, created_at::text AS created_at
    FROM ask_hansol_messages
    WHERE session_id = ${sessionId}
    ORDER BY id ASC
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
