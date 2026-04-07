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

  // 계정별 전체 잔고 조회 (동시)
  const results: AccountAsset[] = await Promise.all(
    accounts.map(async (acc) => {
      try {
        const { krw, coins: coinMap } = await getFullBalance(exchange, acc.access_key, acc.secret_key)

        // 보유 코인별 현재가 조회 (동시)
        const coinEntries = Object.entries(coinMap).filter(([, qty]) => qty >= 0.000001)
        const holdings = await Promise.all(
          coinEntries.map(async ([coin, qty]) => {
            let price = 0
            try { price = await getCurrentPrice(exchange, coin) } catch { /* 무시 */ }
            return { coin, qty, price, value: qty * price }
          }),
        )

        // 가격 조회 가능한 코인은 100원 이상만 표시, 가격 없는 코인은 제외
        const filtered = holdings.filter((h) => h.price > 0 && h.value >= 100)

        return { accountId: acc.id, accountName: acc.account_name, krw, coins: filtered }
      } catch {
        return { accountId: acc.id, accountName: acc.account_name, krw: 0, coins: [] }
      }
    }),
  )

  return Response.json(results)
}
