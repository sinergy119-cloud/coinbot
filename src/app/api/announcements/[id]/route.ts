import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { isAdmin } from '@/lib/admin'
import { createServerClient } from '@/lib/supabase'

type Params = Promise<{ id: string }>

// PATCH /api/announcements/[id] → 이벤트 수정 (관리자만)
export async function PATCH(req: NextRequest, { params }: { params: Params }) {
  const session = await getSession()
  if (!session || !isAdmin(session.loginId)) {
    return Response.json({ error: '관리자만 접근 가능합니다.' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()

  const updates: Record<string, unknown> = {}
  if (body.exchange !== undefined) updates.exchange = body.exchange
  if (body.coin !== undefined) updates.coin = body.coin.toUpperCase()
  if (body.amount !== undefined) updates.amount = body.amount || null
  if (body.requireApply !== undefined) updates.require_apply = !!body.requireApply
  if (body.apiAllowed !== undefined) updates.api_allowed = !!body.apiAllowed
  if (body.link !== undefined) updates.link = body.link || null
  if (body.notes !== undefined) updates.notes = body.notes || null
  if (body.startDate !== undefined) updates.start_date = body.startDate
  if (body.endDate !== undefined) updates.end_date = body.endDate

  const db = createServerClient()
  const { data, error } = await db
    .from('announcements')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

// DELETE /api/announcements/[id] → 이벤트 삭제 (관리자만)
export async function DELETE(_req: NextRequest, { params }: { params: Params }) {
  const session = await getSession()
  if (!session || !isAdmin(session.loginId)) {
    return Response.json({ error: '관리자만 접근 가능합니다.' }, { status: 403 })
  }

  const { id } = await params
  const db = createServerClient()
  const { error } = await db.from('announcements').delete().eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
