import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase'
import { getFullBalance, getCurrentPrice } from '@/lib/exchange'
import type { Exchange } from '@/types/database'

// GET /api/admin/user-assets?userId=xxx&exchange=BITHUMB
// 관리자가 ?�정 ?�원??거래?�별 ?�산 조회
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session || !session.isAdmin) {
    return Response.json({ error: '관리자�??�근 가?�합?�다.' }, { status: 403 })
  }

  const targetUserId = req.nextUrl.searchParams.get('userId')
  const exchange = req.nextUrl.searchParams.get('exchange') as Exchange | null
  if (!targetUserId || !exchange) {
    return Response.json({ error: 'userId, exchange ?�라미터 ?�요' }, { status: 400 })
  }

  const db = createServerClient()
  const { data: accounts } = await db
    .from('exchange_accounts')
    .select('*')
    .eq('exchange', exchange)
    .eq('user_id', targetUserId)

  if (!accounts || accounts.length === 0) return Response.json([])

  const balances = await Promise.all(
    accounts.map(async (acc) => {
      try {
        return await getFullBalance(exchange, acc.access_key, acc.secret_key)
      } catch {
        return { krw: 0, coins: {} as Record<string, number> }
      }
    }),
  )

  const allCoins = Array.from(
    new Set(balances.flatMap(({ coins }) => Object.keys(coins).filter((c) => (coins[c] ?? 0) >= 0.000001)))
  )
  const priceMap: Record<string, number> = {}
  await Promise.all(
    allCoins.map(async (coin) => {
      try { priceMap[coin] = await getCurrentPrice(exchange, coin) } catch { /* 무시 */ }
    }),
  )

  const results = accounts.map((acc, i) => {
    const { krw, coins: coinMap } = balances[i]
    const holdings = Object.entries(coinMap)
      .filter(([, qty]) => qty >= 0.000001)
      .map(([coin, qty]) => {
        const price = priceMap[coin] ?? 0
        return { coin, qty, price, value: qty * price }
      })
      .filter((h) => h.price > 0 && h.value >= 1)
    return { accountId: acc.id, accountName: acc.account_name, krw, coins: holdings }
  })

  return Response.json(results)
}
