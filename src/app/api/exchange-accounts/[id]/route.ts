import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase'

type Params = Promise<{ id: string }>

// DELETE /api/exchange-accounts/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Params }) {
  const session = await getSession()
  if (!session) return Response.json({ error: '로그인 필요' }, { status: 401 })

  const { id } = await params
  const db = createServerClient()

  // 1) 본인 계정인지 확인
  const { data: account } = await db
    .from('exchange_accounts')
    .select('id, user_id')
    .eq('id', id)
    .single()

  if (!account || account.user_id !== session.userId) {
    return Response.json({ error: '계정을 찾을 수 없습니다.' }, { status: 404 })
  }

  // 2) trade_jobs에 사용 중인지 확인 — 진행 중(active/paused)만 차단, 완료된 이력은 통과
  const { data: usedJobs } = await db
    .from('trade_jobs')
    .select('id, exchange, coin, trade_type, status, schedule_from, schedule_to, schedule_time')
    .eq('user_id', session.userId)
    .contains('account_ids', [id])
    .in('status', ['active', 'paused'])

  if (usedJobs && usedJobs.length > 0) {
    const first = usedJobs[0]
    const detail =
      `진행 중인 스케줄에 사용되어 삭제할 수 없습니다.\n\n` +
      `차단된 스케줄${usedJobs.length > 1 ? ` (${usedJobs.length}건 중 1건 표시)` : ''}\n` +
      `• 거래소/코인: ${first.exchange} / ${first.coin}\n` +
      `• 거래 방식: ${first.trade_type}\n` +
      `• 상태: ${first.status}\n` +
      `• 기간: ${first.schedule_from} ~ ${first.schedule_to}\n` +
      `• 실행 시각: ${first.schedule_time}\n\n` +
      `해당 스케줄을 먼저 삭제하세요.`
    return Response.json({ error: detail, blockingJobs: usedJobs }, { status: 400 })
  }

  // 3) 삭제
  const { error } = await db.from('exchange_accounts').delete().eq('id', id)
  if (error) {
    console.error('[exchange-accounts/id] delete error:', error)
    return Response.json({ error: '계정 삭제에 실패했습니다.' }, { status: 500 })
  }

  return Response.json({ ok: true })
}
