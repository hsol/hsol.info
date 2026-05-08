-- 세션별 긴 대화 메모리: 24개를 넘는 과거 구간은 요약으로 유지
CREATE TABLE IF NOT EXISTS ask_hansol_session_memory (
  session_id TEXT PRIMARY KEY,
  summary TEXT NOT NULL DEFAULT '',
  summarized_through_id BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
