import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase'
import { validateMarket, getBalance, getCoinBalance, getCurrentPrice } from '@/lib/exchange'
import { isValidExchange, isValidTradeType, isValidCoin, isValidUuidArray, parseAmountKrw } from '@/lib/validation'
import type { Exchange } from '@/types/database'

export interface ValidationItem {
  accountId: string
  exchange: string
  accountName: string
  orderSummary: string
  balance: number       // KRW ?�고 (BUY/CYCLE), SELL???�는 0
  coinQty?: number      // SELL: 보유 코인 ?�량
  coin?: string         // SELL: 코인 ?�볼
  feasible: boolean
  reason: string
}

// POST /api/validate ???�행 ??검�?
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return Response.json({ error: '로그???�요' }, { status: 401 })

  const { exchange, coin, tradeType, amountKrw, accountIds } = await req.json()

  if (!isValidExchange(exchange)) {
    return Response.json({ error: '?�효?��? ?��? 거래?�입?�다.' }, { status: 400 })
  }
  if (!isValidCoin(coin)) {
    return Response.json({ error: '?�효?��? ?��? 코인?�니??' }, { status: 400 })
  }
  if (!isValidTradeType(tradeType)) {
    return Response.json({ error: '?�효?��? ?��? 거래 방식?�니??' }, { status: 400 })
  }
  if (!isValidUuidArray(accountIds)) {
    return Response.json({ error: '계정???�택?�주?�요.' }, { status: 400 })
  }
  const parsedAmount = parseAmountKrw(amountKrw)

  // 1) 코인 ?�효??검�?
  const { valid, symbol } = await validateMarket(exchange as Exchange, coin)
  if (!valid) {
    return Response.json({ error: `${coin}?�(?? ${exchange}?�서 지?�하지 ?�는 코인?�니??` }, { status: 400 })
  }

  // 2) ?�택??계정 목록 조회 (본인 + 관리자?????�임 계정)
  const db = createServerClient()
  const { data: myAccounts } = await db
    .from('exchange_accounts')
    .select('*')
    .in('id', accountIds)
    .eq('user_id', session.userId)

  let delegatedAccounts: typeof myAccounts = []
  if (session.isAdmin) {
    const { data: delegators } = await db
      .from('users')
      .select('id')
      .eq('delegated', true)
    const delegatorIds = (delegators ?? []).map((u) => u.id)
    if (delegatorIds.length > 0) {
      const { data } = await db
        .from('exchange_accounts')
        .select('*')
        .in('id', accountIds)
        .in('user_id', delegatorIds)
      delegatedAccounts = data ?? []
    }
  }

  const accounts = [...(myAccounts ?? []), ...(delegatedAccounts ?? [])]
  if (accounts.length === 0) {
    return Response.json({ error: '계정??찾을 ???�습?�다.' }, { status: 404 })
  }

  const isSell = tradeType === 'SELL'
  const isCycle = tradeType === 'CYCLE'
  const upperCoin = coin.toUpperCase()

  // 주문 ?�약
  const orderSummary = isCycle
    ? `${symbol} 매수(?�장가) & 매도(?�장가, ?�체 ?�량) ${(parsedAmount ?? 0).toLocaleString()}??
    : isSell
    ? `${symbol} ?�량 매도(?�장가)`
    : `${symbol} 매수(?�장가) ${(parsedAmount ?? 0).toLocaleString()}??

  // 매도/?�이?? ?�재가 미리 조회
  let currentPrice = 0
  if (isSell || isCycle) {
    try {
      currentPrice = await getCurrentPrice(exchange as Exchange, coin)
    } catch { /* ?�재가 조회 ?�패 ??0?�로 진행 */ }
  }

  const results: ValidationItem[] = await Promise.all(
    accounts.map(async (acc) => {
      try {
        // CYCLE: KRW ?�고 검�?
        if (isCycle) {
          const { krw } = await getBalance(exchange as Exchange, acc.access_key, acc.secret_key)
          const feasible = krw >= (parsedAmount ?? 0)
          return {
            accountId: acc.id,
            exchange: acc.exchange,
            accountName: acc.account_name,
            orderSummary,
            balance: krw,
            feasible,
            reason: feasible ? '가??(매수 ???�량 매도)' : '?�고 부�?,
          }
        }

        // SELL: 코인 ?�고 검�?(보유??× ?�재가 >= 5,000??
        if (isSell) {
          const coinBalance = await getCoinBalance(exchange as Exchange, acc.access_key, acc.secret_key, coin)
          const valueKrw = currentPrice > 0 ? coinBalance * currentPrice : 0
          const coinDisplay = coinBalance.toFixed(8).replace(/\.?0+$/, '') || '0'
          const feasible = coinBalance > 0 && (currentPrice <= 0 || valueKrw >= 5000)
          const reason = !feasible
            ? coinBalance <= 0
              ? `매도 불�? ??보유 ${upperCoin} ?�음`
              : `매도 불�? ??보유 ${upperCoin}???�장가 ?�산?�이 5,000??미만?�니??(보유: ${coinDisplay} ${upperCoin} ??${Math.floor(valueKrw).toLocaleString()}??`
            : `가??(보유 ${coinDisplay} ${upperCoin} ?�량 매도)`
          return {
            accountId: acc.id,
            exchange: acc.exchange,
            accountName: acc.account_name,
            orderSummary,
            balance: 0,
            coinQty: coinBalance,
            coin: upperCoin,
            feasible,
            reason,
          }
        }

        // BUY: KRW ?�고 검�?
        const { krw } = await getBalance(exchange as Exchange, acc.access_key, acc.secret_key)
        const feasible = krw >= (parsedAmount ?? 0)
        return {
          accountId: acc.id,
          exchange: acc.exchange,
          accountName: acc.account_name,
          orderSummary,
          balance: krw,
          feasible,
          reason: feasible ? '가?? : '?�고 부�?,
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'API ?�류'
        return {
          accountId: acc.id,
          exchange: acc.exchange,
          accountName: acc.account_name,
          orderSummary,
          balance: 0,
          feasible: false,
          reason: `API ?�류: ${msg.slice(0, 60)}`,
        }
      }
    }),
  )

  return Response.json(results)
}
