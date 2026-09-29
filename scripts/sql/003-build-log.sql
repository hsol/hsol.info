-- 빌드 로그: 매 리프레시마다 에이전트가 남기는 레이아웃 개선 의도/내역 (Neon).
-- 리프레시 스크립트가 INSERT 시 CREATE TABLE IF NOT EXISTS 로 자동 보장하지만,
-- 문서/수동 셋업용으로 함께 둔다.
CREATE TABLE IF NOT EXISTS build_log (
  id BIGSERIAL PRIMARY KEY,
  version TEXT NOT NULL,
  lens TEXT,
  changes JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_build_log_created ON build_log (id DESC);

-- 회차별 최종 layout 의 페이지별 블록 순서. 레이아웃 핑퐁 방지 이력으로 쓴다(2026-09-29 추가).
ALTER TABLE build_log ADD COLUMN IF NOT EXISTS layout_order JSONB;
