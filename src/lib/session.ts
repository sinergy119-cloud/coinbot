import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

// 빌드 시점이 아닌 런타임(요청 시점)에만 검증하도록 lazy 초기화
let _secret: Uint8Array | null = null
function getSecret(): Uint8Array {
  if (_secret) return _secret
  const raw = process.env.SESSION_SECRET
  if (!raw) throw new Error('SESSION_SECRET 환경변수가 설정되지 않았습니다.')
  _secret = new TextEncoder().encode(raw)
  return _secret
}

export interface SessionPayload {
  userId: string    // users.id (UUID)
  loginId: string   // users.user_id (로그인 ID)
  isAdmin: boolean  // users.is_admin (DB 기반)
}

// JWT 생성 → httpOnly 세션 쿠키 저장
// autoLogin=true → 30일 유지, false → 7일 유지
export async function createSession(userId: string, loginId: string, autoLogin = false, isAdmin = false) {
  const days = autoLogin ? 30 : 7
  const token = await new SignJWT({ userId, loginId, isAdmin } satisfies SessionPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${days}d`)
    .sign(getSecret())

  const cookieStore = await cookies()
  cookieStore.set('session', token, {
    httpOnly: true,
    secure: process.env.SECURE_COOKIE === 'true',
    sameSite: 'lax',
    path: '/',
    maxAge: days * 24 * 60 * 60,
  })
}

// 쿠키에서 세션 복호화
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, getSecret())
    return {
      userId: payload.userId as string,
      loginId: payload.loginId as string,
      isAdmin: (payload.isAdmin as boolean) ?? false,  // 구 토큰 호환
    }
  } catch {
    return null
  }
}

// 세션 삭제 (로그아웃)
export async function deleteSession() {
  const cookieStore = await cookies()
  cookieStore.delete('session')
}

// 관리자 확인 — JWT의 isAdmin 플래그에 의존하지 않고 DB를 매 요청 재조회
// 권한 박탈(users.is_admin=false) 즉시 반영되도록 보장
// 반환: 세션(관리자 확인됨) | null(비로그인·비관리자)
import { createServerClient } from '@/lib/supabase'
export async function requireAdmin(): Promise<SessionPayload | null> {
  const session = await getSession()
  if (!session) return null
  try {
    const db = createServerClient()
    const { data } = await db
      .from('users')
      .select('is_admin')
      .eq('id', session.userId)
      .single()
    if (!data?.is_admin) return null
    return { ...session, isAdmin: true }
  } catch {
    return null
  }
}
