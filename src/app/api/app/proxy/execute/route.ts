// POST /api/app/proxy/execute — 앱 단일 거래 프록시
// design-schema.md §4-6 / design-security.md §2

import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { encrypt } from '@/lib/crypto'
import { placeMarketOrder, placeCycleOrder, placeMarketOrderByCoinQty, getCoinBalance, getBalance } from '@/lib/exchange'
import { userRateLimit } from '@/lib/app/rate-limit'
import { ok, unauthorized, fail } from '@/lib/app/response'
import { isValidExchange, isValidTradeType, isValidCoin, parseAmountKrw } from '@/lib/validation'
import { createServerClient } from '@/lib/supabase'
import type { Exchange, TradeType } from '@/types/database'

async function logTrade(userId: string, fields: {
  exchange: string; coin: string; trade_type: string; amount_krw: number;
  success: boolean; reason?: string; balance_before: number; balance: number;
  source: string; account_label?: string | null;
}) {
  try {
    const db = createServerClient()
    await db.from('trade_logs').insert({
      user_id: userId,
      exchange: fields.exchange,
      coin: fields.coin,
      trade_type: fields.trade_type,
      amount_krw: fields.amount_krw,
      account_id: null,
      account_name: fields.account_label ?? null,
      success: fields.success,
      reason: fields.reason?.slice(0, 200),
      balance_before: fields.balance_before,
      balance: fields.balance,
      source: fields.source,
    })
  } catch {
    // 로그 실패는 무시
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return unauthorized()

  // rate limit: 분당 30회
  const rl = userRateLimit(session.userId, 'proxy:execute', 30)
  if (!rl.ok) return fail(`요청이 너무 많습니다. ${rl.resetInSec}초 후 다시 시도하세요.`, 429)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return fail('잘못된 요청 형식입니다.')
  }

  const { exchange, coin, tradeType, amountKrw, source, accountLabel } = body
  // eslint-disable-next-line prefer-const
  let { accessKey, secretKey } = body

  if (!isValidExchange(exchange)) return fail('유효하지 않은 거래소입니다.')
  if (!isValidCoin(coin)) return fail('유효하지 않은 코인입니다.')
  if (!isValidTradeType(tradeType)) return fail('유효하지 않은 거래 방식입니다.')
  if (typeof accessKey !== 'string' || typeof secretKey !== 'string' || accessKey.length < 5 || secretKey.length < 5) {
    return fail('유효한 API Key가 필요합니다.')
  }

  const tt = tradeType as TradeType
  const parsedAmount = parseAmountKrw(amountKrw)
  if (tt !== 'SELL' && (parsedAmount === null || parsedAmount < 5100)) {
    return fail('최소 거래 금액은 5,100원입니다.')
  }

  const upperCoin = (coin as string).toUpperCase()
  const encAccess = encrypt(accessKey as string)
  const encSecret = encrypt(secretKey as string)
  // 평문 변수 즉시 폐기
  accessKey = null
  secretKey = null

  const sourceTag = (typeof source === 'string' && source === 'app_schedule') ? 'app_schedule' : 'app_manual'
  const accountLabelStr = typeof accountLabel === 'string' ? accountLabel.slice(0, 50) : null
  const logBase = {
    exchange: exchange as string,
    coin: upperCoin,
    trade_type: tradeType as string,
    amount_krw: parsedAmount ?? 0,
    source: sourceTag,
    account_label: accountLabelStr,
  }

  try {
    let balanceBefore = 0
    try {
      const bb = await getBalance(exchange as Exchange, encAccess, encSecret)
      balanceBefore = Math.floor(bb.krw)
    } catch { /* 무시 */ }

    if (tt === 'CYCLE') {
      const result = await placeCycleOrder(exchange as Exchange, encAccess, encSecret, coin as string, parsedAmount ?? 0)
      let balance = 0
      try {
        const bb = await getBalance(exchange as Exchange, encAccess, encSecret)
        balance = Math.floor(bb.krw)
      } catch { /* 무시 */ }
      await logTrade(session.userId, { ...logBase, success: result.success, reason: result.success ? undefined : result.reason, balance_before: balanceBefore, balance })
      if (!result.success) return fail(`FAIL (${result.reason})`, 400)
      return ok({
        exchange,
        coin: upperCoin,
        tradeType,
        balanceBefore,
        balance,
        buyOrderId: result.buyOrderId ?? null,
        sellOrderId: result.sellOrderId ?? null,
        executedAt: new Date().toISOString(),
      })
    }

    if (tt === 'SELL') {
      const coinQty = await getCoinBalance(exchange as Exchange, encAccess, encSecret, coin as string)
      if (coinQty <= 0) {
        await logTrade(session.userId, { ...logBase, success: false, reason: `보유 ${upperCoin} 없음`, balance_before: balanceBefore, balance: 0 })
        return fail(`보유 ${upperCoin} 없음`, 400)
      }
      const result = await placeMarketOrderByCoinQty(exchange as Exchange, encAccess, encSecret, coin as string, coinQty)
      let balance = 0
      try {
        const bb = await getBalance(exchange as Exchange, encAccess, encSecret)
        balance = Math.floor(bb.krw)
      } catch { /* 무시 */ }
      await logTrade(session.userId, { ...logBase, success: result.success, reason: result.success ? undefined : result.reason, balance_before: balanceBefore, balance })
      if (!result.success) return fail(`FAIL (${result.reason})`, 400)
      return ok({
        exchange,
        coin: upperCoin,
        tradeType,
        balanceBefore,
        balance,
        executedAt: new Date().toISOString(),
      })
    }

    // BUY
    const result = await placeMarketOrder(exchange as Exchange, encAccess, encSecret, coin as string, 'buy', parsedAmount ?? 0)
    let balance = 0
    try {
      const bb = await getBalance(exchange as Exchange, encAccess, encSecret)
      balance = Math.floor(bb.krw)
    } catch { /* 무시 */ }

    await logTrade(session.userId, { ...logBase, success: result.success, reason: result.success ? undefined : result.reason, balance_before: balanceBefore, balance })
    if (!result.success) return fail(`FAIL (${result.reason})`, 400)
    return ok({
      exchange,
      coin: upperCoin,
      tradeType,
      balanceBefore,
      balance,
      orderId: null,
      executedAt: new Date().toISOString(),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '알 수 없는 오류'
    console.error('[proxy/execute] error:', msg.slice(0, 200))
    await logTrade(session.userId, { ...logBase, success: false, reason: msg.slice(0, 100), balance_before: 0, balance: 0 })
    return fail(`실행 중 오류: ${msg.slice(0, 100)}`, 500)
  }
}
