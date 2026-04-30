// GET /api/admin/trade-stats?period=today|7d|30d|all
// 관리자 거래 통계 — 기간별 / 거래소별 / 소스별 집계 + 실패 사유 TOP 5

import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/session'
import { createServerClient } from '@/lib/supabase'

type Period = 'today' | '7d' | '30d' | 'all'

interface TradeLogRow {
  exchange: string
  source: string
  success: boolean
  reason: string | null
  amount_krw: number | null
  executed_at: string
}

function startOfPeriod(period: Period): Date | null {
  if (period === 'all') return null
  const nowKst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  if (period === 'today') {
    nowKst.setHours(0, 0, 0, 0)
    return nowKst
  }
  const days = period === '7d' ? 7 : 30
  nowKst.setDate(nowKst.getDate() - days)
  return nowKst
}

export async function GET(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) {
    return Response.json({ error: '관리자만 접근 가능합니다.' }, { status: 403 })
  }

  const url = new URL(req.url)
  const periodRaw = url.searchParams.get('period') ?? '7d'
  const period: Period = (['today', '7d', '30d', 'all'] as const).includes(periodRaw as Period)
    ? (periodRaw as Period)
    : '7d'

  const db = createServerClient()
  let query = db
    .from('trade_logs')
    .select('exchange, source, success, reason, amount_krw, executed_at')
    .order('executed_at', { ascending: false })
    .limit(20000)

  const since = startOfPeriod(period)
  if (since) query = query.gte('executed_at', since.toISOString())

  const { data, error } = await query
  if (error) {
    console.error('[admin/trade-stats] query error:', error.message)
    return Response.json({ error: '집계 실패' }, { status: 500 })
  }

  const rows = (data ?? []) as TradeLogRow[]
  const total = rows.length
  const success = rows.filter((r) => r.success).length
  const fail = total - success
  const successRate = total > 0 ? Math.round((success / total) * 1000) / 10 : 0
  const totalAmountKrw = rows
    .filter((r) => r.success && r.amount_krw)
    .reduce((sum, r) => sum + (r.amount_krw ?? 0), 0)

  // 거래소별
  const byExchange = new Map<string, { total: number; success: number }>()
  for (const r of rows) {
    const cur = byExchange.get(r.exchange) ?? { total: 0, success: 0 }
    cur.total += 1
    if (r.success) cur.success += 1
    byExchange.set(r.exchange, cur)
  }
  const exchangeStats = Array.from(byExchange.entries()).map(([exchange, v]) => ({
    exchange,
    total: v.total,
    success: v.success,
    fail: v.total - v.success,
    successRate: v.total > 0 ? Math.round((v.success / v.total) * 1000) / 10 : 0,
  }))

  // 소스별
  const bySource = new Map<string, { total: number; success: number }>()
  for (const r of rows) {
    const src = r.source || 'unknown'
    const cur = bySource.get(src) ?? { total: 0, success: 0 }
    cur.total += 1
    if (r.success) cur.success += 1
    bySource.set(src, cur)
  }
  const sourceStats = Array.from(bySource.entries()).map(([source, v]) => ({
    source,
    total: v.total,
    success: v.success,
    fail: v.total - v.success,
    successRate: v.total > 0 ? Math.round((v.success / v.total) * 1000) / 10 : 0,
  }))

  // 실패 사유 TOP 5
  const reasonCount = new Map<string, number>()
  for (const r of rows) {
    if (r.success) continue
    const reason = (r.reason ?? '사유 미기록').slice(0, 80)
    reasonCount.set(reason, (reasonCount.get(reason) ?? 0) + 1)
  }
  const topFailReasons = Array.from(reasonCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([reason, count]) => ({ reason, count }))

  return Response.json({
    period,
    summary: { total, success, fail, successRate, totalAmountKrw },
    exchangeStats,
    sourceStats,
    topFailReasons,
  })
}
