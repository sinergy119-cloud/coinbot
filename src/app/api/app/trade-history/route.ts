// GET /api/app/trade-history — 본인 거래 이력 조회 (trade_logs 기반)
// 파라미터:
//   from        : KST 시작일 YYYY-MM-DD
//   to          : KST 종료일 YYYY-MM-DD
//   accountName : 계정명 (선택)
//   limit       : 최대 500 (기본 100)

import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase'
import { ok, unauthorized } from '@/lib/app/response'

// KST 날짜 문자열 → UTC ISO 변환
function kstDateToUtc(kstDate: string, endOfDay = false): string {
  const time = endOfDay ? 'T23:59:59' : 'T00:00:00'
  return new Date(`${kstDate}${time}+09:00`).toISOString()
}

// 30일 초과 방지
function clamp30Days(from: string, to: string): { from: string; to: string } {
  const f = new Date(from)
  const t = new Date(to)
  const diffMs = t.getTime() - f.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  if (diffDays > 30) {
    // to 기준으로 30일 이내로 자름
    const clampedFrom = new Date(t.getTime() - 30 * 24 * 60 * 60 * 1000)
    return { from: clampedFrom.toISOString(), to: t.toISOString() }
  }
  return { from: f.toISOString(), to: t.toISOString() }
}

interface TradeLogRow {
  id: string
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

  const sp = req.nextUrl.searchParams
  const fromKst   = sp.get('from')        // YYYY-MM-DD (KST)
  const toKst     = sp.get('to')          // YYYY-MM-DD (KST)
  const acctName  = sp.get('accountName') // 계정명
  const limitRaw  = Number(sp.get('limit') ?? 100)
  const limit     = Math.min(Math.max(limitRaw, 1), 500)

  const db = createServerClient()
  let query = db
    .from('trade_logs')
    .select('*')
    .eq('user_id', session.userId)
    .order('executed_at', { ascending: false })
    .limit(limit)

  // 날짜 필터 (KST → UTC)
  if (fromKst) {
    const { from, to } = fromKst && toKst
      ? clamp30Days(kstDateToUtc(fromKst, false), kstDateToUtc(toKst, true))
      : { from: kstDateToUtc(fromKst, false), to: new Date().toISOString() }
    query = query.gte('executed_at', from).lte('executed_at', to)
  } else if (toKst) {
    query = query.lte('executed_at', kstDateToUtc(toKst, true))
  }

  // 계정명 필터
  if (acctName) {
    query = query.eq('account_name', acctName)
  }

  const { data } = await query

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

  return ok({ items, total: items.length })
}
