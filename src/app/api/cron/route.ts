import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// GET /api/cron → cron 실행 중 여부 확인 (Supabase heartbeat 기반)
export async function GET() {
  const db = createServerClient()
  const { data } = await db
    .from('system_settings')
    .select('value')
    .eq('key', 'cron_last_ping')
    .single()

  if (!data?.value) return Response.json({ running: false, lastPing: null })
  const lastPing = new Date(data.value).getTime()
  const running = Date.now() - lastPing < 2 * 60 * 1000
  return Response.json({ running, lastPing: data.value })
}
import {
  placeMarketOrder,
  placeCycleOrder,
  placeMarketOrderByCoinQty,
  getCoinBalance,
} from '@/lib/exchange'
import { sendTelegramMessage } from '@/lib/telegram'
import type { Exchange, TradeType, TradeJobRow } from '@/types/database'

// KST 기준 날짜/시간 반환
function getKSTDateTime() {
  const now = new Date()
  const kst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  const today = `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, '0')}-${String(kst.getDate()).padStart(2, '0')}`
  const currentTime = `${String(kst.getHours()).padStart(2, '0')}:${String(kst.getMinutes()).padStart(2, '0')}`
  return { now, today, currentTime }
}

// 텔레그램 메시지 포맷
function buildTelegramMessage(
  job: TradeJobRow,
  results: Array<{ accountName: string; success: boolean; reason?: string }>,
): string {
  const tradeTypeLabel: Record<TradeType, string> = { BUY: '매수', SELL: '매도', CYCLE: '매수 & 매도' }
  const successCount = results.filter((r) => r.success).length
  const failCount = results.length - successCount
  const statusIcon = failCount === 0 ? '✅' : successCount === 0 ? '❌' : '⚠️'

  const lines = [
    `${statusIcon} <b>MyCoinBot 스케줄 실행 결과</b>`,
    ``,
    `거래소: ${job.exchange}`,
    `코인: ${job.coin}`,
    `방식: ${tradeTypeLabel[job.trade_type as TradeType] ?? job.trade_type}`,
    job.trade_type !== 'SELL' ? `금액: ${Number(job.amount_krw).toLocaleString()}원` : '',
    ``,
    `<b>계정별 결과 (${successCount}성공 / ${failCount}실패)</b>`,
    ...results.map((r) => `${r.success ? '✅' : '❌'} ${r.accountName}${r.success ? '' : `: ${r.reason ?? '오류'}`}`),
  ].filter((l) => l !== undefined)

  return lines.join('\n')
}

// POST /api/cron → cron-job.org 에서 매 1분 호출
export async function POST(req: NextRequest) {
  // 보안: CRON_SECRET 검증
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { now, today, currentTime } = getKSTDateTime()
  const db = createServerClient()

  // heartbeat 기록 (Supabase)
  await db.from('system_settings').upsert({ key: 'cron_last_ping', value: now.toISOString() })

  // 1) 실행 대상 조회: 날짜 범위만 DB 필터, 시간은 JS에서 비교 (HH:MM / HH:MM:SS 포맷 무관)
  const { data: allActiveJobs } = await db
    .from('trade_jobs')
    .select('*')
    .lte('schedule_from', today)
    .gte('schedule_to', today)

  const jobs = (allActiveJobs ?? []).filter((job: TradeJobRow) =>
    (job.schedule_time as string).startsWith(currentTime)
  )

  if (jobs.length === 0) {
    return Response.json({ message: '실행 대상 없음', executed: 0 })
  }

  // 2) 중복 실행 방지
  const pendingJobs = jobs.filter((job: TradeJobRow) => {
    if (!job.last_executed_at) return true
    return job.last_executed_at.slice(0, 10) !== today
  })

  if (pendingJobs.length === 0) {
    return Response.json({ message: '이미 실행 완료', executed: 0 })
  }

  const results = []

  for (const job of pendingJobs) {
    const { data: accounts } = await db
      .from('exchange_accounts')
      .select('*')
      .in('id', job.account_ids)

    if (!accounts || accounts.length === 0) {
      results.push({ jobId: job.id, status: 'SKIP', reason: '계정 없음' })
      continue
    }

    const tt = job.trade_type as TradeType

    // 계정별 거래 실행
    const orderResults = await Promise.all(
      accounts.map(async (acc) => {
        try {
          let result

          if (tt === 'CYCLE') {
            // 매수 → 체결 대기 → 전량 매도
            result = await placeCycleOrder(
              job.exchange as Exchange,
              acc.access_key,
              acc.secret_key,
              job.coin,
              job.amount_krw,
            )
          } else if (tt === 'SELL') {
            // 보유 코인 전량 매도
            const coinQty = await getCoinBalance(
              job.exchange as Exchange,
              acc.access_key,
              acc.secret_key,
              job.coin,
            )
            if (coinQty <= 0) {
              result = { success: false, reason: `보유 ${job.coin} 없음` }
            } else {
              result = await placeMarketOrderByCoinQty(
                job.exchange as Exchange,
                acc.access_key,
                acc.secret_key,
                job.coin,
                coinQty,
              )
              // 실패 시 1회 재시도
              if (!result.success) {
                result = await placeMarketOrderByCoinQty(
                  job.exchange as Exchange,
                  acc.access_key,
                  acc.secret_key,
                  job.coin,
                  coinQty,
                )
              }
            }
          } else {
            // BUY
            result = await placeMarketOrder(
              job.exchange as Exchange,
              acc.access_key,
              acc.secret_key,
              job.coin,
              'buy',
              job.amount_krw,
            )
            // 실패 시 1회 재시도
            if (!result.success) {
              result = await placeMarketOrder(
                job.exchange as Exchange,
                acc.access_key,
                acc.secret_key,
                job.coin,
                'buy',
                job.amount_krw,
              )
            }
          }

          return { accountId: acc.id, accountName: acc.account_name, ...result }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : '알 수 없는 오류'
          return { accountId: acc.id, accountName: acc.account_name, success: false, reason: msg.slice(0, 60) }
        }
      }),
    )

    // schedule_to 날짜 마지막 실행이면 스케줄 삭제, 아니면 last_executed_at 갱신
    if (today === job.schedule_to) {
      await db.from('trade_jobs').delete().eq('id', job.id)
    } else {
      await db.from('trade_jobs').update({ last_executed_at: now.toISOString() }).eq('id', job.id)
    }

    results.push({ jobId: job.id, status: 'DONE', orderResults })

    // 텔레그램 알림 발송 (등록한 사용자에게)
    try {
      const { data: user } = await db
        .from('users')
        .select('telegram_chat_id')
        .eq('id', job.user_id)
        .single()

      if (user?.telegram_chat_id) {
        const msg = buildTelegramMessage(job, orderResults)
        await sendTelegramMessage(user.telegram_chat_id, msg)
      }
    } catch { /* 알림 실패는 무시 */ }
  }

  return Response.json({ message: '실행 완료', executed: results.length, results })
}
