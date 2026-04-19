// DELETE /api/app/notifications/:id — 개별 삭제
// design-schema.md §4-3

import { getSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase'
import { ok, unauthorized, notFound, fail } from '@/lib/app/response'

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return unauthorized()

  const { id } = await params
  if (!id) return fail('id가 필요합니다.')

  const db = createServerClient()
  const { data: row } = await db
    .from('notifications')
    .select('id, user_id')
    .eq('id', id)
    .maybeSingle()

  if (!row) return notFound('알림')
  if (row.user_id !== session.userId) return fail('본인의 알림만 삭제할 수 있습니다.', 403)

  await db.from('notifications').delete().eq('id', id)
  return ok({ deleted: true })
}
