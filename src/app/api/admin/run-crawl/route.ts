/**
 * POST /api/admin/run-crawl
 *
 * 관리자 세션 인증으로 즉시 크롤링을 실행합니다.
 * "지금 수집" 버튼에서 호출 — CRON_SECRET 불필요.
 *
 * R-3: 5분 쿨다운 적용 (execute.ts 내부 처리)
 * 핵심 로직은 src/lib/crawlers/execute.ts 참조.
 */

import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { isAdmin } from '@/lib/admin'
import { createServerClient } from '@/lib/supabase'
import { executeCrawl } from '@/lib/crawlers/execute'

export async function POST(_req: NextRequest) {
  // 관리자 세션 인증
  const session = await getSession()
  if (!session || !isAdmin(session.loginId)) {
    return Response.json({ error: '관리자만 접근 가능합니다.' }, { status: 403 })
  }

  const db = createServerClient()
  const { httpStatus, result } = await executeCrawl(db, 'manual')
  return Response.json(result, { status: httpStatus })
}
