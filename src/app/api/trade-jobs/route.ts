import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase'
import { sendTelegramMessage } from '@/lib/telegram'
import { isValidExchange, isValidTradeType, isValidCoin, isValidUuidArray, parseAmountKrw, isValidDate, isValidTime } from '@/lib/validation'

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

  const sorted = Array.from(jobMap.values()).sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
  return Response.json(sorted)
}

// POST /api/trade-jobs → 스케줄 등록
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return Response.json({ error: '로그인 필요' }, { status: 401 })

  const body = await req.json()
  const { exchange, coin, tradeType, amountKrw, accountIds, scheduleFrom, scheduleTo, scheduleTime } = body

  // 입력 검증
  if (!isValidExchange(exchange)) {
    return Response.json({ error: '유효하지 않은 거래소입니다.' }, { status: 400 })
  }
  if (!isValidCoin(coin)) {
    return Response.json({ error: '유효하지 않은 코인입니다.' }, { status: 400 })
  }
  if (!isValidTradeType(tradeType)) {
    return Response.json({ error: '유효하지 않은 거래 방식입니다.' }, { status: 400 })
  }
  if (!isValidUuidArray(accountIds)) {
    return Response.json({ error: '계정을 선택해주세요.' }, { status: 400 })
  }

  // 계정 소유권 검증 — 본인 계정 또는 (관리자라면) 위임받은 계정만 허용
  {
    const dbCheck = createServerClient()
    const { data: ownAccs } = await dbCheck
      .from('exchange_accounts')
      .select('id')
      .in('id', accountIds)
      .eq('user_id', session.userId)
    const allowed = new Set((ownAccs ?? []).map((a) => a.id))
    if (session.isAdmin) {
      const { data: delegators } = await dbCheck
        .from('users')
        .select('id')
        .eq('delegated', true)
      const delegatorIds = (delegators ?? []).map((u) => u.id)
      if (delegatorIds.length > 0) {
        const { data: delAccs } = await dbCheck
          .from('exchange_accounts')
          .select('id')
          .in('id', accountIds)
          .in('user_id', delegatorIds)
        for (const a of delAccs ?? []) allowed.add(a.id)
      }
    }
    if ((accountIds as string[]).some((id) => !allowed.has(id))) {
      return Response.json({ error: '권한이 없는 계정이 포함되어 있습니다.' }, { status: 403 })
    }
  }

  const parsedAmount = parseAmountKrw(amountKrw)
  if (tradeType !== 'SELL' && (parsedAmount === null || parsedAmount < 5100)) {
    return Response.json({ error: '최소 거래 금액은 5,100원입니다.' }, { status: 400 })
  }
  if (!isValidDate(scheduleFrom) || !isValidDate(scheduleTo) || !isValidTime(scheduleTime)) {
    return Response.json({ error: '스케줄 날짜와 시간을 올바르게 입력해주세요.' }, { status: 400 })
  }

  const db = createServerClient()
  const { data, error } = await db
    .from('trade_jobs')
    .insert({
      user_id: session.userId,
      exchange,
      coin: coin.toUpperCase(),
      trade_type: tradeType,
      amount_krw: parsedAmount ?? 0,
      account_ids: accountIds,
      schedule_from: scheduleFrom,
      schedule_to: scheduleTo,
      schedule_time: scheduleTime,
    })
    .select()
    .single()

  if (error) {
    console.error('[trade-jobs] insert error:', error)
    return Response.json({ error: '스케줄 등록에 실패했습니다.' }, { status: 500 })
  }

  // 텔레그램 알림: 등록자(전체) + 계정 소유자(본인 계정만)
  try {
    const { data: accRows } = await db
      .from('exchange_accounts')
      .select('id, account_name, user_id')
      .in('id', accountIds)

    const accOwnerMap = new Map<string, string>()
    for (const acc of accRows ?? []) accOwnerMap.set(acc.id, acc.user_id)

    const targetUserIds = new Set<string>([session.userId])
    for (const acc of accRows ?? []) targetUserIds.add(acc.user_id)

    const { data: targetUsers } = await db
      .from('users')
      .select('id, telegram_chat_id')
      .in('id', Array.from(targetUserIds))

    for (const tu of targetUsers ?? []) {
      if (!tu.telegram_chat_id) continue

      const isRegistrant = tu.id === session.userId
      const myAccs = (accRows ?? []).filter((a) =>
        isRegistrant ? true : a.user_id === tu.id
      )
      if (myAccs.length === 0) continue

      const accNames = myAccs.map((a) => a.account_name).join(', ')
      const showAdmin = !isRegistrant
      const msg = [
        `📅 <b>스케줄 등록</b>`,
        ...(showAdmin ? [``, `🔑 등록자: MyCoinBot`] : []),
        ``,
        `거래소: ${exchange}`,
        `계정: ${accNames}`,
        `코인: ${coin.toUpperCase()}`,
        `방식: ${TRADE_TYPE_LABEL[tradeType] ?? tradeType}`,
        tradeType !== 'SELL' ? `금액: ${Number(amountKrw).toLocaleString()}원` : '',
        `기간: ${scheduleFrom} ~ ${scheduleTo}`,
        `시간: ${scheduleTime}`,
      ].filter(Boolean).join('\n')
      await sendTelegramMessage(tu.telegram_chat_id, msg)
    }
  } catch { /* 알림 실패 무시 */ }

  return Response.json(data, { status: 201 })
}
