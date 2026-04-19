// DELETE /api/app/trade-jobs/:id — 스케줄 취소
// design-schema.md §4-7

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
    .from('trade_jobs')
    .select('id, user_id')
    .eq('id', id)
    .maybeSingle()

  if (!row) return notFound('스케줄')
  if (row.user_id !== session.userId) return fail('본인의 스케줄만 삭제할 수 있습니다.', 403)

  await db.from('trade_jobs').delete().eq('id', id)
  return ok({ deleted: true })
}
