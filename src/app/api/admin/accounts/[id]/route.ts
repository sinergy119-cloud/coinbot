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
  // 단, 진행 중인 스케줄(active/paused)만 차단. 완료(completed)·취소(cancelled) 스케줄은 이력이므로 통과.
  const { data: usedJobs } = await db
    .from('trade_jobs')
    .select('id, user_id, exchange, coin, trade_type, status, schedule_from, schedule_to, schedule_time')
    .contains('account_ids', [id])
    .in('status', ['active', 'paused'])
  if (usedJobs && usedJobs.length > 0) {
    // 등록자 user_id를 loginId/이름으로 변환
    const ownerIds = Array.from(new Set(usedJobs.map((j) => j.user_id)))
    const { data: owners } = await db
      .from('users')
      .select('id, user_id, name')
      .in('id', ownerIds)
    const ownerMap = new Map((owners ?? []).map((u) => [u.id, u]))

    const blockingJobs = usedJobs.map((j) => {
      const o = ownerMap.get(j.user_id)
      return {
        jobId: j.id,
        exchange: j.exchange,
        coin: j.coin,
        tradeType: j.trade_type,
        status: j.status,
        scheduleFrom: j.schedule_from,
        scheduleTo: j.schedule_to,
        scheduleTime: j.schedule_time,
        ownerLoginId: o?.user_id ?? '(알 수 없음)',
        ownerName: o?.name ?? null,
      }
    })

    // 첫 건 디테일을 에러 메시지에 포함 (UI에서 alert로 표시)
    const first = blockingJobs[0]
    const ownerLabel = first.ownerName ? `${first.ownerLoginId} (${first.ownerName})` : first.ownerLoginId
    const detail =
      `진행 중인 스케줄에 사용되어 삭제할 수 없습니다.\n\n` +
      `차단된 스케줄${blockingJobs.length > 1 ? ` (${blockingJobs.length}건 중 1건 표시)` : ''}\n` +
      `• 거래소/코인: ${first.exchange} / ${first.coin}\n` +
      `• 거래 방식: ${first.tradeType}\n` +
      `• 등록자: ${ownerLabel}\n` +
      `• 상태: ${first.status}\n` +
      `• 기간: ${first.scheduleFrom} ~ ${first.scheduleTo}\n` +
      `• 실행 시각: ${first.scheduleTime}\n\n` +
      `해당 스케줄을 먼저 삭제하거나 종료하세요.`

    return Response.json(
      { error: detail, blockingJobs },
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
