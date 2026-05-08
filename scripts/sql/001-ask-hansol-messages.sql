-- Ask Hansol 대화 저장 (Neon). 프로젝트 SQL 에디터 또는 psql에서 한 번 실행.
CREATE TABLE IF NOT EXISTS ask_hansol_messages (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ask_hansol_messages_session_created
  ON ask_hansol_messages (session_id, id);
  