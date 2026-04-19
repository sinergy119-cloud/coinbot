// GET/POST /api/app/trade-jobs — 앱용 스케줄 CRUD
// design-schema.md §4-7

import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase'
import { ok, unauthorized, fail } from '@/lib/app/response'
import { isValidExchange, isValidTradeType, isValidCoin, parseAmountKrw, isValidDate, isValidTime } from '@/lib/validation'

interface TradeJobRow {
  id: string
  user_id: string
  exchange: string
  coin: string
  trade_type: string
  amount_krw: number
  account_ids: string[]
  schedule_from: string
  schedule_to: string
  schedule_time: string
  status: string
  last_executed_at: string | null
  created_at: string
}

function toApi(r: TradeJobRow) {
  return {
    id: r.id,
    exchange: r.exchange,
    coin: r.coin,
    tradeType: r.trade_type,
    amountKrw: r.amount_krw,
    accountIds: r.account_ids,
    scheduleFrom: r.schedule_from,
    scheduleTo: r.schedule_to,
    scheduleTime: r.schedule_time,
    status: r.status,
    lastExecutedAt: r.last_executed_at,
    createdAt: r.created_at,
    // 앱 사용자 판별: account_ids가 비어있으면 앱 실행 job
    isAppJob: !r.account_ids || r.account_ids.length === 0,
  }
}

// GET /api/app/trade-jobs — 본인 스케줄 목록
export async function GET() {
  const session = await getSession()
  if (!session) return unauthorized()

  const db = createServerClient()
  const { data } = await db
    .from('trade_jobs')
    .select('*')
    .eq('user_id', session.userId)
    .order('created_at', { ascending: false })

  const items = (data ?? []).map((r) => toApi(r as TradeJobRow))
  return ok({ items })
}

// POST /api/app/trade-jobs — 스케줄 등록
// 앱 사용자: accountIds 빈 배열 (또는 생략) → 실행 시 FCM 발송 대상
// 관리자/위임자(웹): accountIds 포함 → 서버가 직접 DB 키로 실행
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return fail('잘못된 요청 형식입니다.')
  }

  const { exchange, coin, tradeType, amountKrw, accountIds, scheduleFrom, scheduleTo, scheduleTime } = body

  if (!isValidExchange(exchange)) return fail('유효하지 않은 거래소입니다.')
  if (!isValidCoin(coin)) return fail('유효하지 않은 코인입니다.')
  if (!isValidTradeType(tradeType)) return fail('유효하지 않은 거래 방식입니다.')
  if (!isValidDate(scheduleFrom) || !isValidDate(scheduleTo) || !isValidTime(scheduleTime)) {
    return fail('스케줄 날짜와 시간을 올바르게 입력해주세요.')
  }

  // accountIds는 선택. 앱 사용자는 빈 배열/미지정 가능
  const accIds = Array.isArray(accountIds) ? (accountIds as string[]).filter((s) => typeof s === 'string') : []
  const parsedAmount = parseAmountKrw(amountKrw)
  if (tradeType !== 'SELL' && (parsedAmount === null || parsedAmount < 5100)) {
    return fail('최소 거래 금액은 5,100원입니다.')
  }

  const db = createServerClient()
  const { data, error } = await db
    .from('trade_jobs')
    .insert({
      user_id: session.userId,
      exchange,
      coin: (coin as string).toUpperCase(),
      trade_type: tradeType,
      amount_krw: parsedAmount ?? 0,
      account_ids: accIds,
      schedule_from: scheduleFrom,
      schedule_to: scheduleTo,
      schedule_time: scheduleTime,
    })
    .select()
    .single()

  if (error) {
    console.error('[app/trade-jobs] insert error:', error)
    return fail('스케줄 등록에 실패했습니다.', 500)
  }
  return ok(toApi(data as TradeJobRow))
}
