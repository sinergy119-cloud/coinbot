import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase'

// GET /api/accounts?exchange=UPBIT
// → 로그인 사용자의 해당 거래소 계정 목록 반환
// → 관리자인 경우 위임(delegated=true)된 사용자의 계정도 포함
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return Response.json({ error: '로그인 필요' }, { status: 401 })

  const exchange = req.nextUrl.searchParams.get('exchange')
  const db = createServerClient()

  // 1) 본인 계정
  let myQuery = db
    .from('exchange_accounts')
    .select('id, exchange, account_name, user_id')
    .eq('user_id', session.userId)
    .order('created_at')
  if (exchange) myQuery = myQuery.eq('exchange', exchange)
  const { data: myAccounts } = await myQuery

  // 2) 관리자인 경우: 위임된 사용자의 계정도 조회
  let delegatedAccounts: typeof myAccounts = []
  if (session.isAdmin) {
    // delegated=true인 사용자 ID 목록
    const { data: delegators } = await db
      .from('users')
      .select('id, user_id')
      .eq('delegated', true)

    if (delegators && delegators.length > 0) {
      const delegatorIds = delegators.map((u) => u.id)
      const loginIdMap = new Map(delegators.map((u) => [u.id, u.user_id]))

      let dQuery = db
        .from('exchange_accounts')
        .select('id, exchange, account_name, user_id')
        .in('user_id', delegatorIds)
        .order('created_at')
      if (exchange) dQuery = dQuery.eq('exchange', exchange)
      const { data } = await dQuery

      // 위임 계정에 소유자 표시 추가
      delegatedAccounts = (data ?? []).map((acc) => ({
        ...acc,
        _delegated: true,
        _owner_login_id: loginIdMap.get(acc.user_id) ?? '',
      }))
    }
  }

  return Response.json([...(myAccounts ?? []), ...(delegatedAccounts ?? [])])
}
