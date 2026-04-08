import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { createServerClient } from '@/lib/supabase'
import { createSession } from '@/lib/session'
import { sendTelegramMessage } from '@/lib/telegram'

export async function POST(req: NextRequest) {
  const { userId, password } = await req.json()

  if (!userId || !password) {
    return Response.json({ error: '사용자 ID와 비밀번호를 입력해주세요.' }, { status: 400 })
  }
  if (password.length < 6) {
    return Response.json({ error: '비밀번호는 6자 이상이어야 합니다.' }, { status: 400 })
  }

  const db = createServerClient()

  // 중복 ID 확인
  const { data: existing } = await db
    .from('users')
    .select('id')
    .eq('user_id', userId)
    .single()

  if (existing) {
    return Response.json({ error: '이미 존재하는 사용자 ID입니다.' }, { status: 409 })
  }

  // 비밀번호 해싱 + 저장
  const passwordHash = await bcrypt.hash(password, 10)
  const { data: newUser, error } = await db
    .from('users')
    .insert({ user_id: userId, password_hash: passwordHash })
    .select('id, user_id')
    .single()

  if (error || !newUser) {
    console.error('Signup error:', error)
    return Response.json({ error: `회원가입에 실패했습니다: ${error?.message ?? 'unknown'}` }, { status: 500 })
  }

  await createSession(newUser.id, newUser.user_id)

  // 관리자에게 신규 가입 텔레그램 알림
  try {
    const adminId = process.env.ADMIN_USER_ID
    if (adminId) {
      const { data: admin } = await db
        .from('users')
        .select('telegram_chat_id')
        .eq('user_id', adminId)
        .single()
      if (admin?.telegram_chat_id) {
        const { count } = await db.from('users').select('id', { count: 'exact', head: true })
        const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
        const msg = [
          `🎉 <b>MyCoinBot 신규 가입</b>`,
          ``,
          `ID: ${newUser.user_id}`,
          `가입: ${now} (KST)`,
          ``,
          `현재 총 회원: ${count ?? '?'}명`,
        ].join('\n')
        await sendTelegramMessage(admin.telegram_chat_id, msg)
      }
    }
  } catch { /* 알림 실패는 무시 */ }

  return Response.json({ ok: true, loginId: newUser.user_id })
}
