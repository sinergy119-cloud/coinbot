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

  // 2) trade_jobs에 사용 중인지 확인
  const { data: usedJobs } = await db
    .from('trade_jobs')
    .select('id')
    .eq('user_id', session.userId)
    .contains('account_ids', [id])
    .limit(1)

  if (usedJobs && usedJobs.length > 0) {
    return Response.json(
      { error: '이 계정은 스케줄에 사용 중입니다. 스케줄을 먼저 삭제해주세요.' },
      { status: 400 },
    )
  }

  // 3) 삭제
  const { error } = await db.from('exchange_accounts').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true })
}
