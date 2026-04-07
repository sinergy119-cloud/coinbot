import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase'
import { getTradeHistory } from '@/lib/exchange'
import type { Exchange } from '@/types/database'

// GET /api/trade-history?exchange=BITHUMB&accountId=xxx
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return Response.json({ error: '로그인 필요' }, { status: 401 })

  const exchange = req.nextUrl.searchParams.get('exchange') as Exchange | null
  const accountId = req.nextUrl.searchParams.get('accountId')
  const coin = req.nextUrl.searchParams.get('coin') ?? undefined

  if (!exchange || !accountId) {
    return Response.json({ error: 'exchange, accountId 파라미터 필요' }, { status: 400 })
  }

  const db = createServerClient()
  const { data: acc } = await db
    .from('exchange_accounts')
    .select('*')
    .eq('id', accountId)
    .eq('user_id', session.userId)
    .single()

  if (!acc) return Response.json({ error: '계정을 찾을 수 없습니다.' }, { status: 404 })

  try {
    const history = await getTradeHistory(exchange, acc.access_key, acc.secret_key, 50, coin)
    return Response.json(history)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '알 수 없는 오류'
    return Response.json({ error: `거래내역 조회 실패: ${msg.slice(0, 100)}` }, { status: 500 })
  }
}
