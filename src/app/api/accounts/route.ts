import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase'

// GET /api/accounts?exchange=UPBIT
// → 로그인 사용자의 해당 거래소 계정 목록 반환
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return Response.json({ error: '로그인 필요' }, { status: 401 })

  const exchange = req.nextUrl.searchParams.get('exchange')

  const db = createServerClient()
  let query = db
    .from('exchange_accounts')
    .select('id, exchange, account_name')
    .eq('user_id', session.userId)
    .order('created_at')

  if (exchange) query = query.eq('exchange', exchange)

  const { data, error } = await query

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}
