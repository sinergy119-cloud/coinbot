import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// GET /api/auth/verify-email?token=xxx → 이메일 변경 인증
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) {
    return new Response(renderHtml('❌ 인증 실패', '잘못된 인증 링크입니다.'), {
      status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  const db = createServerClient()
  const { data: user } = await db
    .from('users')
    .select('id, name, email, pending_email, email_verify_expires_at')
    .eq('email_verify_token', token)
    .single()

  if (!user) {
    return new Response(renderHtml('❌ 인증 실패', '유효하지 않은 인증 링크입니다.'), {
      status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  if (!user.pending_email) {
    return new Response(renderHtml('✅ 이미 완료', '이메일 변경이 이미 완료되었습니다.'), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  // 만료 체크
  if (user.email_verify_expires_at && new Date(user.email_verify_expires_at) < new Date()) {
    return new Response(renderHtml('⏰ 인증 만료', '인증 링크가 만료되었습니다. 다시 이메일 변경을 요청해주세요.'), {
      status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  // 이메일 변경 완료
  const oldEmail = user.email
  await db.from('users').update({
    email: user.pending_email,
    pending_email: null,
    email_verify_token: null,
    email_verify_expires_at: null,
  }).eq('id', user.id)

  return new Response(renderHtml(
    '✅ 이메일 변경 완료',
    `${user.name ?? '회원'}님의 이메일이 변경되었습니다.<br><b>${oldEmail}</b> → <b>${user.pending_email}</b>`
  ), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

function renderHtml(title: string, message: string) {
  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MyCoinBot</title>
<style>body{font-family:-apple-system,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f9fafb}
.card{background:white;padding:48px 32px;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.08);text-align:center;max-width:400px}
h1{font-size:20px;margin:0 0 12px}p{font-size:14px;color:#6b7280;margin:0 0 24px;line-height:1.6}
a{display:inline-block;background:#2563eb;color:white;text-decoration:none;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:600}</style>
</head><body><div class="card"><h1>${title}</h1><p>${message}</p><a href="/login">로그인 하기</a></div></body></html>`
}
