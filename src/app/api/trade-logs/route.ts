import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase'

// GET /api/trade-logs?days=7 → 실행 로그 조회
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return Response.json({ error: '로그인 필요' }, { status: 401 })

  const days = Number(req.nextUrl.searchParams.get('days') ?? '7')
  const fromDate = new Date()
  fromDate.setDate(fromDate.getDate() - days)

  const db = createServerClient()
  const { data } = await db
    .from('trade_logs')
    .select('id, exchange, coin, trade_type, amount_krw, account_name, success, reason, balance_before, balance, source, executed_at')
    .eq('user_id', session.userId)
    .gte('executed_at', fromDate.toISOString())
    .order('executed_at', { ascending: false })
    .limit(100)

  return Response.json(data ?? [])
}
