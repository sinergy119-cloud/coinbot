import { getSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase'

// GET /api/dashboard → 대시보드 요약 정보
export async function GET() {
  const session = await getSession()
  if (!session) return Response.json({ error: '로그인 필요' }, { status: 401 })

  const db = createServerClient()

  // 1) 활성 스케줄 수
  const { count: activeSchedules } = await db
    .from('trade_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', session.userId)
    .eq('status', 'active')

  // 2) 오늘 실행 로그
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const { data: todayLogs } = await db
    .from('trade_logs')
    .select('success')
    .eq('user_id', session.userId)
    .gte('executed_at', todayStart.toISOString())

  const todayTotal = todayLogs?.length ?? 0
  const todaySuccess = todayLogs?.filter((l) => l.success).length ?? 0
  const todayFail = todayTotal - todaySuccess

  // 3) 이번 달 거래 비용
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const { data: monthLogs } = await db
    .from('trade_logs')
    .select('balance_before, balance, success')
    .eq('user_id', session.userId)
    .eq('success', true)
    .gte('executed_at', monthStart.toISOString())

  let monthlyCost = 0
  let monthlyTrades = 0
  for (const log of monthLogs ?? []) {
    if (log.balance_before && log.balance && log.balance_before > 0) {
      const cost = Number(log.balance_before) - Number(log.balance)
      if (cost > 0) monthlyCost += cost
      monthlyTrades++
    }
  }

  return Response.json({
    activeSchedules: activeSchedules ?? 0,
    todayTotal,
    todaySuccess,
    todayFail,
    monthlyCost: Math.round(monthlyCost),
    monthlyTrades,
  })
}
