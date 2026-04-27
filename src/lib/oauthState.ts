// OAuth state CSRF 보호 유틸
//
// 클라이언트가 OAuth 시작 전 cookie와 URL state에 동일 값을 기록 →
// 서버 콜백에서 cookie와 URL state가 일치하는지 비교 → 불일치 시 거부.
//
// 공격 시나리오: 공격자가 자신의 카카오 인가코드 URL을 피해자에게 클릭시켜
// 피해자 브라우저로 콜백이 호출되면 피해자가 공격자 계정에 묶이는 사고를 차단.

import type { NextRequest } from 'next/server'

const COOKIE_NAME = 'oauth_state'

/** 콜백에서 호출 — cookie와 URL state가 일치하는지 검증 */
export function validateOAuthState(req: NextRequest): { ok: true } | { ok: false; reason: string } {
  const urlState = req.nextUrl.searchParams.get('state') ?? ''
  const cookieState = req.cookies.get(COOKIE_NAME)?.value ?? ''
  if (!urlState) return { ok: false, reason: 'missing_url_state' }
  if (!cookieState) return { ok: false, reason: 'missing_cookie_state' }
  if (urlState !== cookieState) return { ok: false, reason: 'state_mismatch' }
  return { ok: true }
}

/** 클라이언트(브라우저)에서 OAuth 시작 직전 호출 — cookie + URL state에 동일 값 기록 */
export function setOAuthStateCookieOnClient(state: string): void {
  if (typeof document === 'undefined') return
  // SameSite=Lax: 외부 사이트의 redirect로 콜백이 호출돼도 cookie 전송
  // Secure: HTTPS에서만 전송
  // Max-Age=600: 10분 후 자동 만료
  document.cookie = `${COOKIE_NAME}=${state}; Path=/; Max-Age=600; SameSite=Lax; Secure`
}

/** 콜백 처리 후 cookie 제거 (NextResponse에 적용 가능) */
export function clearOAuthStateCookie(headers: Headers): void {
  // Max-Age=0 + 같은 Path → 즉시 삭제
  headers.append('Set-Cookie', `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax; Secure`)
}
