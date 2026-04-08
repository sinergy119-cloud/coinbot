import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase'
import { isAdmin } from '@/lib/admin'
import { placeMarketOrder, placeCycleOrder, placeMarketOrderByCoinQty, getCoinBalance, getBalance } from '@/lib/exchange'
import type { Exchange, TradeType } from '@/types/database'

export interface ExecutionResultItem {
  accountId: string
  accountName: string
  exchange: string
  orderSummary: string
  balance: number
  success: boolean
  reason: string
}

// POST /api/execute → 즉시 실행
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return Response.json({ error: '로그인 필요' }, { status: 401 })

  const { exchange, coin, tradeType, amountKrw, accountIds } = await req.json()

  if (!exchange || !coin || !tradeType || !accountIds?.length) {
    return Response.json({ error: '필수 항목이 누락되었습니다.' }, { status: 400 })
  }

  const tt = tradeType as TradeType

  // 매도는 금액 불필요, 매수/사이클은 최소 금액 검증
  if (tt !== 'SELL') {
    if (!amountKrw || amountKrw < 5100) {
      return Response.json({ error: '최소 거래 금액은 5,100원입니다.' }, { status: 400 })
    }
  }

  const db = createServerClient()

  // 본인 계정 조회
  const { data: myAccounts } = await db
    .from('exchange_accounts')
    .select('*')
    .in('id', accountIds)
    .eq('user_id', session.userId)

  // 관리자인 경우: 위임된 계정도 허용
  let delegatedAccounts: typeof myAccounts = []
  if (isAdmin(session.loginId)) {
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
    return Response.json({ error: '계정을 찾을 수 없습니다.' }, { status: 404 })
  }

  const upperCoin = coin.toUpperCase()
  const orderSummary = tt === 'CYCLE'
    ? `${upperCoin}/KRW 매수(시장가) & 매도(시장가, 전체 수량) ${Number(amountKrw).toLocaleString()}원`
    : tt === 'SELL'
    ? `${upperCoin}/KRW 전량 매도(시장가)`
    : `${upperCoin}/KRW 매수(시장가) ${Number(amountKrw).toLocaleString()}원`

  // 전부 동시에 실행 (planning.md 8.4)
  const results: ExecutionResultItem[] = await Promise.all(
    accounts.map(async (acc) => {
      try {
        // CYCLE: 매수 후 전량 매도
        if (tt === 'CYCLE') {
          const result = await placeCycleOrder(
            exchange as Exchange,
            acc.access_key,
            acc.secret_key,
            coin,
            amountKrw,
          )
          let balance = 0
          try {
            const bal = await getBalance(exchange as Exchange, acc.access_key, acc.secret_key)
            balance = bal.krw
          } catch { /* 무시 */ }
          return {
            accountId: acc.id,
            accountName: acc.account_name,
            exchange: acc.exchange,
            orderSummary,
            balance,
            success: result.success,
            reason: result.success
              ? `SUCCESS (매수:${result.buyOrderId?.slice(0, 8)} 매도:${result.sellOrderId?.slice(0, 8)})`
              : `FAIL (${result.reason})`,
          }
        }

        // SELL: 보유 코인 전량 매도
        if (tt === 'SELL') {
          const coinQty = await getCoinBalance(exchange as Exchange, acc.access_key, acc.secret_key, coin)
          if (coinQty <= 0) {
            return {
              accountId: acc.id,
              accountName: acc.account_name,
              exchange: acc.exchange,
              orderSummary,
              balance: 0,
              success: false,
              reason: `FAIL (보유 ${upperCoin} 없음)`,
            }
          }
          const result = await placeMarketOrderByCoinQty(
            exchange as Exchange,
            acc.access_key,
            acc.secret_key,
            coin,
            coinQty,
          )
          let balance = 0
          try {
            const bal = await getBalance(exchange as Exchange, acc.access_key, acc.secret_key)
            balance = bal.krw
          } catch { /* 무시 */ }
          return {
            accountId: acc.id,
            accountName: acc.account_name,
            exchange: acc.exchange,
            orderSummary,
            balance,
            success: result.success,
            reason: result.success ? 'SUCCESS' : `FAIL (${result.reason})`,
          }
        }

        // BUY: 시장가 매수
        const result = await placeMarketOrder(
          exchange as Exchange,
          acc.access_key,
          acc.secret_key,
          coin,
          'buy',
          amountKrw,
        )

        let balance = 0
        try {
          const bal = await getBalance(exchange as Exchange, acc.access_key, acc.secret_key)
          balance = bal.krw
        } catch { /* 잔고 조회 실패는 무시 */ }

        return {
          accountId: acc.id,
          accountName: acc.account_name,
          exchange: acc.exchange,
          orderSummary,
          balance,
          success: result.success,
          reason: result.success ? 'SUCCESS' : `FAIL (${result.reason})`,
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '알 수 없는 오류'
        return {
          accountId: acc.id,
          accountName: acc.account_name,
          exchange: acc.exchange,
          orderSummary,
          balance: 0,
          success: false,
          reason: `FAIL (${msg.slice(0, 60)})`,
        }
      }
    }),
  )

  return Response.json(results)
}
