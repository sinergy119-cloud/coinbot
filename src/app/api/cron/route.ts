import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import {
  placeMarketOrder,
  placeCycleOrder,
  placeMarketOrderByCoinQty,
  getCoinBalance,
} from '@/lib/exchange'
import { sendTelegramMessage } from '@/lib/telegram'
import { sendFCMToTokens } from '@/lib/push'
import type { Exchange, TradeType, TradeJobRow } from '@/types/database'

// 앱 사용자 job — account_ids 비어있으면 FCM으로 실행 트리거
async function dispatchAppJob(
  db: ReturnType<typeof createServerClient>,
  job: TradeJobRow,
  today: string,
  now: Date,
): Promise<{ ok: boolean; tokensCount: number; sent: number; reason?: string; errors?: string[] }> {
  const { data: subs } = await db
    .from('push_subscriptions')
    .select('endpoint')
    .eq('user_id', job.user_id)
  const tokens = (subs ?? []).map((s) => s.endpoint as string)
  if (tokens.length === 0) {
    // 구독 없음 — 실행 불가. 중복 방지 위해 last_executed_at 갱신 (다음 분 재시도 방지)
    await db.from('trade_jobs').update({ last_executed_at: now.toISOString() }).eq('id', job.id)
    return { ok: false, tokensCount: 0, sent: 0, reason: 'no_subscriptions' }
  }

  const deepLink = `/app/schedule/execute/${job.id}?date=${today}`
  const result = await sendFCMToTokens(
    tokens,
    {
      title: '자동 거래 실행',
      body: `${job.exchange} ${job.coin} ${job.trade_type}`,
      category: 'schedule',
      deepLink,
      data: {
        type: 'execute_trade',
        jobId: job.id,
        executionDate: today,
        exchange: job.exchange,
        coin: job.coin,
        tradeType: job.trade_type,
        amountKrw: String(job.amount_krw ?? 0),
      },
    },
    true, // dataOnly=true → SW onBackgroundMessage에서 자동 실행 처리
  )

  // 만료 토큰 정리
  if (result.invalidTokens.length > 0) {
    await db
      .from('push_subscriptions')
      .delete()
      .eq('user_id', job.user_id)
      .in('endpoint', result.invalidTokens)
  }

  // 발송 시도 여부와 무관하게 last_executed_at 갱신 (매 분 재발송 방지)
  // 실제 실행 결과는 앱이 /app/trade-jobs/[id]/report 로 보고 → job_executions 테이블
  if (today === job.schedule_to) {
    await db.from('trade_jobs').update({ status: 'completed', last_executed_at: now.toISOString() }).eq('id', job.id)
  } else {
    await db.from('trade_jobs').update({ last_executed_at: now.toISOString() }).eq('id', job.id)
  }

  return { ok: result.sent > 0, tokensCount: tokens.length, sent: result.sent, errors: result.errors.length > 0 ? result.errors : undefined }
}

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
  showAdmin?: boolean,
): string {
  const tradeTypeLabel: Record<TradeType, string> = { BUY: '매수', SELL: '매도', CYCLE: '매수 & 매도' }
  const successCount = results.filter((r) => r.success).length
  const failCount = results.length - successCount
  const statusIcon = failCount === 0 ? '✅' : successCount === 0 ? '❌' : '⚠️'

  const lines = [
    `${statusIcon} <b>MyCoinBot 스케줄 실행 결과</b>`,
    ...(showAdmin ? [``, `🔑 실행자: MyCoinBot`] : []),
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

// POST /api/cron → AWS EC2 crontab에서 매 1분 호출
export async function POST(req: NextRequest) {
  // 보안: CRON_SECRET 검증
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { now, today } = getKSTDateTime()
  const db = createServerClient()

  // 1) 실행 대상 조회: 날짜 범위만 DB 필터, 시간은 JS에서 비교 (HH:MM / HH:MM:SS 포맷 무관)
  const { data: allActiveJobs } = await db
    .from('trade_jobs')
    .select('*')
    .eq('status', 'active')
    .lte('schedule_from', today)
    .gte('schedule_to', today)

  // 스케줄 시간 이후 2분 이내에만 실행 (10:00 설정 → 10:00~10:02 사이 실행)
  const kstMs = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' })).getTime()
  const jobs = (allActiveJobs ?? []).filter((job: TradeJobRow) => {
    const [hh, mm] = (job.schedule_time as string).split(':').map(Number)
    const jobMs = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
    jobMs.setHours(hh, mm, 0, 0)
    const diff = kstMs - jobMs.getTime()
    return diff >= 0 && diff <= 120_000  // 0초~2분 이내
  })

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
    // 앱 사용자 케이스 분기: account_ids 비어있음 → FCM 발송으로 위임
    if (!job.account_ids || job.account_ids.length === 0) {
      const d = await dispatchAppJob(db, job, today, now)
      results.push({
        jobId: job.id,
        status: d.ok ? 'DISPATCHED' : 'DISPATCH_FAILED',
        tokensCount: d.tokensCount,
        sent: d.sent,
        ...(d.reason ? { reason: d.reason } : {}),
        ...(d.errors && d.errors.length > 0 ? { errors: d.errors } : {}),
      })
      continue
    }

    // 기존 웹 DB 키 케이스 (관리자·위임자)
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

    // schedule_to 날짜 마지막 실행이면 completed, 아니면 last_executed_at 갱신
    if (today === job.schedule_to) {
      await db.from('trade_jobs').update({ status: 'completed', last_executed_at: now.toISOString() }).eq('id', job.id)
    } else {
      await db.from('trade_jobs').update({ last_executed_at: now.toISOString() }).eq('id', job.id)
    }

    results.push({ jobId: job.id, status: 'DONE', orderResults })

    // 거래 실행 로그 저장
    try {
      const logs = orderResults.map((r: { accountId?: string; accountName: string; success: boolean; reason?: string }) => ({
        user_id: job.user_id,
        trade_job_id: job.id,
        exchange: job.exchange,
        coin: job.coin,
        trade_type: job.trade_type,
        amount_krw: job.amount_krw || 0,
        account_id: r.accountId || null,
        account_name: r.accountName,
        success: r.success,
        reason: r.reason?.slice(0, 200),
        source: 'schedule',
      }))
      await db.from('trade_logs').insert(logs)

      // 연속 실패 감지: 이번 실행에서 전부 실패했으면 최근 3회 체크
      const allFailed = orderResults.every((r: { success: boolean }) => !r.success)
      if (allFailed) {
        const { data: recentLogs } = await db
          .from('trade_logs')
          .select('success')
          .eq('trade_job_id', job.id)
          .order('executed_at', { ascending: false })
          .limit(3)
        const consecutiveFails = (recentLogs ?? []).length >= 3 && (recentLogs ?? []).every((l) => !l.success)
        if (consecutiveFails) {
          // 관리자에게 긴급 알림
          const adminId = process.env.ADMIN_USER_ID
          if (adminId) {
            const { data: admin } = await db.from('users').select('telegram_chat_id').eq('user_id', adminId).single()
            if (admin?.telegram_chat_id) {
              await sendTelegramMessage(admin.telegram_chat_id, [
                `🚨 <b>연속 실패 경고</b>`,
                ``,
                `거래소: ${job.exchange}`,
                `코인: ${job.coin}`,
                `스케줄이 3회 연속 실패했습니다.`,
                `확인이 필요합니다.`,
              ].join('\n'))
            }
          }
        }
      }
    } catch { /* 로그 저장 실패는 무시 */ }

    // 텔레그램 알림 발송: 수신자별로 본인 계정 결과만 필터링
    try {
      // 계정별 소유자 맵 (accountId → user_id)
      const accOwnerMap = new Map<string, string>()
      for (const acc of accounts ?? []) accOwnerMap.set(acc.id, acc.user_id)

      // 수신 대상: 스케줄 등록자 + 계정 소유자 (유니크)
      const targetUserIds = new Set<string>([job.user_id])
      for (const acc of accounts ?? []) targetUserIds.add(acc.user_id)

      const { data: targetUsers } = await db
        .from('users')
        .select('id, telegram_chat_id')
        .in('id', Array.from(targetUserIds))

      for (const tu of targetUsers ?? []) {
        if (!tu.telegram_chat_id) continue

        const isOwner = tu.id === job.user_id
        // 스케줄 등록자 → 전체 결과, 계정 소유자 → 본인 계정만
        const filteredResults = isOwner
          ? orderResults
          : orderResults.filter((r: { accountId?: string }) =>
              r.accountId && accOwnerMap.get(r.accountId) === tu.id
            )

        if (filteredResults.length === 0) continue
        const showAdmin = !isOwner // 본인 등록이 아니면 관리자 대행 표시
        const msg = buildTelegramMessage(job, filteredResults, showAdmin)
        await sendTelegramMessage(tu.telegram_chat_id, msg)
      }
    } catch { /* 알림 실패는 무시 */ }
  }

  return Response.json({ message: '실행 완료', executed: results.length, results })
}
