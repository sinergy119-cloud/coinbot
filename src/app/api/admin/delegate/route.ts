/**
 * /api/admin/delegate — 관리자 위임 승인/거절 (관리자 전용)
 *
 * PATCH { action: 'approve' | 'reject', userId: string }
 *   approve → delegated=true,  delegate_pending=false
 *   reject  → delegated=false, delegate_pending=false
 */

import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { isAdmin } from '@/lib/admin'
import { createServerClient } from '@/lib/supabase'

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session || !isAdmin(session.loginId)) {
    return Response.json({ error: '관리자만 접근 가능합니다.' }, { status: 403 })
  }

  const body = await req.json()
  const { action, userId } = body

  if (!userId || !action) {
    return Response.json({ error: 'userId와 action은 필수입니다.' }, { status: 400 })
  }
  if (action !== 'approve' && action !== 'reject') {
    return Response.json({ error: "action은 'approve' 또는 'reject'만 허용됩니다." }, { status: 400 })
  }

  const db = createServerClient()
  const updates =
    action === 'approve'
      ? { delegated: true, delegate_pending: false }
      : { delegated: false, delegate_pending: false }

  const { error } = await db.from('users').update(updates).eq('id', userId)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true })
}
