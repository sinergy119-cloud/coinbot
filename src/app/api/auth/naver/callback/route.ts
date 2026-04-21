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

  if (error || !code || !state) {
    return Response.redirect(`${origin}/login?error=naver_failed`)
  }

  const clientId = process.env.NAVER_CLIENT_ID
  const clientSecret = process.env.NAVER_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return Response.redirect(`${origin}/login?error=naver_config`)
  }

  // 1) 인가 코드로 토큰 발급
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
  if (!tokenData.access_token) {
    return Response.redirect(`${origin}/login?error=naver_token`)
  }

  // 2) 사용자 정보 조회
  const userRes = await fetch('https://openapi.naver.com/v1/nid/me', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  })
  const userJson = await userRes.json()
  const userData = userJson.response

  if (!userData?.id) {
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
    .select('id, user_id, status, is_admin')
    .eq('user_id', naverUserId)
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
    const dest = existingUser.is_admin ? '/?welcome=naver' : '/app?welcome=naver'
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
      const dest = emailUser.is_admin ? '/?welcome=naver' : '/app?welcome=naver'
      return Response.redirect(`${origin}${dest}`)
    }
  }

  // 5) 신규 사용자 → 약관 동의 페이지로 이동
  // NextResponse.redirect() 를 사용해야 Set-Cookie 헤더가 리다이렉트 응답에 포함됨
  try {
    const res = NextResponse.redirect(`${origin}/agree`)
    return await setPendingSignupOnResponse(res, { provider: 'naver', userId: naverUserId, name: nickname, email })
  } catch (err) {
    console.error('[naver callback] setPendingSignup error:', err)
    return Response.redirect(`${origin}/login?error=naver_signup`)
  }
}
