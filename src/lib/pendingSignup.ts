/**
 * 소셜 로그인 신규 가입 임시 쿠키 관리
 * - OAuth 콜백에서 신규 사용자 감지 시 pending_signup 쿠키 저장 (10분 만료)
 * - /agree 페이지에서 읽어 약관 동의 후 /api/auth/complete-signup으로 계정 생성
 */

import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

export interface PendingSignup {
  provider: 'naver' | 'google'
  userId: string    // e.g., naver_xxxx
  name: string
  email: string | null
}

const COOKIE_NAME = 'pending_signup'
const EXPIRE_MINUTES = 10

function getSecret(): Uint8Array {
  const raw = process.env.SESSION_SECRET
  if (!raw) throw new Error('SESSION_SECRET 환경변수가 설정되지 않았습니다.')
  return new TextEncoder().encode(raw)
}

export async function createPendingSignup(data: PendingSignup): Promise<void> {
  const token = await new SignJWT({ ...data } as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${EXPIRE_MINUTES}m`)
    .sign(getSecret())

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.SECURE_COOKIE === 'true',
    sameSite: 'lax',
    path: '/',
    maxAge: EXPIRE_MINUTES * 60,
  })
}

export async function getPendingSignup(): Promise<PendingSignup | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return {
      provider: payload.provider as 'naver' | 'google',
      userId: payload.userId as string,
      name: payload.name as string,
      email: (payload.email as string | null) ?? null,
    }
  } catch {
    return null
  }
}

export async function deletePendingSignup(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}
