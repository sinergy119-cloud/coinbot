import { NextRequest } from 'next/server'
import { revalidateTag } from 'next/cache'
import { getSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase'

type Params = Promise<{ id: string }>

// PATCH /api/announcements/[id] → 이벤트 수정 (관리자만)
export async function PATCH(req: NextRequest, { params }: { params: Params }) {
  const session = await getSession()
  if (!session || !session.isAdmin) {
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
  if (body.link !== undefined) {
    if (body.link && typeof body.link === 'string') {
      try {
        const u = new URL(body.link.trim())
        if (u.protocol !== 'http:' && u.protocol !== 'https:') {
          return Response.json({ error: '링크는 http 또는 https만 허용됩니다.' }, { status: 400 })
        }
        updates.link = u.toString().slice(0, 500)
      } catch {
        return Response.json({ error: '유효하지 않은 링크 형식입니다.' }, { status: 400 })
      }
    } else {
      updates.link = null
    }
  }
  if (body.notes !== undefined) updates.notes = body.notes && typeof body.notes === 'string' ? body.notes.slice(0, 2000) : null
  if (body.startDate !== undefined) updates.start_date = body.startDate
  if (body.endDate !== undefined) updates.end_date = body.endDate
  if (body.rewardDate !== undefined) updates.reward_date = body.rewardDate || null

  const db = createServerClient()
  const { data, error } = await db
    .from('announcements')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('[announcements/id] update error:', error)
    return Response.json({ error: '이벤트 수정에 실패했습니다.' }, { status: 500 })
  }
  revalidateTag('announcements', 'max')
  return Response.json(data)
}

// DELETE /api/announcements/[id] → 이벤트 삭제 (관리자만)
export async function DELETE(_req: NextRequest, { params }: { params: Params }) {
  const session = await getSession()
  if (!session || !session.isAdmin) {
    return Response.json({ error: '관리자만 접근 가능합니다.' }, { status: 403 })
  }

  const { id } = await params
  const db = createServerClient()
  const { error } = await db.from('announcements').delete().eq('id', id)

  if (error) {
    console.error('[announcements/id] delete error:', error)
    return Response.json({ error: '이벤트 삭제에 실패했습니다.' }, { status: 500 })
  }
  revalidateTag('announcements', 'max')
  return Response.json({ ok: true })
}
