import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const schema = process.env.NEXT_PUBLIC_DB_SCHEMA || 'public'

// 브라우저(클라이언트 컴포넌트) Supabase 클라이언트
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: {
    schema: schema,
  },
  auth: {
    persistSession: true,
    storageKey: 'coinbot-session',
    storage: typeof window !== 'undefined' ? sessionStorage : undefined,
  },
})

// 서버(API Routes)용 Supabase 클라이언트
export function createServerClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다.')
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    db: {
      schema: schema,
    },
    auth: { autoRefreshToken: false, persistSession: false },
  })
}