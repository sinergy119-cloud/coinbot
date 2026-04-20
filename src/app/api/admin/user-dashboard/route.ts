import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase'

// GET /api/admin/user-dashboard?userId=xxx
// ê´€ë¦¬ìê°€ ?¹ì • ?Œì›???¤ì?ì¤? ê±°ë˜ë¡œê·¸, ê³„ì • ?•ë³´ë¥?ì¡°íšŒ
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session || !session.isAdmin) {
    return Response.json({ error: 'ê´€ë¦¬ìë§??‘ê·¼ ê°€?¥í•©?ˆë‹¤.' }, { status: 403 })
  }

  const targetUserId = req.nextUrl.searchParams.get('userId')
  if (!targetUserId) {
    return Response.json({ error: 'userId ?Œë¼ë¯¸í„° ?„ìš”' }, { status: 400 })
  }

  const db = createServerClient()

  // ë³‘ë ¬ ì¡°íšŒ
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

  // ë³¸ì¸ ê³„ì •???¬í•¨???€?¸ì˜ ?¤ì?ì¤„ë„ ì¡°íšŒ
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

  // ê³„ì • ë§?(id ??account_name) ???„ì„ ?¤ì?ì¤„ì— ?¬í•¨???¤ë¥¸ ê³„ì •???¬í•¨
  const accountMap: Record<string, string> = {}
  for (const acc of accounts ?? []) {
    accountMap[acc.id] = acc.account_name
  }
  // ?„ì„ ?¤ì?ì¤„ì˜ account_ids?ì„œ ?„ë½??ê³„ì • ?´ë¦„ ë³´ì¶©
  const missingIds = new Set<string>()
  for (const job of delegatedJobs ?? []) {
    for (const id of (job.account_ids as string[])) {
      if (!accountMap[id]) missingIds.add(id)
    }
  }
  if (missingIds.size > 0) {
    const { data: extraAccs } = await db
      .from('exchange_accounts')
      .select('id, account_name')
      .in('id', Array.from(missingIds))
    for (const acc of extraAccs ?? []) {
      accountMap[acc.id] = acc.account_name
    }
  }

  return Response.json({
    user: user ?? null,
    accounts: accounts ?? [],
    accountMap,
    tradeJobs: [...(tradeJobs ?? []), ...(delegatedJobs ?? [])].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ),
    tradeLogs: tradeLogs ?? [],
  })
}
