// GET /api/app/events — 이벤트 목록 (앱 포맷)
// design-schema.md §4-5
// 기존 announcements 테이블을 앱 포맷으로 변환하여 반환

import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase'
import { ok, unauthorized } from '@/lib/app/response'

const VALID_EXCHANGES = ['BITHUMB', 'UPBIT', 'COINONE', 'KORBIT', 'GOPAX'] as const
const VALID_STATUSES = ['active', 'upcoming', 'ended', 'all'] as const

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

function toApi(r: AnnouncementRow) {
  return {
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
  }
}

function kstToday(): string {
  const kst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  const y = kst.getFullYear()
  const m = String(kst.getMonth() + 1).padStart(2, '0')
  const d = String(kst.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  const url = req.nextUrl
  const statusParam = url.searchParams.get('status') ?? 'active'
  const status = (VALID_STATUSES as readonly string[]).includes(statusParam) ? statusParam : 'active'
  const exchangeParam = url.searchParams.get('exchange') ?? 'all'
  const exchange = (VALID_EXCHANGES as readonly string[]).includes(exchangeParam) ? exchangeParam : 'all'
  const limitRaw = Number(url.searchParams.get('limit') ?? 20)
  const limit = Math.min(Math.max(limitRaw, 1), 100)

  const today = kstToday()
  const db = createServerClient()
  let query = db
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status === 'active') {
    query = query.gte('end_date', today)
  } else if (status === 'upcoming') {
    query = query.gt('start_date', today)
  } else if (status === 'ended') {
    query = query.lt('end_date', today)
  }
  if (exchange !== 'all') {
    query = query.eq('exchange', exchange)
  }

  const { data } = await query
  const items = (data ?? []).map((r) => toApi(r as AnnouncementRow))
  return ok({ items })
}
