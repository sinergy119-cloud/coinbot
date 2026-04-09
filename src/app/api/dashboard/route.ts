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

  // 3) 거래소 계정 수
  const { count: accountCount } = await db
    .from('exchange_accounts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', session.userId)

  return Response.json({
    activeSchedules: activeSchedules ?? 0,
    todayTotal,
    todaySuccess,
    todayFail,
    accountCount: accountCount ?? 0,
  })
}
