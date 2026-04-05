import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase'

type Params = Promise<{ id: string }>

// PATCH /api/trade-jobs/[id] → 날짜/시간만 수정
export async function PATCH(req: NextRequest, { params }: { params: Params }) {
  const session = await getSession()
  if (!session) return Response.json({ error: '로그인 필요' }, { status: 401 })

  const { id } = await params
  const { scheduleFrom, scheduleTo, scheduleTime } = await req.json()

  const db = createServerClient()
  const { data, error } = await db
    .from('trade_jobs')
    .update({
      schedule_from: scheduleFrom,
      schedule_to: scheduleTo,
      schedule_time: scheduleTime,
    })
    .eq('id', id)
    .eq('user_id', session.userId)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

// DELETE /api/trade-jobs/[id] → 삭제
export async function DELETE(_req: NextRequest, { params }: { params: Params }) {
  const session = await getSession()
  if (!session) return Response.json({ error: '로그인 필요' }, { status: 401 })

  const { id } = await params
  const db = createServerClient()
  const { error } = await db
    .from('trade_jobs')
    .delete()
    .eq('id', id)
    .eq('user_id', session.userId)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
