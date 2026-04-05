import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase'
import { placeMarketOrder, getBalance } from '@/lib/exchange'
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

  if (!exchange || !coin || !tradeType || !amountKrw || !accountIds?.length) {
    return Response.json({ error: '필수 항목이 누락되었습니다.' }, { status: 400 })
  }
  if (amountKrw < 5100) {
    return Response.json({ error: '최소 거래 금액은 5,100원입니다.' }, { status: 400 })
  }

  const db = createServerClient()
  const { data: accounts } = await db
    .from('exchange_accounts')
    .select('*')
    .in('id', accountIds)
    .eq('user_id', session.userId)

  if (!accounts || accounts.length === 0) {
    return Response.json({ error: '계정을 찾을 수 없습니다.' }, { status: 404 })
  }

  const side = (tradeType as TradeType) === 'BUY' ? 'buy' : 'sell'
  const orderSummary = `${coin.toUpperCase()}/KRW ${tradeType === 'BUY' ? '매수' : '매도'} ${Number(amountKrw).toLocaleString()}원`

  // 전부 동시에 실행 (planning.md 8.4)
  const results: ExecutionResultItem[] = await Promise.all(
    accounts.map(async (acc) => {
      try {
        const result = await placeMarketOrder(
          exchange as Exchange,
          acc.access_key,
          acc.secret_key,
          coin,
          side,
          amountKrw,
        )

        // 실행 후 잔고 조회
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
