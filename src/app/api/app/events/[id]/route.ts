// GET /api/app/events/:id — 이벤트 상세
// design-schema.md §4-5

import { getSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase'
import { ok, unauthorized, notFound, fail } from '@/lib/app/response'

type AnnouncementRow = {
  id: string
  exchange: string
  coin: string
  amount: string | null
  require_apply: boolean
  api_allowed: boolean
  link: string | null
  notes: string | null
  start_date: string
  end_date: string
  reward_date: string | null
  created_at: string
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return unauthorized()

  const { id } = await params
  if (!id) return fail('id가 필요합니다.')

  const db = createServerClient()
  const { data } = await db
    .from('announcements')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!data) return notFound('이벤트')
  const r = data as AnnouncementRow
  return ok({
    id: r.id,
    exchange: r.exchange,
    coin: r.coin,
    amount: r.amount,
    requireApply: r.require_apply,
    apiAllowed: r.api_allowed,
    link: r.link,
    notes: r.notes,
    startDate: r.start_date,
    endDate: r.end_date,
    rewardDate: r.reward_date,
    createdAt: r.created_at,
  })
}
