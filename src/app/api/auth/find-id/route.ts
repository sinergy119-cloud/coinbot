import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// POST /api/auth/find-id → 이름 + 이메일로 아이디 조회
export async function POST(req: NextRequest) {
  const { name, email } = await req.json()

  if (!name?.trim() || !email?.trim()) {
    return Response.json({ error: '이름과 이메일을 입력해주세요.' }, { status: 400 })
  }

  const db = createServerClient()
  const { data: user } = await db
    .from('users')
    .select('user_id')
    .eq('name', name.trim())
    .eq('email', email.trim().toLowerCase())
    .single()

  if (!user) {
    return Response.json({ error: '일치하는 회원 정보가 없습니다.' }, { status: 404 })
  }

  // 아이디 일부 마스킹 (예: sinergy1 → sin***y1)
  const id = user.user_id
  const masked = id.length <= 3
    ? id[0] + '**'
    : id.slice(0, 3) + '*'.repeat(Math.max(id.length - 5, 1)) + id.slice(-2)

  return Response.json({ userId: masked })
}
