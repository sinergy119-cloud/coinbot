// POST /api/app/trade-jobs/:id/report — 앱 실행 결과 보고
// design-schema.md §4-8
//
// 앱이 FCM 수신 → 로컬 키로 실행 → 이 엔드포인트로 결과 보고
// job_executions 테이블 INSERT (PK 중복 시 다른 기기가 먼저 실행 → skip)
// 성공 시 trade_jobs.last_executed_at 갱신 + 알림 발송

import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase'
import { ok, unauthorized, notFound, fail } from '@/lib/app/response'
import { sendNotification } from '@/lib/app/notifications'

const VALID_RESULTS = ['success', 'fail', 'skip'] as const

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session) return unauthorized()

  const { id: jobId } = await params
  if (!jobId) return fail('id가 필요합니다.')

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return fail('잘못된 요청 형식입니다.')
  }

  const executionDate = body.executionDate
  const result = body.result
  const deviceEndpoint = body.deviceEndpoint
  const errorMessage = body.errorMessage

  if (typeof executionDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(executionDate)) {
    return fail('executionDate는 YYYY-MM-DD 형식이어야 합니다.')
  }
  if (typeof result !== 'string' || !(VALID_RESULTS as readonly string[]).includes(result)) {
    return fail('result는 success/fail/skip 중 하나여야 합니다.')
  }

  const db = createServerClient()
  // 본인 소유 job 확인
  const { data: job } = await db
    .from('trade_jobs')
    .select('id, user_id, exchange, coin, trade_type, amount_krw')
    .eq('id', jobId)
    .maybeSingle()

  if (!job) return notFound('스케줄')
  if (job.user_id !== session.userId) return fail('본인의 스케줄만 보고할 수 있습니다.', 403)

  // 중복 실행 락 (job_id, user_id, execution_date PK)
  const { error: insertError } = await db.from('job_executions').insert({
    job_id: jobId,
    user_id: session.userId,
    executed_by_device: typeof deviceEndpoint === 'string' ? deviceEndpoint.slice(0, 500) : null,
    execution_date: executionDate,
    result,
    error_message: typeof errorMessage === 'string' ? errorMessage.slice(0, 500) : null,
  })

  if (insertError) {
    // 23505 = unique violation → 다른 기기가 먼저 실행
    if (insertError.code === '23505') {
      return fail('already_executed_by_other_device', 409)
    }
    console.error('[app/trade-jobs/report] insert error:', insertError)
    return fail('보고 기록에 실패했습니다.', 500)
  }

  // 성공 시 last_executed_at 갱신
  if (result === 'success') {
    await db.from('trade_jobs').update({ last_executed_at: new Date().toISOString() }).eq('id', jobId)
  }

  // trade_logs 기록 (앱 스케줄 실행)
  try {
    await db.from('trade_logs').insert({
      user_id: session.userId,
      trade_job_id: jobId,
      exchange: job.exchange,
      coin: job.coin,
      trade_type: job.trade_type,
      amount_krw: job.amount_krw ?? 0,
      account_id: null,
      account_name: typeof deviceEndpoint === 'string' ? deviceEndpoint.slice(-12) : null,
      success: result === 'success',
      reason: typeof errorMessage === 'string' ? errorMessage.slice(0, 200) : null,
      source: 'app_schedule',
    })
  } catch { /* 로그 실패 무시 */ }

  // 알림 기록 + 푸시
  const isSuccess = result === 'success'
  const title = isSuccess ? `${job.exchange} ${job.coin} 거래 성공` : `${job.exchange} ${job.coin} 거래 실패`
  const bodyText = isSuccess
    ? `${job.trade_type} ${Number(job.amount_krw).toLocaleString()}원 체결 완료`
    : (typeof errorMessage === 'string' ? errorMessage.slice(0, 100) : '실패')

  await sendNotification({
    userId: session.userId,
    category: 'trade_result',
    title,
    body: bodyText,
    deepLink: `/trade-history`,
    metadata: { jobId, exchange: job.exchange, coin: job.coin, result },
  })

  return ok({ recorded: true })
}
