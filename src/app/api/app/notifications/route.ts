// GET /api/app/notifications — 알림함 조회
// design-schema.md §4-3

import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase'
import { ok, unauthorized } from '@/lib/app/response'

const VALID_CATEGORIES = ['event', 'trade_result', 'schedule', 'system', 'announcement'] as const

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  const url = req.nextUrl
  const category = url.searchParams.get('category') ?? 'all'
  const limitRaw = Number(url.searchParams.get('limit') ?? 30)
  const limit = Math.min(Math.max(limitRaw, 1), 100)
  const before = url.searchParams.get('before')

  const db = createServerClient()
  let query = db
    .from('notifications')
    .select('*')
    .eq('user_id', session.userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (category !== 'all' && (VALID_CATEGORIES as readonly string[]).includes(category)) {
    query = query.eq('category', category)
  }
  if (before) {
    query = query.lt('created_at', before)
  }

  const { data: items } = await query

  // 미읽음 수 (category와 무관하게 전체)
  const { count: unreadCount } = await db
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', session.userId)
    .is('read_at', null)

  const mapped = (items ?? []).map((n) => ({
    id: n.id,
    category: n.category,
    title: n.title,
    body: n.body,
    deepLink: n.deep_link,
    metadata: n.metadata,
    readAt: n.read_at,
    createdAt: n.created_at,
  }))

  return ok({ items: mapped, unreadCount: unreadCount ?? 0 })
}
