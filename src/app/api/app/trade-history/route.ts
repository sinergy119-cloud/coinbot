// GET /api/app/trade-history — 본인 거래 이력 조회 (trade_logs 기반)

import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase'
import { ok, unauthorized } from '@/lib/app/response'

interface TradeLogRow {
  id: string
  user_id: string
  exchange: string
  coin: string
  trade_type: string
  amount_krw: number
  account_name: string | null
  success: boolean
  reason: string | null
  balance_before: number | null
  balance: number | null
  source: string | null
  executed_at: string
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  const limitRaw = Number(req.nextUrl.searchParams.get('limit') ?? 20)
  const limit = Math.min(Math.max(limitRaw, 1), 100)

  const db = createServerClient()
  const { data } = await db
    .from('trade_logs')
    .select('*')
    .eq('user_id', session.userId)
    .order('executed_at', { ascending: false })
    .limit(limit)

  const items = ((data as TradeLogRow[]) ?? []).map((r) => ({
    id: r.id,
    exchange: r.exchange,
    coin: r.coin,
    tradeType: r.trade_type,
    amountKrw: r.amount_krw,
    accountName: r.account_name,
    success: r.success,
    reason: r.reason,
    balanceBefore: r.balance_before,
    balance: r.balance,
    source: r.source,
    executedAt: r.executed_at,
  }))

  return ok({ items })
}
