import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createSession } from '@/lib/session'
import { sendTelegramMessage } from '@/lib/telegram'
import { escapeHtml } from '@/lib/html'

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
    .select('id, user_id, status')
    .eq('user_id', googleUserId)
    .single()

  if (existingUser) {
    if (existingUser.status === 'suspended') {
      return Response.redirect(`${origin}/login?error=suspended`)
    }
    await db.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', existingUser.id)
    try {
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
      await db.from('login_history').insert({ user_id: existingUser.id, ip_address: ip, user_agent: req.headers.get('user-agent')?.slice(0, 200) ?? '' })
    } catch { /* 무시 */ }

    await createSession(existingUser.id, existingUser.user_id, true)
    return Response.redirect(`${origin}/`)
  }

  // 4) 신규 사용자 자동 가입
  const { data: newUser, error: insertError } = await db
    .from('users')
    .insert({
      user_id: googleUserId,
      password_hash: 'google_oauth',
      name: nickname,
      email,
      status: 'approved',
    })
    .select('id, user_id')
    .single()

  if (insertError || !newUser) {
    return Response.redirect(`${origin}/login?error=google_signup`)
  }

  // 5) 관리자 텔레그램 알림
  try {
    const adminId = process.env.ADMIN_USER_ID
    if (adminId) {
      const { data: admin } = await db.from('users').select('telegram_chat_id').eq('user_id', adminId).single()
      if (admin?.telegram_chat_id) {
        const { count } = await db.from('users').select('id', { count: 'exact', head: true }).eq('status', 'approved')
        const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
        await sendTelegramMessage(admin.telegram_chat_id, [
          `🎉 <b>MyCoinBot 신규 가입 (구글)</b>`,
          ``,
          `이름: ${escapeHtml(nickname)}`,
          email ? `이메일: ${escapeHtml(email)}` : '',
          `가입: ${now} (KST)`,
          ``,
          `현재 승인 회원: ${count ?? '?'}명`,
        ].filter(Boolean).join('\n'))
      }
    }
  } catch { /* 무시 */ }

  await createSession(newUser.id, newUser.user_id, true)
  return Response.redirect(`${origin}/`)
}
