import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { getSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase'
import { validatePassword } from '@/lib/password'

// PATCH /api/auth/password → 비밀번호 변경
export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return Response.json({ error: '로그인 필요' }, { status: 401 })

  const { currentPassword, newPassword } = await req.json()

  if (!currentPassword || !newPassword) {
    return Response.json({ error: '현재 비밀번호와 새 비밀번호를 입력해주세요.' }, { status: 400 })
  }
  const pwCheck = validatePassword(newPassword)
  if (!pwCheck.valid) {
    return Response.json({ error: pwCheck.error }, { status: 400 })
  }

  const db = createServerClient()
  const { data: user } = await db
    .from('users')
    .select('id, password_hash')
    .eq('id', session.userId)
    .single()

  if (!user) return Response.json({ error: '사용자 없음' }, { status: 404 })

  const valid = await bcrypt.compare(currentPassword, user.password_hash)
  if (!valid) return Response.json({ error: '현재 비밀번호가 올바르지 않습니다.' }, { status: 401 })

  const newHash = await bcrypt.hash(newPassword, 10)
  const { error } = await db
    .from('users')
    .update({ password_hash: newHash })
    .eq('id', session.userId)

  if (error) return Response.json({ error: '변경 실패: ' + error.message }, { status: 500 })

  return Response.json({ success: true })
}
