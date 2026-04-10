-- 문의 테이블 생성
CREATE TABLE IF NOT EXISTS inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('bug', 'feature', 'general')),
  title text NOT NULL,
  content text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'answered')),
  admin_reply text,
  created_at timestamptz NOT NULL DEFAULT now(),
  answered_at timestamptz
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_inquiries_user_id ON inquiries(user_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status);
CREATE INDEX IF NOT EXISTS idx_inquiries_created_at ON inquiries(created_at DESC);

-- RLS 활성화 (서비스 역할 키로만 접근)
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;
