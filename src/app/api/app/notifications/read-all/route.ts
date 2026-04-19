// PATCH /api/app/notifications/read-all — 전체 읽음 처리
// design-schema.md §4-3

import { getSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase'
import { ok, unauthorized } from '@/lib/app/response'

export async function PATCH() {
  const session = await getSession()
  if (!session) return unauthorized()

  const db = createServerClient()
  const { count } = await db
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', session.userId)
    .is('read_at', null)

  await db
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', session.userId)
    .is('read_at', null)

  return ok({ updatedCount: count ?? 0 })
}
