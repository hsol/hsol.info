import { neon } from "@neondatabase/serverless";

/**
 * /manage 관리 콘솔 **전용** 조회. 방문자용 `ask-hansol-messages.ts` 와 분리한 이유:
 * 방문자용 `listAskHansolMessages` 는 평가 유무만 boolean 으로 내려준다. 관리 화면에
 * 별점·의견 본문을 띄우려고 그 함수에 rating·comment 를 추가하면, 같은 함수를 쓰는
 * 방문자용 Ask Hansol API 가 남의 평가 본문을 그대로 응답에 실어 보낸다.
 * 중복이 아니라 노출면 분리다.
 */

/** 한 페이지에 보여줄 세션 수. 자르기는 lib/pagination.ts 의 paginate() 가 인메모리로 한다. */
export const MANAGE_SESSIONS_PER_PAGE = 20;

/** 마지막 답변 미리보기 길이(자). */
const PREVIEW_CHARS = 100;

/** 세션 하나에서 읽어올 최대 메시지 수. */
const MESSAGE_LIMIT = 200;

export type ManageSessionRow = {
  session_id: string;
  /** 화면의 `문답 N회`. */
  user_count: number;
  /** 화면에 직접 뜨지 않는다 — user_count 와 다를 때 ⚠ 배지 판정에만 쓴다. */
  assistant_count: number;
  last_at: string;
  /** 마지막 답변 앞부분. 답변이 하나도 없는 세션이면 null. */
  preview: string | null;
  has_rating: boolean;
};

export type ManageMessageRow = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  rating: number | null;
  comment: string | null;
};

function getSql() {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) return null;
  return neon(url);
}

/**
 * 질문 수와 답변 수가 어긋난 세션에만 붙는 배지 라벨. 같으면 null.
 * 숫자 둘을 나란히 띄우고 사람이 매번 비교하게 하는 대신 시스템이 판정한다 —
 * 정상 세션은 조용하고 이상 세션만 튄다.
 */
export function mismatchLabel(userCount: number, assistantCount: number): string | null {
  if (userCount === assistantCount) return null;
  const diff = Math.abs(userCount - assistantCount);
  return userCount > assistantCount ? `⚠ 답변 ${diff} 누락` : `⚠ 질문 ${diff} 누락`;
}

/**
 * 전체 세션을 최신순으로. 페이지 자르기는 호출부에서 paginate() 가 한다.
 * `/news`·`/build-log` 와 같은 관례(목록 전체 로드 후 인메모리 slice)이며,
 * 임의의 LIMIT 을 두지 않는다 — 세션이 조용히 사라지는 편이 더 나쁘다.
 */
export async function listAskHansolSessionsForManage(): Promise<ManageSessionRow[]> {
  const sql = getSql();
  if (!sql) return [];

  const rows = await sql`
    WITH agg AS (
      SELECT session_id,
             count(*) FILTER (WHERE role = 'user')::int      AS user_count,
             count(*) FILTER (WHERE role = 'assistant')::int AS assistant_count,
             max(created_at) AS last_at,
             max(id)         AS last_id
      FROM ask_hansol_messages
      GROUP BY session_id
    ),
    last_answer AS (
      SELECT DISTINCT ON (session_id) session_id, content
      FROM ask_hansol_messages
      WHERE role = 'assistant'
      ORDER BY session_id, id DESC
    )
    SELECT a.session_id,
           a.user_count,
           a.assistant_count,
           a.last_at::text AS last_at,
           left(la.content, ${PREVIEW_CHARS}) AS preview,
           EXISTS (
             SELECT 1 FROM ask_hansol_feedback f WHERE f.session_id = a.session_id
           ) AS has_rating
    FROM agg a
    LEFT JOIN last_answer la ON la.session_id = a.session_id
    ORDER BY a.last_id DESC
  `;
  return rows as ManageSessionRow[];
}

/** 세션 하나의 전체 대화 + 평가 본문. 방문자용과 달리 rating·comment 를 그대로 내려준다. */
export async function listAskHansolMessagesForManage(
  sessionId: string,
): Promise<ManageMessageRow[]> {
  const sql = getSql();
  if (!sql || !sessionId) return [];

  const rows = await sql`
    SELECT m.id::text AS id,
           m.role,
           m.content,
           m.created_at::text AS created_at,
           f.rating,
           f.comment
    FROM ask_hansol_messages m
    LEFT JOIN ask_hansol_feedback f
      ON f.message_id = m.id AND f.session_id = m.session_id
    WHERE m.session_id = ${sessionId}
    ORDER BY m.id ASC
    LIMIT ${MESSAGE_LIMIT}
  `;
  return rows as ManageMessageRow[];
}
