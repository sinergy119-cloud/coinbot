import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { isAdmin } from '@/lib/admin'
import { createServerClient } from '@/lib/supabase'

// GET /api/announcements → 활성 이벤트 목록 (모든 사용자)
export async function GET() {
  const session = await getSession()
  if (!session) return Response.json({ error: '로그인 필요' }, { status: 401 })

  const db = createServerClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data } = await db
    .from('announcements')
    .select('*')
    .lte('start_date', today)
    .gte('end_date', today)
    .order('created_at', { ascending: false })

  return Response.json(data ?? [])
}

// POST /api/announcements → 이벤트 등록 (관리자만)
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session || !isAdmin(session.loginId)) {
    return Response.json({ error: '관리자만 접근 가능합니다.' }, { status: 403 })
  }

  const { exchange, coin, title, condition, startDate, endDate } = await req.json()

  if (!exchange || !coin || !title || !startDate || !endDate) {
    return Response.json({ error: '필수 항목을 모두 입력해주세요.' }, { status: 400 })
  }

  const db = createServerClient()
  const { data, error } = await db
    .from('announcements')
    .insert({
      exchange,
      coin: coin.toUpperCase(),
      title,
      condition: condition || null,
      start_date: startDate,
      end_date: endDate,
      created_by: session.userId,
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}
