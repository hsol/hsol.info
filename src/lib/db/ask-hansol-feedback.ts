import { neon } from "@neondatabase/serverless";

function getSql() {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) return null;
  return neon(url);
}

export function isAskHansolFeedbackDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL ?? process.env.POSTGRES_URL);
}

/**
 * 답변 1건(assistant 메시지)에 대한 세션별 평가를 upsert 한다.
 * 별점과 의견을 따로 보내도 같은 (session_id, message_id) 행을 갱신하며,
 * 이번에 전달된 값만 덮어쓴다(별점만 오면 의견은 유지, 반대도 마찬가지).
 * message_id는 실재하는 assistant 메시지여야 하며(FK), 아니면 저장하지 않는다.
 */
export async function upsertAskHansolFeedback(
  sessionId: string,
  messageId: string,
  rating: number | null,
  comment: string | null,
): Promise<boolean> {
  const sql = getSql();
  if (!sql) return false;

  const idNum = Number(messageId);
  if (!Number.isInteger(idNum) || idNum <= 0) return false;

  const safeRating =
    typeof rating === "number" && Number.isInteger(rating) && rating >= 1 && rating <= 5
      ? rating
      : null;
  const safeComment = comment && comment.trim() ? comment.trim().slice(0, 2000) : null;
  if (safeRating === null && safeComment === null) return false;

  // 이 메시지가 실제 이 세션의 assistant 메시지인지 확인 — 남의 세션/유저 메시지에 평가가 붙는 것을 막는다.
  const owner = await sql`
    SELECT 1
    FROM ask_hansol_messages
    WHERE id = ${idNum} AND session_id = ${sessionId} AND role = 'assistant'
    LIMIT 1
  `;
  if (owner.length === 0) return false;

  await sql`
    INSERT INTO ask_hansol_feedback (session_id, message_id, rating, comment)
    VALUES (${sessionId}, ${idNum}, ${safeRating}, ${safeComment})
    ON CONFLICT (session_id, message_id) DO UPDATE SET
      rating = COALESCE(EXCLUDED.rating, ask_hansol_feedback.rating),
      comment = COALESCE(EXCLUDED.comment, ask_hansol_feedback.comment),
      updated_at = now()
  `;
  return true;
}
