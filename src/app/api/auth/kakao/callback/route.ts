import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createSession } from '@/lib/session'

// 프록시 뒤에서 origin이 localhost로 잡히므로 실제 origin 복원
function getOrigin(req: NextRequest) {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? req.nextUrl.host
  const protocol = req.headers.get('x-forwarded-proto') ?? 'http'
  return `${protocol}://${host}`
}

// GET /api/auth/kakao/callback?code=xxx → 카카오 로그인 콜백
// 주의: 현재 카카오 로그인은 비활성화 상태입니다 (비즈앱 전환 전).
// 재활성화 시 반드시 state 파라미터 + PKCE 구현 필요.
export async function GET(req: NextRequest) {
  const origin = getOrigin(req)

  // 카카오 로그인 비활성화 플래그 — 비즈앱 전환 전까지 콜백 차단
  if (process.env.KAKAO_LOGIN_ENABLED !== 'true') {
    return Response.redirect(`${origin}/login?error=kakao_disabled`)
  }

  const code = req.nextUrl.searchParams.get('code')
  if (!code) {
    return Response.redirect(`${origin}/login?error=kakao_failed`)
  }

  const clientId = process.env.KAKAO_REST_API_KEY
  const clientSecret = process.env.KAKAO_CLIENT_SECRET
  const redirectUri = `${origin}/api/auth/kakao/callback`

  // 1) 인가 코드로 토큰 발급
  const params: Record<string, string> = {
    grant_type: 'authorization_code',
    client_id: clientId!,
    redirect_uri: redirectUri,
    code,
  }
  if (clientSecret) params.client_secret = clientSecret

  const tokenRes = await fetch('https://kauth.kakao.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  })
  const tokenData = await tokenRes.json()
  if (!tokenData.access_token) {
    return Response.redirect(`${origin}/login?error=kakao_token`)
  }

  // 2) 사용자 정보 조회
  const userRes = await fetch('https://kapi.kakao.com/v2/user/me', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  })
  const userData = await userRes.json()

  const kakaoId = String(userData.id)
  const nickname = userData.kakao_account?.profile?.nickname ?? `카카오${kakaoId.slice(-4)}`
  const email = userData.kakao_account?.email ?? null

  const db = createServerClient()

  // 3) 기존 카카오 사용자 확인 (user_id = kakao_카카오ID)
  const kakaoUserId = `kakao_${kakaoId}`
  const { data: existingUser } = await db
    .from('users')
    .select('id, user_id, status, is_admin')
    .eq('user_id', kakaoUserId)
    .single()

  if (existingUser) {
    // 기존 사용자 → 로그인
    if (existingUser.status === 'suspended') {
      return Response.redirect(`${origin}/login?error=suspended`)
    }
    // 관리자가 아니면 웹 로그인 차단 (일반 사용자는 앱만 사용)
    if (!existingUser.is_admin) {
      return Response.redirect(`${origin}/login?error=not_admin`)
    }
    await db.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', existingUser.id)

    // 로그인 이력
    try {
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
      await db.from('login_history').insert({ user_id: existingUser.id, ip_address: ip, user_agent: req.headers.get('user-agent')?.slice(0, 200) ?? '' })
    } catch { /* 무시 */ }

    await createSession(existingUser.id, existingUser.user_id, true, existingUser.is_admin)
    return Response.redirect(`${origin}/?welcome=kakao`)
  }

  // 4) 이메일로 기존 계정 검색 (소셜 계정 자동 연동)
  if (email) {
    const { data: emailUser } = await db
      .from('users')
      .select('id, user_id, status, is_admin')
      .eq('email', email)
      .single()

    if (emailUser) {
      if (emailUser.status === 'suspended') {
        return Response.redirect(`${origin}/login?error=suspended`)
      }
      if (!emailUser.is_admin) {
        return Response.redirect(`${origin}/login?error=not_admin`)
      }
      await db.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', emailUser.id)
      try {
        const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
        await db.from('login_history').insert({ user_id: emailUser.id, ip_address: ip, user_agent: req.headers.get('user-agent')?.slice(0, 200) ?? '' })
      } catch { /* 무시 */ }
      await createSession(emailUser.id, emailUser.user_id, true, emailUser.is_admin)
      return Response.redirect(`${origin}/?welcome=kakao`)
    }
  }

  // 5) 신규 사용자 → 웹은 관리자 전용이므로 자동 가입 차단
  // (신규 사용자는 is_admin = false → 로그인 불가)
  return Response.redirect(`${origin}/login?error=not_admin`)
}
