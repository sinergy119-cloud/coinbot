import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase'
import { getFullBalance, getCurrentPrice } from '@/lib/exchange'
import type { Exchange } from '@/types/database'

export interface AccountAsset {
  accountId: string
  accountName: string
  krw: number
  coins: { coin: string; qty: number; price: number; value: number }[]
}

// GET /api/assets?exchange=BITHUMB
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return Response.json({ error: '로그인 필요' }, { status: 401 })

  const exchange = req.nextUrl.searchParams.get('exchange') as Exchange | null
  if (!exchange) return Response.json({ error: 'exchange 파라미터 필요' }, { status: 400 })

  const db = createServerClient()
  const { data: accounts } = await db
    .from('exchange_accounts')
    .select('*')
    .eq('exchange', exchange)
    .eq('user_id', session.userId)

  if (!accounts || accounts.length === 0) return Response.json([])

  // 1) 계정별 전체 잔고 조회 (동시)
  const balances = await Promise.all(
    accounts.map(async (acc) => {
      try {
        return await getFullBalance(exchange, acc.access_key, acc.secret_key)
      } catch {
        return { krw: 0, coins: {} as Record<string, number> }
      }
    }),
  )

  // 2) 전체 계정 통틀어 보유 코인 유니크 목록 추출 후 가격 일괄 조회
  const allCoins = Array.from(
    new Set(balances.flatMap(({ coins }) => Object.keys(coins).filter((c) => (coins[c] ?? 0) >= 0.000001)))
  )
  const priceMap: Record<string, number> = {}
  await Promise.all(
    allCoins.map(async (coin) => {
      try { priceMap[coin] = await getCurrentPrice(exchange, coin) } catch { /* 무시 */ }
    }),
  )

  // 3) 계정별 결과 조합
  const results: AccountAsset[] = accounts.map((acc, i) => {
    const { krw, coins: coinMap } = balances[i]
    const holdings = Object.entries(coinMap)
      .filter(([, qty]) => qty >= 0.000001)
      .map(([coin, qty]) => {
        const price = priceMap[coin] ?? 0
        return { coin, qty, price, value: qty * price }
      })
      .filter((h) => h.price > 0 && h.value >= 100)
    return { accountId: acc.id, accountName: acc.account_name, krw, coins: holdings }
  })

  return Response.json(results)
}
