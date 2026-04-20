/**
 * GET /api/admin/crawl-logs
 *
 * 수집 실행 이력을 최신순으로 반환합니다 (최대 20건).
 * 관리자 세션 인증 필요.
 */

import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase'

export async function GET(_req: NextRequest) {
  const session = await getSession()
  if (!session || !session.isAdmin) {
    return Response.json({ error: '관리자만 접근 가능합니다.' }, { status: 403 })
  }

  const db = createServerClient()

  const { data, error } = await db
    .from('crawl_logs')
    .select('id, triggered_by, started_at, found_count, inserted_count, errors, telegram_sent, telegram_error')
    .order('started_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('[crawl-logs] 조회 오류:', error)
    return Response.json({ error: '이력 조회 실패' }, { status: 500 })
  }

  return Response.json(data ?? [])
}
