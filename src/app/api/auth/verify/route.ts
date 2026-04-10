import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { sendTelegramMessage } from '@/lib/telegram'
import { escapeHtml } from '@/lib/html'

// GET /api/auth/verify?token=xxx → 이메일 인증 처리
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) {
    return new Response(renderHtml('❌ 인증 실패', '잘못된 인증 링크입니다.'), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  const db = createServerClient()

  // 토큰으로 사용자 조회
  const { data: user } = await db
    .from('users')
    .select('id, user_id, name, phone, email, status, verify_expires_at')
    .eq('verify_token', token)
    .single()

  if (!user) {
    return new Response(renderHtml('❌ 인증 실패', '유효하지 않은 인증 링크입니다.'), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  // 이미 인증된 사용자
  if (user.status === 'approved') {
    return new Response(renderHtml('✅ 이미 인증 완료', '이미 인증이 완료되었습니다. 로그인해주세요.'), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  // 토큰 만료 체크 (10분)
  if (user.verify_expires_at && new Date(user.verify_expires_at) < new Date()) {
    return new Response(renderHtml('⏰ 인증 만료', '인증 링크가 만료되었습니다. 다시 회원가입해주세요.'), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  // 인증 완료 처리
  await db
    .from('users')
    .update({ status: 'approved', verify_token: null, verify_expires_at: null })
    .eq('id', user.id)

  // 관리자에게 텔레그램 알림 (인증 완료 시)
  try {
    const adminId = process.env.ADMIN_USER_ID
    if (adminId) {
      const { data: admin } = await db
        .from('users')
        .select('telegram_chat_id')
        .eq('user_id', adminId)
        .single()
      if (admin?.telegram_chat_id) {
        const { count } = await db.from('users').select('id', { count: 'exact', head: true }).eq('status', 'approved')
        const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
        const msg = [
          `🎉 <b>MyCoinBot 신규 가입 완료</b>`,
          ``,
          `ID: ${user.user_id}`,
          `이름: ${user.name}`,
          `전화: ${user.phone}`,
          `이메일: ${user.email}`,
          `가입: ${now} (KST)`,
          ``,
          `현재 승인 회원: ${count ?? '?'}명`,
        ].join('\n')
        await sendTelegramMessage(admin.telegram_chat_id, msg)
      }
    }
  } catch { /* 알림 실패 무시 */ }

  const safeName = escapeHtml(user.name)
  return new Response(renderHtml('✅ 인증 완료!', `${safeName}님, 이메일 인증이 완료되었습니다.<br>이제 로그인할 수 있습니다.`), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

// 인증 결과 HTML 페이지
// NOTE: title은 고정 문자열만 전달, message는 호출부에서 escapeHtml로 감싼 것만 허용
function renderHtml(title: string, message: string) {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MyCoinBot - 이메일 인증</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f9fafb; }
    .card { background: white; padding: 48px 32px; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); text-align: center; max-width: 400px; }
    h1 { font-size: 20px; margin: 0 0 12px; color: #111827; }
    p { font-size: 14px; color: #6b7280; margin: 0 0 24px; line-height: 1.6; }
    a { display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-size: 14px; font-weight: 600; }
    a:hover { background: #1d4ed8; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="/login">로그인 하기</a>
  </div>
</body>
</html>`
}
