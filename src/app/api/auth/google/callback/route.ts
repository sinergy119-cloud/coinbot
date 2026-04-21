import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createSession } from '@/lib/session'
import { setPendingSignupOnResponse } from '@/lib/pendingSignup'

function getOrigin(req: NextRequest) {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? req.nextUrl.host
  const protocol = req.headers.get('x-forwarded-proto') ?? 'http'
  return `${protocol}://${host}`
}

// GET /api/auth/google/callback?code=xxx&state=xxx
export async function GET(req: NextRequest) {
  const origin = getOrigin(req)
  const { searchParams } = req.nextUrl

  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return Response.redirect(`${origin}/login?error=google_failed`)
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return Response.redirect(`${origin}/login?error=google_config`)
  }

  const redirectUri = `${origin}/api/auth/google/callback`

  // 1) 인가 코드로 토큰 발급
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    }),
  })
  const tokenData = await tokenRes.json()
  if (!tokenData.access_token) {
    return Response.redirect(`${origin}/login?error=google_token`)
  }

  // 2) 사용자 정보 조회
  const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  })
  const userData = await userRes.json()

  if (!userData?.id) {
    return Response.redirect(`${origin}/login?error=google_user`)
  }

  const googleId = String(userData.id)
  const nickname = userData.name ?? `구글${googleId.slice(-4)}`
  const email = userData.email ?? null
  const googleUserId = `google_${googleId}`

  const db = createServerClient()

  // 3) 기존 사용자 확인
  const { data: existingUser } = await db
    .from('users')
    .select('id, user_id, status, is_admin')
    .eq('user_id', googleUserId)
    .single()

  if (existingUser) {
    if (existingUser.status === 'suspended') {
      const errDest = existingUser.is_admin ? '/login' : '/app/login'
      return Response.redirect(`${origin}${errDest}?error=suspended`)
    }
    await db.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', existingUser.id)
    try {
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
      await db.from('login_history').insert({ user_id: existingUser.id, ip_address: ip, user_agent: req.headers.get('user-agent')?.slice(0, 200) ?? '' })
    } catch { /* 무시 */ }

    await createSession(existingUser.id, existingUser.user_id, true, existingUser.is_admin ?? false)
    const dest = existingUser.is_admin ? '/?welcome=google' : '/app?welcome=google'
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
        const errDest = emailUser.is_admin ? '/login' : '/app/login'
        return Response.redirect(`${origin}${errDest}?error=suspended`)
      }
      await db.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', emailUser.id)
      try {
        const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
        await db.from('login_history').insert({ user_id: emailUser.id, ip_address: ip, user_agent: req.headers.get('user-agent')?.slice(0, 200) ?? '' })
      } catch { /* 무시 */ }
      await createSession(emailUser.id, emailUser.user_id, true, emailUser.is_admin ?? false)
      const dest = emailUser.is_admin ? '/?welcome=google' : '/app?welcome=google'
      return Response.redirect(`${origin}${dest}`)
    }
  }

  // 5) 신규 사용자 → 약관 동의 페이지로 이동
  // NextResponse.redirect() 를 사용해야 Set-Cookie 헤더가 리다이렉트 응답에 포함됨
  try {
    const res = NextResponse.redirect(`${origin}/agree`)
    return await setPendingSignupOnResponse(res, { provider: 'google', userId: googleUserId, name: nickname, email })
  } catch (err) {
    console.error('[google callback] setPendingSignup error:', err)
    return Response.redirect(`${origin}/login?error=google_signup`)
  }
}
