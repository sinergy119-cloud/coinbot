import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createSession } from '@/lib/session'
import { setPendingSignupOnResponse } from '@/lib/pendingSignup'

// 프록시 뒤에서 origin이 localhost로 잡히므로 실제 origin 복원
function getOrigin(req: NextRequest) {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? req.nextUrl.host
  const protocol = req.headers.get('x-forwarded-proto') ?? 'http'
  return `${protocol}://${host}`
}

// GET /api/auth/kakao/callback?code=xxx → 카카오 로그인 콜백
// - 관리자: /login 페이지에서 사용 (숨김 관리자 로그인)
// - 일반 사용자: /app/login 페이지에서 사용
export async function GET(req: NextRequest) {
  const origin = getOrigin(req)

  const code = req.nextUrl.searchParams.get('code')
  if (!code) {
    return Response.redirect(`${origin}/app/login?error=kakao_failed`)
  }

  const clientId = process.env.KAKAO_REST_API_KEY
  const clientSecret = process.env.KAKAO_CLIENT_SECRET
  const redirectUri = `${origin}/api/auth/kakao/callback`

  if (!clientId) {
    return Response.redirect(`${origin}/app/login?error=kakao_config`)
  }

  // 1) 인가 코드로 토큰 발급
  const params: Record<string, string> = {
    grant_type: 'authorization_code',
    client_id: clientId,
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
    return Response.redirect(`${origin}/app/login?error=kakao_token`)
  }

  // 2) 사용자 정보 조회
  const userRes = await fetch('https://kapi.kakao.com/v2/user/me', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  })
  const userData = await userRes.json()

  const kakaoId = String(userData.id)
  const nickname = userData.kakao_account?.profile?.nickname ?? `카카오${kakaoId.slice(-4)}`
  // 카카오는 암호화폐 서비스에 이메일 비즈 권한을 부여하지 않으므로 email은 항상 null
  const email: string | null = null

  const db = createServerClient()

  // 3) 기존 카카오 사용자 확인 (user_id = kakao_카카오ID)
  const kakaoUserId = `kakao_${kakaoId}`
  const { data: existingUser } = await db
    .from('users')
    .select('id, user_id, status, is_admin')
    .eq('user_id', kakaoUserId)
    .single()

  // state에 'app_' 접두사가 있으면 /app/login에서 시작한 로그인
  const state = req.nextUrl.searchParams.get('state') ?? ''
  const fromApp = state.startsWith('app_')

  if (existingUser) {
    if (existingUser.status === 'suspended') {
      const errDest = existingUser.is_admin && !fromApp ? '/login' : '/app/login'
      return Response.redirect(`${origin}${errDest}?error=suspended`)
    }
    const profileUpdate: Record<string, string> = { last_login_at: new Date().toISOString() }
    if (email) profileUpdate.email = email
    if (nickname) profileUpdate.name = nickname
    await db.from('users').update(profileUpdate).eq('id', existingUser.id)
    try {
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
      await db.from('login_history').insert({ user_id: existingUser.id, ip_address: ip, user_agent: req.headers.get('user-agent')?.slice(0, 200) ?? '' })
    } catch { /* 무시 */ }

    await createSession(existingUser.id, existingUser.user_id, true, existingUser.is_admin ?? false)
    const dest = (existingUser.is_admin && !fromApp) ? '/?welcome=kakao' : '/app?welcome=kakao'
    return Response.redirect(`${origin}${dest}`)
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
        const errDest = emailUser.is_admin && !fromApp ? '/login' : '/app/login'
        return Response.redirect(`${origin}${errDest}?error=suspended`)
      }
      await db.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', emailUser.id)
      try {
        const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
        await db.from('login_history').insert({ user_id: emailUser.id, ip_address: ip, user_agent: req.headers.get('user-agent')?.slice(0, 200) ?? '' })
      } catch { /* 무시 */ }
      await createSession(emailUser.id, emailUser.user_id, true, emailUser.is_admin ?? false)
      const dest = (emailUser.is_admin && !fromApp) ? '/?welcome=kakao' : '/app?welcome=kakao'
      return Response.redirect(`${origin}${dest}`)
    }
  }

  // 5) 신규 사용자 → 약관 동의 페이지로 이동
  try {
    const res = NextResponse.redirect(`${origin}/agree`)
    return await setPendingSignupOnResponse(res, { provider: 'kakao', userId: kakaoUserId, name: nickname, email })
  } catch (err) {
    console.error('[kakao callback] setPendingSignup error:', err)
    return Response.redirect(`${origin}/app/login?error=kakao_signup`)
  }
}
