import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { createServerClient } from '@/lib/supabase'
import { createSession } from '@/lib/session'

export async function POST(req: NextRequest) {
  const { userId, password } = await req.json()

  if (!userId || !password) {
    return Response.json({ error: '사용자 ID와 비밀번호를 입력해주세요.' }, { status: 400 })
  }

  const db = createServerClient()
  const { data: user } = await db
    .from('users')
    .select('id, user_id, password_hash')
    .eq('user_id', userId)
    .single()

  // 보안: 사용자 존재 여부와 비밀번호 오류를 동일한 메시지로 처리 (user enumeration 방지)
  const valid = user ? await bcrypt.compare(password, user.password_hash) : false
  if (!user || !valid) {
    return Response.json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 })
  }

  await createSession(user.id, user.user_id)
  return Response.json({ ok: true, loginId: user.user_id })
}
