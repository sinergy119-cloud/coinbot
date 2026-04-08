import { createClient, SupabaseClient } from '@supabase/supabase-js'

// 빌드 시점이 아닌 런타임에만 환경변수를 읽도록 lazy 초기화
function getConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 환경변수가 설정되지 않았습니다.')
  }
  const schema = process.env.NEXT_PUBLIC_DB_SCHEMA || 'public'
  return { supabaseUrl, supabaseAnonKey, schema }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any, any, any>

// 브라우저(클라이언트 컴포넌트) Supabase 클라이언트 — lazy singleton
let _supabase: AnySupabaseClient | null = null
export function getSupabase(): AnySupabaseClient {
  if (_supabase) return _supabase
  const { supabaseUrl, supabaseAnonKey, schema } = getConfig()
  _supabase = createClient(supabaseUrl, supabaseAnonKey, {
    db: { schema },
    auth: {
      persistSession: true,
      storageKey: 'coinbot-session',
      storage: typeof window !== 'undefined' ? sessionStorage : undefined,
    },
  })
  return _supabase
}

// 기존 코드 호환을 위한 getter (import { supabase } 대신 사용)
// NOTE: 직접 참조하면 모듈 평가 시점에 실행되므로, Proxy로 감싸서 실제 사용 시점에 초기화
export const supabase: AnySupabaseClient = new Proxy({} as AnySupabaseClient, {
  get(_target, prop) {
    return (getSupabase() as unknown as Record<string | symbol, unknown>)[prop]
  },
})

// 서버(API Routes)용 Supabase 클라이언트
export function createServerClient() {
  const { supabaseUrl, schema } = getConfig()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다.')
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    db: { schema },
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
