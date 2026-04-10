-- announcements 테이블 재설계
-- 기존: title, condition
-- 신규: title 제거, amount, require_apply, api_allowed, link, notes 추가

ALTER TABLE announcements
  DROP COLUMN IF EXISTS title,
  DROP COLUMN IF EXISTS condition;

ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS amount text,
  ADD COLUMN IF NOT EXISTS require_apply boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS api_allowed boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS link text,
  ADD COLUMN IF NOT EXISTS notes text;
