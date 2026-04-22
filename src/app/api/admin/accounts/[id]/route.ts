import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/session'
import { createServerClient } from '@/lib/supabase'
import { logAdminAudit, adminRateLimit } from '@/lib/admin-audit'

type Params = Promise<{ id: string }>

// DELETE /api/admin/accounts/[id] → 관리자가 임의 계정 삭제
export async function DELETE(_req: NextRequest, { params }: { params: Params }) {
  const session = await requireAdmin()
  if (!session) {
    return Response.json({ error: '관리자만 접근 가능합니다.' }, { status: 403 })
  }
  const rl = adminRateLimit(session.userId, 'accounts:delete')
  if (!rl.ok) return Response.json({ error: `요청이 너무 많습니다. ${rl.resetInSec}초 후 다시 시도하세요.` }, { status: 429 })

  const { id } = await params
  const db = createServerClient()

  // 계정 존재 확인
  const { data: account } = await db
    .from('exchange_accounts')
    .select('id, user_id, exchange, account_name')
    .eq('id', id)
    .single()
  if (!account) {
    return Response.json({ error: '계정을 찾을 수 없습니다.' }, { status: 404 })
  }

  // trade_jobs 사용 여부 확인 — 소유자 무관, 모든 사용자의 스케줄에서 이 계정을 쓰는지 검사
  // (타 사용자가 부정 등록한 스케줄까지 잡아내기 위함)
  const { data: usedJobs } = await db
    .from('trade_jobs')
    .select('id')
    .contains('account_ids', [id])
    .limit(1)
  if (usedJobs && usedJobs.length > 0) {
    return Response.json(
      { error: '이 계정은 스케줄에 사용 중입니다. 스케줄을 먼저 삭제해주세요.' },
      { status: 400 },
    )
  }

  const { error } = await db.from('exchange_accounts').delete().eq('id', id)
  if (error) {
    console.error('[admin/accounts/id] delete error:', error)
    return Response.json({ error: '계정 삭제에 실패했습니다.' }, { status: 500 })
  }

  await logAdminAudit(db, {
    adminId: session.userId,
    action: 'account.delete',
    targetUserId: account.user_id,
    payload: { accountId: id, exchange: account.exchange, accountName: account.account_name },
  })

  return Response.json({ ok: true })
}
