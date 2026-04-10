import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase'
import { sendTelegramMessage } from '@/lib/telegram'

const TRADE_TYPE_LABEL: Record<string, string> = { BUY: '매수', SELL: '매도', CYCLE: '매수 & 매도' }

// GET /api/trade-jobs → 거래 목록 조회
// 본인이 등록한 스케줄 + 본인 계정이 포함된 타인의 스케줄
export async function GET() {
  const session = await getSession()
  if (!session) return Response.json({ error: '로그인 필요' }, { status: 401 })

  const db = createServerClient()

  // 1) 본인이 등록한 스케줄
  const { data: myJobs } = await db
    .from('trade_jobs')
    .select('*')
    .eq('user_id', session.userId)
    .order('created_at', { ascending: false })

  // 2) 본인 계정 ID 목록
  const { data: myAccounts } = await db
    .from('exchange_accounts')
    .select('id')
    .eq('user_id', session.userId)
  const myAccountIds = new Set((myAccounts ?? []).map((a) => a.id))

  // 3) 본인 계정이 포함된 타인의 스케줄
  let delegatedJobs: typeof myJobs = []
  if (myAccountIds.size > 0) {
    const { data: allOtherJobs } = await db
      .from('trade_jobs')
      .select('*')
      .neq('user_id', session.userId)
      .order('created_at', { ascending: false })

    delegatedJobs = (allOtherJobs ?? []).filter((job) =>
      (job.account_ids as string[]).some((id) => myAccountIds.has(id))
    )
  }

  // 4) 합치기 (중복 제거)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jobMap = new Map<string, any>()
  for (const job of [...(myJobs ?? []), ...(delegatedJobs ?? [])]) {
    if (!jobMap.has(job.id)) jobMap.set(job.id, job)
  }

  return Response.json(Array.from(jobMap.values()))
}

// POST /api/trade-jobs → 스케줄 등록
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return Response.json({ error: '로그인 필요' }, { status: 401 })

  const body = await req.json()
  const { exchange, coin, tradeType, amountKrw, accountIds, scheduleFrom, scheduleTo, scheduleTime } = body

  // 기본 검증
  if (!exchange || !coin || !tradeType || !accountIds?.length) {
    return Response.json({ error: '필수 항목을 모두 입력해주세요.' }, { status: 400 })
  }
  if (tradeType !== 'SELL' && (!amountKrw || amountKrw < 5100)) {
    return Response.json({ error: '최소 거래 금액은 5,100원입니다.' }, { status: 400 })
  }
  if (!scheduleFrom || !scheduleTo || !scheduleTime) {
    return Response.json({ error: '스케줄 날짜와 시간을 입력해주세요.' }, { status: 400 })
  }

  const db = createServerClient()
  const { data, error } = await db
    .from('trade_jobs')
    .insert({
      user_id: session.userId,
      exchange,
      coin: coin.toUpperCase(),
      trade_type: tradeType,
      amount_krw: amountKrw,
      account_ids: accountIds,
      schedule_from: scheduleFrom,
      schedule_to: scheduleTo,
      schedule_time: scheduleTime,
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // 텔레그램 알림
  try {
    const { data: user } = await db.from('users').select('telegram_chat_id').eq('id', session.userId).single()
    if (user?.telegram_chat_id) {
      const { data: accRows } = await db.from('exchange_accounts').select('id, account_name').in('id', accountIds)
      const accNames = accRows?.map((a) => a.account_name).join(', ') ?? ''
      const msg = [
        `📅 <b>스케줄 등록</b>`,
        ``,
        `거래소: ${exchange}`,
        `계정: ${accNames}`,
        `코인: ${coin.toUpperCase()}`,
        `방식: ${TRADE_TYPE_LABEL[tradeType] ?? tradeType}`,
        tradeType !== 'SELL' ? `금액: ${Number(amountKrw).toLocaleString()}원` : '',
        `기간: ${scheduleFrom} ~ ${scheduleTo}`,
        `시간: ${scheduleTime}`,
      ].filter(Boolean).join('\n')
      await sendTelegramMessage(user.telegram_chat_id, msg)
    }
  } catch { /* 알림 실패 무시 */ }

  return Response.json(data, { status: 201 })
}
