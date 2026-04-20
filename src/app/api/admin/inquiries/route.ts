import { getSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase'

// GET /api/admin/inquiries ???�체 문의 목록 (관리자)
export async function GET() {
  const session = await getSession()
  if (!session || !session.isAdmin) {
    return Response.json({ error: '관리자�??�근 가?�합?�다.' }, { status: 403 })
  }

  const db = createServerClient()

  // 문의 목록 + ?�원 ?�보 join
  const { data: inquiries } = await db
    .from('inquiries')
    .select('id, user_id, category, title, content, status, admin_reply, created_at, answered_at')
    .order('created_at', { ascending: false })
    .limit(200)

  // user_id ??user_id(login_id), name �??�성
  const userIds = Array.from(new Set((inquiries ?? []).map((i) => i.user_id)))
  let userMap: Record<string, { user_id: string; name: string | null }> = {}
  if (userIds.length > 0) {
    const { data: users } = await db
      .from('users')
      .select('id, user_id, name')
      .in('id', userIds)
    userMap = Object.fromEntries((users ?? []).map((u) => [u.id, { user_id: u.user_id, name: u.name }]))
  }

  const result = (inquiries ?? []).map((i) => ({
    ...i,
    user_login_id: userMap[i.user_id]?.user_id ?? null,
    user_name: userMap[i.user_id]?.name ?? null,
  }))

  // 미답변 건수
  const pendingCount = (inquiries ?? []).filter((i) => i.status === 'pending').length

  return Response.json({ inquiries: result, pendingCount })
}
