-- Ask Hansol 답변 평가(별점·의견) 저장 (Neon). 프로젝트 SQL 에디터 또는 psql에서 한 번 실행.
-- 답변 1건(assistant 메시지)당 세션별 평가 1행 — 별점·의견을 나눠 보내도 같은 행을 갱신한다.
CREATE TABLE IF NOT EXISTS ask_hansol_feedback (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  message_id BIGINT NOT NULL REFERENCES ask_hansol_messages (id) ON DELETE CASCADE,
  rating SMALLINT CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_ask_hansol_feedback_message
  ON ask_hansol_feedback (message_id);
