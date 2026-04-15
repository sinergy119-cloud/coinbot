import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createSession } from '@/lib/session'
import { setPendingSignupOnResponse } from '@/lib/pendingSignup'

function getOrigin(req: NextRequest) {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? req.nextUrl.host
  const protocol = req.headers.get('x-forwarded-proto') ?? 'http'
  return `${protocol}://${host}`
}

// GET /api/auth/naver/callback?code=xxx&state=xxx
export async function GET(req: NextRequest) {
  const origin = getOrigin(req)
  const { searchParams } = req.nextUrl

  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  console.log('[naver callback] 진입 origin:', origin, '| code:', code ? '있음' : '없음', '| state:', state ? '있음' : '없음', '| error:', error)

  if (error || !code || !state) {
    console.log('[naver callback] 파라미터 오류 → /login?error=naver_failed')
    return Response.redirect(`${origin}/login?error=naver_failed`)
  }

  const clientId = process.env.NAVER_CLIENT_ID
  const clientSecret = process.env.NAVER_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    console.log('[naver callback] 환경변수 없음 → /login?error=naver_config')
    return Response.redirect(`${origin}/login?error=naver_config`)
  }

  // 1) 인가 코드로 토큰 발급
  console.log('[naver callback] 토큰 요청 중...')
  const tokenRes = await fetch('https://nid.naver.com/oauth2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      state,
    }),
  })
  const tokenData = await tokenRes.json()
  console.log('[naver callback] 토큰 응답:', JSON.stringify({ access_token: tokenData.access_token ? '있음' : '없음', error: tokenData.error, error_description: tokenData.error_description }))
  if (!tokenData.access_token) {
    console.log('[naver callback] 토큰 없음 → /login?error=naver_token')
    return Response.redirect(`${origin}/login?error=naver_token`)
  }

  // 2) 사용자 정보 조회
  console.log('[naver callback] 사용자 정보 요청 중...')
  const userRes = await fetch('https://openapi.naver.com/v1/nid/me', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  })
  const userJson = await userRes.json()
  const userData = userJson.response
  console.log('[naver callback] 사용자 정보:', JSON.stringify({ id: userData?.id ? '있음' : '없음', email: userData?.email ? '있음' : '없음', nickname: userData?.nickname }))

  if (!userData?.id) {
    console.log('[naver callback] 사용자 ID 없음 → /login?error=naver_user')
    return Response.redirect(`${origin}/login?error=naver_user`)
  }

  const naverId = String(userData.id)
  const nickname = userData.nickname ?? userData.name ?? `네이버${naverId.slice(-4)}`
  const email = userData.email ?? null
  const naverUserId = `naver_${naverId}`

  const db = createServerClient()

  // 3) 기존 사용자 확인
  const { data: existingUser } = await db
    .from('users')
    .select('id, user_id, status')
    .eq('user_id', naverUserId)
    .single()

  console.log('[naver callback] 기존 사용자(userId):', existingUser ? `status=${existingUser.status}` : '없음')

  if (existingUser) {
    if (existingUser.status === 'suspended') {
      console.log('[naver callback] suspended → /login?error=suspended')
      return Response.redirect(`${origin}/login?error=suspended`)
    }
    await db.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', existingUser.id)
    try {
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
      await db.from('login_history').insert({ user_id: existingUser.id, ip_address: ip, user_agent: req.headers.get('user-agent')?.slice(0, 200) ?? '' })
    } catch { /* 무시 */ }

    await createSession(existingUser.id, existingUser.user_id, true)
    console.log('[naver callback] 기존 사용자 로그인 → /?welcome=naver')
    return Response.redirect(`${origin}/?welcome=naver`)
  }

  // 4) 이메일로 기존 계정 검색 (소셜 계정 자동 연동)
  if (email) {
    const { data: emailUser } = await db
      .from('users')
      .select('id, user_id, status')
      .eq('email', email)
      .single()

    console.log('[naver callback] 이메일로 기존 사용자:', emailUser ? `status=${emailUser.status}` : '없음')

    if (emailUser) {
      if (emailUser.status === 'suspended') {
        console.log('[naver callback] email user suspended → /login?error=suspended')
        return Response.redirect(`${origin}/login?error=suspended`)
      }
      await db.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', emailUser.id)
      try {
        const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
        await db.from('login_history').insert({ user_id: emailUser.id, ip_address: ip, user_agent: req.headers.get('user-agent')?.slice(0, 200) ?? '' })
      } catch { /* 무시 */ }
      await createSession(emailUser.id, emailUser.user_id, true)
      console.log('[naver callback] 이메일 연동 로그인 → /?welcome=naver')
      return Response.redirect(`${origin}/?welcome=naver`)
    }
  }

  // 5) 신규 사용자 → 약관 동의 페이지로 이동
  console.log('[naver callback] 신규 사용자 → /agree 쿠키 설정 시도')
  try {
    const res = NextResponse.redirect(`${origin}/agree`)
    const result = await setPendingSignupOnResponse(res, { provider: 'naver', userId: naverUserId, name: nickname, email })
    const cookieVal = result.cookies.get('pending_signup')
    console.log('[naver callback] pending_signup 쿠키:', cookieVal ? '설정됨' : '설정 안됨')
    return result
  } catch (err) {
    console.error('[naver callback] setPendingSignup error:', err)
    return Response.redirect(`${origin}/login?error=naver_signup`)
  }
}
