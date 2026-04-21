/**
 * POST /api/auth/complete-signup
 * - pending_signup 쿠키 검증 → users 테이블에 신규 사용자 생성 → 세션 발급
 * - 약관 동의 페이지(/agree)에서 호출
 */

import { getPendingSignup, deletePendingSignup } from '@/lib/pendingSignup'
import { createServerClient } from '@/lib/supabase'
import { createSession } from '@/lib/session'
import { sendTelegramMessage } from '@/lib/telegram'
import { escapeHtml } from '@/lib/html'

export async function POST() {
  const pending = await getPendingSignup()
  if (!pending) {
    return Response.json(
      { error: '가입 정보가 없거나 만료되었습니다. 다시 로그인해주세요.' },
      { status: 400 },
    )
  }

  const db = createServerClient()

  // race condition 방지: 혹시 이미 가입된 경우 → 로그인 처리
  const { data: existingUser } = await db
    .from('users')
    .select('id, user_id, status')
    .eq('user_id', pending.userId)
    .single()

  if (existingUser) {
    await deletePendingSignup()
    if (existingUser.status === 'suspended') {
      return Response.json({ error: '이용이 정지된 계정입니다.' }, { status: 403 })
    }
    await createSession(existingUser.id, existingUser.user_id, true)
    return Response.json({ ok: true, provider: pending.provider })
  }

  // 신규 사용자 생성
  const { data: newUser, error: insertError } = await db
    .from('users')
    .insert({
      user_id: pending.userId,
      password_hash: `${pending.provider}_oauth`,
      name: pending.name,
      email: pending.email,
      status: 'approved',
    })
    .select('id, user_id')
    .single()

  if (insertError || !newUser) {
    console.error('[complete-signup] insert error:', insertError)
    return Response.json({ error: '가입 처리 중 오류가 발생했습니다.' }, { status: 500 })
  }

  // 쿠키 삭제 + 세션 발급
  await deletePendingSignup()
  await createSession(newUser.id, newUser.user_id, true)

  // 관리자 텔레그램 알림
  try {
    const adminId = process.env.ADMIN_USER_ID
    if (adminId) {
      const { data: admin } = await db
        .from('users')
        .select('telegram_chat_id')
        .eq('user_id', adminId)
        .single()
      if (admin?.telegram_chat_id) {
        const { count } = await db
          .from('users')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'approved')
        const now = new Date().toLocaleString('ko-KR', {
          timeZone: 'Asia/Seoul',
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', hour12: false,
        })
        const providerLabel = pending.provider === 'kakao' ? '카카오' : pending.provider === 'naver' ? '네이버' : '구글'
        await sendTelegramMessage(admin.telegram_chat_id, [
          `🎉 <b>MyCoinBot 신규 가입 (${providerLabel})</b>`,
          ``,
          `닉네임: ${escapeHtml(pending.name)}`,
          pending.email ? `이메일: ${escapeHtml(pending.email)}` : '',
          `가입: ${now} (KST)`,
          ``,
          `현재 승인 회원: ${count ?? '?'}명`,
        ].filter(Boolean).join('\n'))
      }
    }
  } catch { /* 알림 실패는 가입에 영향 없음 */ }

  return Response.json({ ok: true, provider: pending.provider })
}
