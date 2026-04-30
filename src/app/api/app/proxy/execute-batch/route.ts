// POST /api/app/proxy/execute-batch — 다계정 동시 거래 프록시
// design-schema.md §4-6

import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { encrypt } from '@/lib/crypto'
import { placeMarketOrder, placeCycleOrder, placeMarketOrderByCoinQty, getCoinBalance, getBalance } from '@/lib/exchange'
import { userRateLimit } from '@/lib/app/rate-limit'
import { ok, unauthorized, fail } from '@/lib/app/response'
import { isValidExchange, isValidTradeType, isValidCoin, parseAmountKrw } from '@/lib/validation'
import { createServerClient } from '@/lib/supabase'
import { notifyTradeResult } from '@/lib/app/notifications'
import type { Exchange, TradeType } from '@/types/database'

interface AccountInput {
  label?: unknown
  accessKey: unknown
  secretKey: unknown
}

interface ResultItem {
  label: string | null
  ok: boolean
  balanceBefore: number
  balance: number
  error?: string
  buyOrderId?: string | null
  sellOrderId?: string | null
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  const rl = userRateLimit(session.userId, 'proxy:execute-batch', 10)
  if (!rl.ok) return fail(`요청이 너무 많습니다. ${rl.resetInSec}초 후 다시 시도하세요.`, 429)

  let body: {
    exchange?: unknown
    coin?: unknown
    tradeType?: unknown
    amountKrw?: unknown
    accounts?: AccountInput[]
  }
  try {
    body = await req.json()
  } catch {
    return fail('잘못된 요청 형식입니다.')
  }

  const { exchange, coin, tradeType, amountKrw, accounts } = body
  if (!isValidExchange(exchange)) return fail('유효하지 않은 거래소입니다.')
  if (!isValidCoin(coin)) return fail('유효하지 않은 코인입니다.')
  if (!isValidTradeType(tradeType)) return fail('유효하지 않은 거래 방식입니다.')
  if (!Array.isArray(accounts) || accounts.length === 0 || accounts.length > 10) {
    return fail('accounts는 1~10개여야 합니다.')
  }

  const tt = tradeType as TradeType
  const parsedAmount = parseAmountKrw(amountKrw)
  if (tt !== 'SELL' && (parsedAmount === null || parsedAmount < 5100)) {
    return fail('최소 거래 금액은 5,100원입니다.')
  }

  const results: ResultItem[] = await Promise.all(
    accounts.map(async (acc) => {
      const label = typeof acc.label === 'string' ? acc.label : null
      if (typeof acc.accessKey !== 'string' || typeof acc.secretKey !== 'string') {
        return { label, ok: false, balanceBefore: 0, balance: 0, error: '유효한 API Key 필요' }
      }
      const encAccess = encrypt(acc.accessKey)
      const encSecret = encrypt(acc.secretKey)

      let balanceBefore = 0
      try {
        const bb = await getBalance(exchange as Exchange, encAccess, encSecret)
        balanceBefore = Math.floor(bb.krw)
      } catch { /* 무시 */ }

      try {
        if (tt === 'CYCLE') {
          const r = await placeCycleOrder(exchange as Exchange, encAccess, encSecret, coin as string, parsedAmount ?? 0)
          let balance = 0
          try {
            const bb = await getBalance(exchange as Exchange, encAccess, encSecret)
            balance = Math.floor(bb.krw)
          } catch { /* 무시 */ }
          return {
            label,
            ok: r.success,
            balanceBefore,
            balance,
            buyOrderId: r.buyOrderId ?? null,
            sellOrderId: r.sellOrderId ?? null,
            ...(r.success ? {} : { error: r.reason }),
          }
        }
        if (tt === 'SELL') {
          const coinQty = await getCoinBalance(exchange as Exchange, encAccess, encSecret, coin as string)
          if (coinQty <= 0) return { label, ok: false, balanceBefore, balance: 0, error: '보유 코인 없음' }
          const r = await placeMarketOrderByCoinQty(exchange as Exchange, encAccess, encSecret, coin as string, coinQty)
          let balance = 0
          try {
            const bb = await getBalance(exchange as Exchange, encAccess, encSecret)
            balance = Math.floor(bb.krw)
          } catch { /* 무시 */ }
          return { label, ok: r.success, balanceBefore, balance, ...(r.success ? {} : { error: r.reason }) }
        }
        // BUY
        const r = await placeMarketOrder(exchange as Exchange, encAccess, encSecret, coin as string, 'buy', parsedAmount ?? 0)
        let balance = 0
        try {
          const bb = await getBalance(exchange as Exchange, encAccess, encSecret)
          balance = Math.floor(bb.krw)
        } catch { /* 무시 */ }
        return { label, ok: r.success, balanceBefore, balance, ...(r.success ? {} : { error: r.reason }) }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '알 수 없는 오류'
        return { label, ok: false, balanceBefore, balance: 0, error: msg.slice(0, 100) }
      }
    }),
  )

  // trade_logs 일괄 기록 (앱 수동 실행)
  try {
    const db = createServerClient()
    const logs = results.map((r) => ({
      user_id: session.userId,
      exchange,
      coin: (coin as string).toUpperCase(),
      trade_type: tradeType,
      amount_krw: parsedAmount ?? 0,
      account_id: null,
      account_name: r.label,
      success: r.ok,
      reason: r.error?.slice(0, 200) ?? null,
      balance_before: r.balanceBefore,
      balance: r.balance,
      source: 'app_manual',
    }))
    if (logs.length > 0) await db.from('trade_logs').insert(logs)
  } catch { /* 로그 실패 무시 */ }

  // 알림함 기록 + 푸시 (계정별 1건씩)
  await Promise.all(
    results.map((r) =>
      notifyTradeResult({
        userId: session.userId,
        exchange: exchange as string,
        coin: (coin as string).toUpperCase(),
        tradeType: tradeType as string,
        amountKrw: parsedAmount ?? 0,
        success: r.ok,
        reason: r.error ?? null,
        accountLabel: r.label,
        metadata: { source: 'app_manual' },
      }),
    ),
  )

  return ok({ results })
}
