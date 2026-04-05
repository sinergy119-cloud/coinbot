import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { placeMarketOrder } from '@/lib/exchange'
import type { Exchange, TradeType, TradeJobRow } from '@/types/database'

// POST /api/cron → 외부 cron 서비스가 호출
export async function POST(req: NextRequest) {
  // 보안: CRON_SECRET 검증
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServerClient()
  const now = new Date()
  const today = now.toISOString().slice(0, 10)          // YYYY-MM-DD
  const currentTime = now.toTimeString().slice(0, 5)     // HH:MM

  // 1) 실행 대상 조회: 오늘 날짜 범위 내 + 현재 시간 일치
  const { data: jobs } = await db
    .from('trade_jobs')
    .select('*')
    .lte('schedule_from', today)
    .gte('schedule_to', today)
    .eq('schedule_time', currentTime)

  if (!jobs || jobs.length === 0) {
    return Response.json({ message: '실행 대상 없음', executed: 0 })
  }

  // 2) 중복 실행 방지: last_executed_at이 오늘이 아닌 것만 필터
  const pendingJobs = jobs.filter((job: TradeJobRow) => {
    if (!job.last_executed_at) return true
    return job.last_executed_at.slice(0, 10) !== today
  })

  if (pendingJobs.length === 0) {
    return Response.json({ message: '이미 실행 완료', executed: 0 })
  }

  // 3) 각 job 실행
  const results = []
  for (const job of pendingJobs) {
    // 해당 job의 계정들 조회
    const { data: accounts } = await db
      .from('exchange_accounts')
      .select('*')
      .in('id', job.account_ids)

    if (!accounts || accounts.length === 0) {
      results.push({ jobId: job.id, status: 'SKIP', reason: '계정 없음' })
      continue
    }

    const side = (job.trade_type as TradeType) === 'BUY' ? 'buy' : 'sell'

    // 모든 계정 동시 실행
    const orderResults = await Promise.all(
      accounts.map(async (acc) => {
        // 1차 시도
        let result = await placeMarketOrder(
          job.exchange as Exchange,
          acc.access_key,
          acc.secret_key,
          job.coin,
          side,
          job.amount_krw,
        )
        // 실패 시 1회 재시도 (planning.md 8.6)
        if (!result.success) {
          result = await placeMarketOrder(
            job.exchange as Exchange,
            acc.access_key,
            acc.secret_key,
            job.coin,
            side,
            job.amount_krw,
          )
        }
        return { accountId: acc.id, accountName: acc.account_name, ...result }
      }),
    )

    // last_executed_at 갱신
    await db
      .from('trade_jobs')
      .update({ last_executed_at: now.toISOString() })
      .eq('id', job.id)

    results.push({ jobId: job.id, status: 'DONE', orderResults })
  }

  return Response.json({ message: '실행 완료', executed: results.length, results })
}
