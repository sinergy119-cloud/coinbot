import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { isAdmin } from '@/lib/admin'
import { createServerClient } from '@/lib/supabase'

type Params = Promise<{ id: string }>

// DELETE /api/admin/accounts/[id] → 관리자가 임의 계정 삭제
export async function DELETE(_req: NextRequest, { params }: { params: Params }) {
  const session = await getSession()
  if (!session || !isAdmin(session.loginId)) {
    return Response.json({ error: '관리자만 접근 가능합니다.' }, { status: 403 })
  }

  const { id } = await params
  const db = createServerClient()

  // 계정 존재 확인
  const { data: account } = await db
    .from('exchange_accounts')
    .select('id, user_id')
    .eq('id', id)
    .single()
  if (!account) {
    return Response.json({ error: '계정을 찾을 수 없습니다.' }, { status: 404 })
  }

  // trade_jobs 사용 여부 확인 (해당 사용자의 job)
  const { data: usedJobs } = await db
    .from('trade_jobs')
    .select('id')
    .eq('user_id', account.user_id)
    .contains('account_ids', [id])
    .limit(1)
  if (usedJobs && usedJobs.length > 0) {
    return Response.json(
      { error: '이 계정은 스케줄에 사용 중입니다. 스케줄을 먼저 삭제해주세요.' },
      { status: 400 },
    )
  }

  const { error } = await db.from('exchange_accounts').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true })
}
