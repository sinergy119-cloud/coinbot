/**
 * 소셜 로그인 신규 가입 임시 쿠키 관리
 * - OAuth 콜백에서 신규 사용자 감지 시 pending_signup 쿠키 저장 (10분 만료)
 * - /agree 페이지에서 읽어 약관 동의 후 /api/auth/complete-signup으로 계정 생성
 *
 * ⚠️ cookies().set() + Response.redirect() 조합은 쿠키가 누락됨.
 *    콜백에서는 반드시 makePendingSignupCookie()로 토큰을 받아
 *    NextResponse.redirect() 에 직접 Set-Cookie 헤더를 추가해야 함.
 */

import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export interface PendingSignup {
  provider: 'kakao' | 'naver' | 'google'
  userId: string    // e.g., naver_xxxx
  name: string
  email: string | null
}

export const PENDING_COOKIE_NAME = 'pending_signup'
const EXPIRE_MINUTES = 10

function getSecret(): Uint8Array {
  const raw = process.env.SESSION_SECRET
  if (!raw) throw new Error('SESSION_SECRET 환경변수가 설정되지 않았습니다.')
  return new TextEncoder().encode(raw)
}

/** JWT 토큰 생성 (쿠키 설정은 하지 않음) */
export async function makePendingSignupToken(data: PendingSignup): Promise<string> {
  return new SignJWT({ ...data } as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${EXPIRE_MINUTES}m`)
    .sign(getSecret())
}

/**
 * NextResponse 에 pending_signup 쿠키를 설정한 뒤 반환.
 * OAuth 콜백처럼 redirect 응답과 함께 쿠키를 설정해야 할 때 사용.
 */
export async function setPendingSignupOnResponse(
  response: NextResponse,
  data: PendingSignup,
): Promise<NextResponse> {
  const token = await makePendingSignupToken(data)
  response.cookies.set(PENDING_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.SECURE_COOKIE === 'true',
    sameSite: 'lax',
    path: '/',
    maxAge: EXPIRE_MINUTES * 60,
  })
  return response
}

/** complete-signup 등 일반 Route Handler에서 쿠키를 읽을 때 사용 */
export async function getPendingSignup(): Promise<PendingSignup | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(PENDING_COOKIE_NAME)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return {
      provider: payload.provider as 'kakao' | 'naver' | 'google',
      userId: payload.userId as string,
      name: payload.name as string,
      email: (payload.email as string | null) ?? null,
    }
  } catch {
    return null
  }
}

/** 탈퇴/완료 후 pending_signup 쿠키 삭제 */
export async function deletePendingSignup(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(PENDING_COOKIE_NAME)
}
