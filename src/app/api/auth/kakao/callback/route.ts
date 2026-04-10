import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createSession } from '@/lib/session'
import { sendTelegramMessage } from '@/lib/telegram'

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
    .select('id, user_id, status')
    .eq('user_id', kakaoUserId)
    .single()

  if (existingUser) {
    // 기존 사용자 → 로그인
    if (existingUser.status === 'suspended') {
      return Response.redirect(`${origin}/login?error=suspended`)
    }
    await db.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', existingUser.id)

    // 로그인 이력
    try {
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
      await db.from('login_history').insert({ user_id: existingUser.id, ip_address: ip, user_agent: req.headers.get('user-agent')?.slice(0, 200) ?? '' })
    } catch { /* 무시 */ }

    await createSession(existingUser.id, existingUser.user_id, true)
    return Response.redirect(`${origin}/`)
  }

  // 4) 신규 사용자 → 자동 가입 (이메일 인증 불필요)
  const { data: newUser, error } = await db
    .from('users')
    .insert({
      user_id: kakaoUserId,
      password_hash: 'kakao_oauth', // 카카오 로그인은 비밀번호 없음
      name: nickname,
      email,
      status: 'approved', // 카카오 인증으로 이메일 인증 대체
    })
    .select('id, user_id')
    .single()

  if (error || !newUser) {
    return Response.redirect(`${origin}/login?error=kakao_signup`)
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
          `🎉 <b>MyCoinBot 신규 가입 (카카오)</b>`,
          ``,
          `닉네임: ${nickname}`,
          email ? `이메일: ${email}` : '',
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
