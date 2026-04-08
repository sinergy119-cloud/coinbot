import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const rawSecret = process.env.SESSION_SECRET
if (!rawSecret) throw new Error('SESSION_SECRET 환경변수가 설정되지 않았습니다.')
const secret = new TextEncoder().encode(rawSecret)

export interface SessionPayload {
  userId: string   // users.id (UUID)
  loginId: string  // users.user_id (로그인 ID)
}

// JWT 생성 → httpOnly 세션 쿠키 저장
export async function createSession(userId: string, loginId: string) {
  const token = await new SignJWT({ userId, loginId } satisfies SessionPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret)

  const cookieStore = await cookies()
  cookieStore.set('session', token, {
    httpOnly: true,
    secure: process.env.SECURE_COOKIE === 'true',
    sameSite: 'lax',
    path: '/',
    // maxAge / expires 없음 → 브라우저 종료 시 삭제 (planning.md 세션 정책)
  })
}

// 쿠키에서 세션 복호화
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, secret)
    return { userId: payload.userId as string, loginId: payload.loginId as string }
  } catch {
    return null
  }
}

// 세션 삭제 (로그아웃)
export async function deleteSession() {
  const cookieStore = await cookies()
  cookieStore.delete('session')
}
