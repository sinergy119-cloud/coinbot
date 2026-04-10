import { createClient } from '@supabase/supabase-js'

// 서버(API Routes) 전용 Supabase 클라이언트
// anon key는 사용하지 않음 — 모든 DB 접근은 서버 API 경유 (서비스 역할 키)
export function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL 환경변수가 설정되지 않았습니다.')
  }
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다.')
  }
  const schema = process.env.NEXT_PUBLIC_DB_SCHEMA || 'public'
  return createClient(supabaseUrl, serviceRoleKey, {
    db: { schema },
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
