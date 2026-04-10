import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { isAdmin } from '@/lib/admin'
import { createServerClient } from '@/lib/supabase'

// GET /api/admin/user-dashboard?userId=xxx
// 관리자가 특정 회원의 스케줄, 거래로그, 계정 정보를 조회
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session || !isAdmin(session.loginId)) {
    return Response.json({ error: '관리자만 접근 가능합니다.' }, { status: 403 })
  }

  const targetUserId = req.nextUrl.searchParams.get('userId')
  if (!targetUserId) {
    return Response.json({ error: 'userId 파라미터 필요' }, { status: 400 })
  }

  const db = createServerClient()

  // 병렬 조회
  const [
    { data: user },
    { data: accounts },
    { data: tradeJobs },
    { data: tradeLogs },
  ] = await Promise.all([
    db.from('users')
      .select('id, user_id, name, phone, email, status, telegram_chat_id, created_at, last_login_at')
      .eq('id', targetUserId)
      .single(),
    db.from('exchange_accounts')
      .select('id, exchange, account_name, created_at')
      .eq('user_id', targetUserId)
      .order('created_at'),
    db.from('trade_jobs')
      .select('*')
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false }),
    db.from('trade_logs')
      .select('*')
      .eq('user_id', targetUserId)
      .order('executed_at', { ascending: false })
      .limit(50),
  ])

  // 본인 계정이 포함된 타인의 스케줄도 조회
  const myAccountIds = new Set((accounts ?? []).map((a) => a.id))
  let delegatedJobs: typeof tradeJobs = []
  if (myAccountIds.size > 0) {
    const { data: otherJobs } = await db
      .from('trade_jobs')
      .select('*')
      .neq('user_id', targetUserId)
      .order('created_at', { ascending: false })

    delegatedJobs = (otherJobs ?? []).filter((job) =>
      (job.account_ids as string[]).some((id) => myAccountIds.has(id))
    )
  }

  // 계정 맵 (id → account_name)
  const accountMap: Record<string, string> = {}
  for (const acc of accounts ?? []) {
    accountMap[acc.id] = acc.account_name
  }

  return Response.json({
    user: user ?? null,
    accounts: accounts ?? [],
    accountMap,
    tradeJobs: [...(tradeJobs ?? []), ...(delegatedJobs ?? [])],
    tradeLogs: tradeLogs ?? [],
  })
}
