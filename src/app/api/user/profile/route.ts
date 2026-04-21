import { NextRequest } from 'next/server'
import { randomBytes } from 'crypto'
import { getSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase'
import { sendTelegramMessage } from '@/lib/telegram'
import { sendVerificationEmail } from '@/lib/email'

// GET /api/user/profile
export async function GET() {
  const session = await getSession()
  if (!session) return Response.json({ error: '로그인 필요' }, { status: 401 })

  const db = createServerClient()
  const { data } = await db
    .from('users')
    .select('user_id, name, phone, email, pending_email, telegram_chat_id, delegated, delegate_pending')
    .eq('id', session.userId)
    .single()

  return Response.json({
    user_id: data?.user_id ?? '',
    name: data?.name ?? '',
    phone: data?.phone ?? '',
    email: data?.email ?? '',
    pendingEmail: data?.pending_email ?? '',
    telegramChatId: data?.telegram_chat_id ?? '',
    delegated: data?.delegated ?? false,
    delegatePending: data?.delegate_pending ?? false,
  })
}

// PATCH /api/user/profile
export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return Response.json({ error: '로그인 필요' }, { status: 401 })

  const body = await req.json()
  const db = createServerClient()
  const updates: Record<string, unknown> = {}

  // 이름/전화번호: 바로 저장
  if ('name' in body) updates.name = body.name?.trim() || null
  if ('phone' in body) updates.phone = body.phone?.replace(/[^0-9]/g, '') || null
  // delegate_pending: 사용자가 위임 신청/취소 시 변경 가능 (delegated는 관리자 전용)
  if ('delegate_pending' in body) updates.delegate_pending = !!body.delegate_pending
  // 주의: delegated는 관리자 전용 필드이므로 일반 사용자가 직접 수정 불가

  // 이메일 변경: 인증 필요
  if ('email' in body) {
    const newEmail = body.email?.trim().toLowerCase()
    if (newEmail) {
      // 현재 이메일 조회
      const { data: currentUser } = await db
        .from('users')
        .select('email, name')
        .eq('id', session.userId)
        .single()

      // 같은 이메일이면 무시
      if (currentUser?.email === newEmail) {
        // 변경 없음
      } else {
        // 중복 확인
        const { data: dup } = await db
          .from('users')
          .select('id')
          .eq('email', newEmail)
          .neq('id', session.userId)
          .single()
        if (dup) {
          return Response.json({ error: '이미 등록된 이메일입니다.' }, { status: 409 })
        }

        // 인증 토큰 생성 (10분 유효)
        const token = randomBytes(32).toString('hex')
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

        updates.pending_email = newEmail
        updates.email_verify_token = token
        updates.email_verify_expires_at = expiresAt

        // 새 이메일로 인증 메일 발송
        try {
          const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost:3000'
          const proto = req.headers.get('x-forwarded-proto') ?? (host.includes('localhost') ? 'http' : 'https')
          const verifyUrl = `${proto}://${host}/api/auth/verify-email?token=${token}`
          await sendVerificationEmail(newEmail, currentUser?.name ?? session.loginId, verifyUrl)
        } catch {
          return Response.json({ error: '인증 메일 발송에 실패했습니다.' }, { status: 500 })
        }

        // 기존 이메일로 알림
        if (currentUser?.email) {
          try {
            const { escapeHtml } = await import('@/lib/html')
            const nodemailer = await import('nodemailer')
            const transporter = nodemailer.default.createTransport({
              service: 'gmail',
              auth: { user: process.env.GMAIL_USER!, pass: process.env.GMAIL_APP_PASSWORD! },
            })
            await transporter.sendMail({
              from: `MyCoinBot <${process.env.GMAIL_USER}>`,
              to: currentUser.email,
              subject: '[MyCoinBot] 이메일 변경 요청 알림',
              html: `<p>회원님의 계정에서 이메일 변경이 요청되었습니다.</p><p>새 이메일: <b>${escapeHtml(newEmail)}</b></p><p>본인이 아닌 경우 관리자에게 문의해주세요.</p>`,
            })
          } catch { /* 알림 실패 무시 */ }
        }
      }
    }
  }

  // 텔레그램 Chat ID
  if ('telegramChatId' in body) {
    const chatId = body.telegramChatId?.trim() || null
    if (chatId) {
      try {
        await sendTelegramMessage(chatId, '🔔 <b>MyCoinBot 텔레그램 연결 테스트</b>\n\n연결이 정상적으로 완료되었습니다.')
      } catch {
        return Response.json({ error: '유효하지 않은 Chat ID입니다.' }, { status: 400 })
      }
    }
    updates.telegram_chat_id = chatId
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await db.from('users').update(updates).eq('id', session.userId)
    if (error) {
      console.error('[user/profile] update error:', error)
      return Response.json({ error: '프로필 수정에 실패했습니다.' }, { status: 500 })
    }
  }

  // 이메일 변경 요청이 있었으면 안내 메시지 반환
  if (updates.pending_email) {
    return Response.json({ success: true, emailVerification: true, message: '새 이메일로 인증 메일을 보냈습니다. 인증 완료 후 변경됩니다.' })
  }

  return Response.json({ success: true })
}
